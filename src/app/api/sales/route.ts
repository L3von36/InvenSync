import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'
import { sanitizeAndTruncate, validateSanitizedField } from '@/lib/sanitize'

// GET /api/sales?orgId=xxx&startDate=xxx&endDate=xxx&status=xxx
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'sales')
      if (moduleError) return moduleError
    }

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')
    const shopId = searchParams.get('shopId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = { organizationId: orgId }

    // When shopId is provided, filter sales strictly by that shop
    if (shopId) {
      where.shopId = shopId
    }

    if (startDate || endDate) {
      where.saleDate = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      }
    }

    if (status) {
      where.status = status
    }

    const [sales, total] = await Promise.all([
      db.sale.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          organizationId: true,
          shopId: true,
          customerId: true,
          status: true,
          paymentMethod: true,
          subtotal: true,
          discount: true,
          tax: true,
          total: true,
          amountPaid: true,
          notes: true,
          saleDate: true,
          createdAt: true,
          updatedAt: true,
          customer: { select: { id: true, name: true, phone: true } },
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              unitPrice: true,
              costPrice: true,
              total: true,
              createdAt: true,
              product: { select: { id: true, name: true, sku: true } }
            }
          }
        },
        orderBy: { saleDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.sale.count({ where })
    ])

    return NextResponse.json({
      sales,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=5, stale-while-revalidate=15',
      }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('List sales error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/sales - Create sale with items
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const {
      orgId, customerId, items, paymentMethod, shopId
    } = body
    let { notes } = body

    // Sanitize text inputs
    notes = notes ? sanitizeAndTruncate(notes, 1000) : notes
    const notesError = validateSanitizedField(body.notes, notes, 'Notes')
    if (notesError) {
      return NextResponse.json({ error: notesError }, { status: 400 })
    }

    // Ensure numeric fields are properly parsed (form may send strings)
    const discount = typeof body.discount === 'string' ? parseFloat(body.discount) : (body.discount || 0)
    const tax = typeof body.tax === 'string' ? parseFloat(body.tax) : (body.tax || 0)
    const amountPaid = typeof body.amountPaid === 'string' ? parseFloat(body.amountPaid) : (body.amountPaid || 0)

    if (!orgId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'orgId and at least one item are required' },
        { status: 400 }
      )
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'sales')
      if (moduleError) return moduleError
    }

    // Calculate totals
    const discountVal = discount || 0
    const taxVal = tax || 0
    const amountPaidVal = amountPaid || 0

    // Wrap the entire sale creation in a transaction to prevent race conditions
    // (e.g., overselling stock, duplicate invoice numbers, partial writes)
    const result = await db.$transaction(async (tx) => {
      // OPTIMIZATION: Batch fetch all products at once instead of N+1 sequential queries
      // Previously: for-loop with individual findFirst calls per item
      // Now: Single findMany with { id: { in: [...] } }
      const productIds = items.map((item: { productId: string }) => item.productId)
      const productMap = new Map(
        (await tx.product.findMany({
          where: { id: { in: productIds }, organizationId: orgId, isActive: true }
        })).map(p => [p.id, p])
      )

      // Validate all products belong to org and have enough stock
      for (const item of items) {
        const itemQuantity = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity
        const product = productMap.get(item.productId)
        if (!product) {
          throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`)
        }
        if (product.quantity < itemQuantity) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}:${product.quantity}:${itemQuantity}`)
        }
      }

      // Generate invoice number atomically inside the transaction using count+1
      const saleCount = await tx.sale.count({ where: { organizationId: orgId } })
      const invoiceNumber = `INV-${(saleCount + 1).toString().padStart(3, '0')}`

      const subtotal = items.reduce((sum: number, item: { productId: string; quantity: number | string; unitPrice?: number | string }) => {
        const qty = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity
        const product = productMap.get(item.productId)
        const unitPrice = Number(item.unitPrice) || product?.sellingPrice || 0
        return sum + (unitPrice * qty)
      }, 0)

      const total = subtotal - discountVal + taxVal

      const sale = await tx.sale.create({
        data: {
          organizationId: orgId,
          shopId: shopId || null,
          customerId: customerId || null,
          invoiceNumber,
          status: 'completed',
          paymentMethod: paymentMethod || 'cash',
          subtotal,
          discount: discountVal,
          tax: taxVal,
          total,
          amountPaid: amountPaidVal,
          notes: notes || null,
        }
      })

      // OPTIMIZATION: Batch create sale items and stock movements
      // Previously: sequential loop with individual create calls per item
      // Now: createMany for sale items + batch product updates + createMany for stock movements
      const saleItemsData = items.map((item: { productId: string; quantity: number | string; unitPrice?: number | string }) => {
        const product = productMap.get(item.productId)!
        const itemQty = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity
        const unitPrice = Number(item.unitPrice) || product.sellingPrice
        return {
          saleId: sale.id,
          productId: item.productId,
          quantity: itemQty,
          unitPrice,
          costPrice: product.costPrice,
          total: unitPrice * itemQty,
        }
      })

      await tx.saleItem.createMany({ data: saleItemsData })

      // Batch update product quantities and create stock movements
      const stockMovementsData = []
      for (const item of items) {
        const product = productMap.get(item.productId)!
        const itemQty = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity
        const previousStock = product.quantity
        const newStock = previousStock - itemQty

        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: newStock }
        })

        stockMovementsData.push({
          organizationId: orgId,
          shopId: shopId || null,
          productId: item.productId,
          type: 'out',
          quantity: itemQty,
          previousStock,
          newStock,
          reason: 'Sale',
          reference: invoiceNumber,
        })
      }

      await tx.stockMovement.createMany({ data: stockMovementsData })

      // If credit sale (amountPaid < total), create a debt
      if (customerId && amountPaidVal < total) {
        const remainingDebt = total - amountPaidVal
        await tx.debt.create({
          data: {
            organizationId: orgId,
            customerId,
            type: 'customer_debt',
            amount: remainingDebt,
            paidAmount: 0,
            status: 'pending',
            description: `Debt from sale ${invoiceNumber}`,
          }
        })
      }

      // Fetch the complete sale
      return tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } }
            }
          }
        }
      })
    })

    return NextResponse.json({ sale: result }, { status: 201 })
  } catch (error) {
    // Handle known business-logic errors thrown inside the transaction
    if (error instanceof Error) {
      if (error.message.startsWith('PRODUCT_NOT_FOUND:')) {
        const productId = error.message.split(':')[1]
        return NextResponse.json(
          { error: `Product ${productId} not found` },
          { status: 404 }
        )
      }
      if (error.message.startsWith('INSUFFICIENT_STOCK:')) {
        const parts = error.message.split(':')
        return NextResponse.json(
          { error: `Insufficient stock for ${parts[1]}. Available: ${parts[2]}, Requested: ${parts[3]}` },
          { status: 400 }
        )
      }
    }
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Create sale error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

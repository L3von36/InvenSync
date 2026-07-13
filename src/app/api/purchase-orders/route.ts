import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess, canReadFinancials } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/purchase-orders?orgId=xxx&status=xxx
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

    // Purchase orders (with cost prices) — org owners/managers only
    if (!canReadFinancials(user, orgId)) {
      return NextResponse.json({ error: 'Forbidden: purchase orders are available to owners and managers only' }, { status: 403 })
    }

    const status = searchParams.get('status')
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true'

    const where: Record<string, unknown> = { organizationId: orgId }
    if (status) where.status = status

    // Delta sync: filter records updated since the given timestamp
    const updatedSince = searchParams.get('updatedSince')
    if (updatedSince) {
      const updatedSinceDate = new Date(updatedSince)
      if (!isNaN(updatedSinceDate.getTime())) {
        where.updatedAt = { gte: updatedSinceDate }
      }
    }

    const [purchaseOrders, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          shop: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } }
            }
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.purchaseOrder.count({ where }),
    ])

    // If lowStockOnly is requested, also return low-stock products for reordering suggestions
    let lowStockProducts: Array<{
      id: string
      name: string
      sku: string | null
      quantity: number
      lowStockThreshold: number
      costPrice: number
      productType: { id: string; name: string }
    }> = []

    if (lowStockOnly) {
      const allProducts = await db.product.findMany({
        where: {
          organizationId: orgId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          quantity: true,
          lowStockThreshold: true,
          costPrice: true,
          productType: { select: { id: true, name: true } },
        },
        orderBy: { quantity: 'asc' },
      })
      lowStockProducts = allProducts.filter(p => p.quantity <= (p.lowStockThreshold || 0))
    }

    return NextResponse.json({
      purchaseOrders,
      serverTime: new Date().toISOString(),
      total,
      ...(lowStockOnly ? { lowStockProducts } : {}),
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('List purchase orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/purchase-orders
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
    const { orgId, supplierId, shopId, notes, expectedDate, items } = body

    if (!orgId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'orgId and items (at least one) are required' },
        { status: 400 }
      )
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Calculate total amount from items
    let totalAmount = 0
    const orderItems = items.map((item: { productId: string; quantity: number; unitCost: number }) => {
      const qty = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity
      const cost = typeof item.unitCost === 'string' ? parseFloat(item.unitCost) : item.unitCost
      const totalCost = qty * cost
      totalAmount += totalCost
      return {
        productId: item.productId,
        quantity: qty,
        unitCost: cost,
        totalCost,
        receivedQty: 0,
      }
    })

    // Validate all products exist and belong to org
    const productIds = orderItems.map((item: { productId: string }) => item.productId)
    const products = await db.product.findMany({
      where: { id: { in: productIds }, organizationId: orgId }
    })
    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: 'One or more products not found' },
        { status: 400 }
      )
    }

    const purchaseOrder = await db.purchaseOrder.create({
      data: {
        organizationId: orgId,
        supplierId: supplierId || null,
        shopId: shopId || null,
        status: 'draft',
        totalAmount,
        notes: notes || null,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        items: {
          create: orderItems,
        },
      },
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        shop: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } }
          }
        },
      }
    })

    return NextResponse.json({ purchaseOrder }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Create purchase order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

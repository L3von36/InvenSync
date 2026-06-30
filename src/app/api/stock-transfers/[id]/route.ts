import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// PUT /api/stock-transfers/[id] - Update stock transfer status
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { orgId, action } = body

    if (!orgId || !action) {
      return NextResponse.json(
        { error: 'orgId and action are required' },
        { status: 400 }
      )
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const transfer = await db.stockTransfer.findFirst({
      where: { id, organizationId: orgId }
    })
    if (!transfer) {
      return NextResponse.json({ error: 'Stock transfer not found' }, { status: 404 })
    }

    const validActions = ['approve', 'cancel', 'complete']
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be approve, cancel, or complete' },
        { status: 400 }
      )
    }

    // Validate state transitions
    if (action === 'approve' && transfer.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending transfers can be approved' },
        { status: 400 }
      )
    }
    if (action === 'cancel' && !['pending', 'approved', 'in_transit'].includes(transfer.status)) {
      return NextResponse.json(
        { error: 'Only pending, approved, or in_transit transfers can be cancelled' },
        { status: 400 }
      )
    }
    if (action === 'complete' && !['approved', 'in_transit'].includes(transfer.status)) {
      return NextResponse.json(
        { error: 'Only approved or in_transit transfers can be completed' },
        { status: 400 }
      )
    }

    // Update the transfer status
    let newStatus: string
    switch (action) {
      case 'approve':
        newStatus = 'approved'
        break
      case 'cancel':
        newStatus = 'cancelled'
        break
      case 'complete':
        newStatus = 'completed'
        break
      default:
        newStatus = transfer.status
    }

    const updateData: Record<string, unknown> = { status: newStatus }
    if (action === 'approve') {
      updateData.approvedById = user.id
    }
    if (action === 'complete') {
      updateData.completedAt = new Date()
    }

    await db.stockTransfer.update({
      where: { id },
      data: updateData,
    })

    // When completing a transfer: update product quantities and create stock movements
    if (action === 'complete') {
      // Find or create the product at the fromShop
      const fromProduct = await db.product.findFirst({
        where: {
          id: transfer.productId,
          organizationId: orgId,
          shopId: transfer.fromShopId,
        }
      })

      if (fromProduct) {
        const previousStockFrom = fromProduct.quantity
        const newStockFrom = Math.max(0, previousStockFrom - transfer.quantity)

        // Update fromShop product quantity
        await db.product.update({
          where: { id: fromProduct.id },
          data: { quantity: newStockFrom },
        })

        // Create stock movement for fromShop (out)
        await db.stockMovement.create({
          data: {
            organizationId: orgId,
            shopId: transfer.fromShopId,
            productId: transfer.productId,
            type: 'out',
            quantity: transfer.quantity,
            previousStock: previousStockFrom,
            newStock: newStockFrom,
            reason: 'Stock transfer out',
            reference: `transfer-${id}`,
          },
        })
      }

      // Find or create the product at the toShop
      const toProduct = await db.product.findFirst({
        where: {
          id: transfer.productId,
          organizationId: orgId,
          shopId: transfer.toShopId,
        }
      })

      if (toProduct) {
        const previousStockTo = toProduct.quantity
        const newStockTo = previousStockTo + transfer.quantity

        // Update toShop product quantity
        await db.product.update({
          where: { id: toProduct.id },
          data: { quantity: newStockTo },
        })

        // Create stock movement for toShop (in)
        await db.stockMovement.create({
          data: {
            organizationId: orgId,
            shopId: transfer.toShopId,
            productId: transfer.productId,
            type: 'in',
            quantity: transfer.quantity,
            previousStock: previousStockTo,
            newStock: newStockTo,
            reason: 'Stock transfer in',
            reference: `transfer-${id}`,
          },
        })
      } else {
        // Product doesn't exist at toShop — create it
        const sourceProduct = await db.product.findUnique({
          where: { id: transfer.productId }
        })
        if (sourceProduct) {
          await db.product.create({
            data: {
              productTypeId: sourceProduct.productTypeId,
              organizationId: orgId,
              shopId: transfer.toShopId,
              sku: sourceProduct.sku,
              name: sourceProduct.name,
              description: sourceProduct.description,
              imageUrl: sourceProduct.imageUrl,
              quantity: transfer.quantity,
              costPrice: sourceProduct.costPrice,
              sellingPrice: sourceProduct.sellingPrice,
              lowStockThreshold: sourceProduct.lowStockThreshold,
              isActive: true,
            },
          })

          // Create stock movement for toShop (in)
          await db.stockMovement.create({
            data: {
              organizationId: orgId,
              shopId: transfer.toShopId,
              productId: transfer.productId,
              type: 'in',
              quantity: transfer.quantity,
              previousStock: 0,
              newStock: transfer.quantity,
              reason: 'Stock transfer in (new product at shop)',
              reference: `transfer-${id}`,
            },
          })
        }
      }
    }

    // Return updated transfer with relations
    const updatedTransfer = await db.stockTransfer.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        fromShop: { select: { id: true, name: true } },
        toShop: { select: { id: true, name: true } },
      }
    })

    return NextResponse.json({ transfer: updatedTransfer })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update stock transfer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/purchase-orders/[id] - Get PO with items
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const purchaseOrder = await db.purchaseOrder.findFirst({
      where: { id, organizationId: orgId },
      include: {
        supplier: { select: { id: true, name: true, phone: true, email: true } },
        shop: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, quantity: true, lowStockThreshold: true } }
          }
        },
      }
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    return NextResponse.json({ purchaseOrder })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get purchase order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/purchase-orders/[id] - Update PO status (send, confirm, receive, cancel)
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
    const { orgId, action, receivedItems } = body

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

    const purchaseOrder = await db.purchaseOrder.findFirst({
      where: { id, organizationId: orgId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } }
          }
        },
      }
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Validate state transitions
    const validActions = ['send', 'confirm', 'receive', 'cancel']
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be send, confirm, receive, or cancel' },
        { status: 400 }
      )
    }

    if (action === 'send' && purchaseOrder.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft orders can be sent' },
        { status: 400 }
      )
    }
    if (action === 'confirm' && purchaseOrder.status !== 'sent') {
      return NextResponse.json(
        { error: 'Only sent orders can be confirmed' },
        { status: 400 }
      )
    }
    if (action === 'receive' && !['confirmed', 'sent'].includes(purchaseOrder.status)) {
      return NextResponse.json(
        { error: 'Only confirmed or sent orders can be received' },
        { status: 400 }
      )
    }
    if (action === 'cancel' && !['draft', 'sent', 'confirmed'].includes(purchaseOrder.status)) {
      return NextResponse.json(
        { error: 'Only draft, sent, or confirmed orders can be cancelled' },
        { status: 400 }
      )
    }

    // Update the PO status
    let newStatus: string
    switch (action) {
      case 'send':
        newStatus = 'sent'
        break
      case 'confirm':
        newStatus = 'confirmed'
        break
      case 'receive':
        newStatus = 'received'
        break
      case 'cancel':
        newStatus = 'cancelled'
        break
      default:
        newStatus = purchaseOrder.status
    }

    await db.purchaseOrder.update({
      where: { id },
      data: { status: newStatus },
    })

    // When receiving: update product quantities and create stock movements
    if (action === 'receive') {
      const receivedQuantities: Record<string, number> = {}

      // Parse received items if provided, otherwise receive all at ordered quantity
      if (receivedItems && Array.isArray(receivedItems)) {
        for (const item of receivedItems) {
          receivedQuantities[item.itemId] = typeof item.receivedQty === 'string'
            ? parseInt(item.receivedQty, 10)
            : item.receivedQty
        }
      }

      for (const poItem of purchaseOrder.items) {
        const receivedQty = receivedQuantities[poItem.id] ?? poItem.quantity

        // Update the PO item receivedQty
        await db.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { receivedQty },
        })

        if (receivedQty <= 0) continue

        // Find or create the product at the target shop
        const shopFilter = purchaseOrder.shopId
          ? { id: poItem.productId, organizationId: orgId, shopId: purchaseOrder.shopId }
          : { id: poItem.productId, organizationId: orgId }

        const product = await db.product.findFirst({ where: shopFilter })

        if (product) {
          const previousStock = product.quantity
          const newStock = previousStock + receivedQty

          await db.product.update({
            where: { id: product.id },
            data: { quantity: newStock },
          })

          // Create stock movement
          await db.stockMovement.create({
            data: {
              organizationId: orgId,
              shopId: purchaseOrder.shopId,
              productId: poItem.productId,
              type: 'in',
              quantity: receivedQty,
              previousStock,
              newStock,
              reason: 'Purchase order received',
              reference: `po-${id}`,
            },
          })
        }
      }
    }

    // Return updated PO
    const updatedPO = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, phone: true, email: true } },
        shop: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } }
          }
        },
      }
    })

    return NextResponse.json({ purchaseOrder: updatedPO })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update purchase order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

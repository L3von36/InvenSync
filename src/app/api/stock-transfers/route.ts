import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/stock-transfers?orgId=xxx&status=xxx
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

    const status = searchParams.get('status')

    const where: Record<string, unknown> = { organizationId: orgId }
    if (status) where.status = status

    const transfers = await db.stockTransfer.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        fromShop: { select: { id: true, name: true } },
        toShop: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ transfers })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('List stock transfers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/stock-transfers
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
    const { orgId, productId, fromShopId, toShopId, quantity, notes } = body

    if (!orgId || !productId || !fromShopId || !toShopId || !quantity) {
      return NextResponse.json(
        { error: 'orgId, productId, fromShopId, toShopId, and quantity are required' },
        { status: 400 }
      )
    }

    if (fromShopId === toShopId) {
      return NextResponse.json(
        { error: 'Source and destination shops must be different' },
        { status: 400 }
      )
    }

    const parsedQty = typeof quantity === 'string' ? parseInt(quantity, 10) : quantity
    if (isNaN(parsedQty) || parsedQty < 1) {
      return NextResponse.json(
        { error: 'Quantity must be a positive integer' },
        { status: 400 }
      )
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify the product belongs to the org
    const product = await db.product.findFirst({
      where: { id: productId, organizationId: orgId }
    })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Verify shops belong to the org
    const shops = await db.shop.findMany({
      where: { id: { in: [fromShopId, toShopId] }, organizationId: orgId }
    })
    if (shops.length < 2) {
      return NextResponse.json({ error: 'Invalid source or destination shop' }, { status: 400 })
    }

    const transfer = await db.stockTransfer.create({
      data: {
        organizationId: orgId,
        productId,
        fromShopId,
        toShopId,
        quantity: parsedQty,
        status: 'pending',
        requestedById: user.id,
        notes: notes || null,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        fromShop: { select: { id: true, name: true } },
        toShop: { select: { id: true, name: true } },
      }
    })

    return NextResponse.json({ transfer }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Create stock transfer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

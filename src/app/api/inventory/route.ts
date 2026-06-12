import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'
import { cache, CacheNamespaces, CacheTTL } from '@/lib/cache'

// GET /api/inventory?orgId=xxx - Stock overview
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

    const shopId = searchParams.get('shopId')

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'inventory')
      if (moduleError) return moduleError
    }

    // Build where clauses based on shopId
    // Prisma doesn't allow null inside `in` arrays, so use AND + OR instead
    const productWhere = {
      organizationId: orgId,
      isActive: true,
      ...(shopId ? { AND: [{ OR: [{ shopId }, { shopId: null }] }] } : {}),
    }

    const movementWhere = {
      organizationId: orgId,
      ...(shopId ? { shopId } : {}),
    }

    // Use SWR cache for inventory overview (reduces DB load on repeated requests)
    const cacheKey = `${orgId}:${shopId || 'all'}`
    const cached = await cache.swr(
      CacheNamespaces.BUSINESS_INVENTORY,
      cacheKey,
      async () => {
        const [outOfStock, allProducts, recentMovements] = await Promise.all([
          db.product.count({
            where: { ...productWhere, quantity: 0 }
          }),
          db.product.findMany({
            where: productWhere,
            select: { id: true, name: true, quantity: true, costPrice: true, sellingPrice: true, lowStockThreshold: true, productType: { select: { id: true, name: true } } }
          }),
          db.stockMovement.findMany({
            where: movementWhere,
            include: {
              product: { select: { id: true, name: true, sku: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
        ])

        // Calculate stats from allProducts (since SQLite can't compare fields in queries)
        const totalCostValue = allProducts.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0)
        const totalRetailValue = allProducts.reduce((sum, p) => sum + (p.quantity * p.sellingPrice), 0)
        const totalProducts = allProducts.length
        const lowStock = allProducts.filter(p => p.quantity > 0 && p.quantity <= p.lowStockThreshold).length
        const lowStockProducts = allProducts
          .filter(p => p.quantity <= p.lowStockThreshold)
          .sort((a, b) => a.quantity - b.quantity)
          .slice(0, 20)

        return {
          overview: {
            totalProducts,
            outOfStock,
            lowStock,
            totalCostValue,
            totalRetailValue,
          },
          lowStockProducts,
          recentMovements,
        }
      },
      { ttl: CacheTTL.HOT, staleTtl: CacheTTL.WARM } // 15s fresh, 30s stale
    )

    return NextResponse.json(cached, {
      headers: {
        'Cache-Control': 'private, max-age=15, stale-while-revalidate=30',
      }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Inventory overview error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/inventory - Add stock movement
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
    const { orgId, productId, type, reason, reference, shopId } = body

    // Ensure quantity is properly parsed (form may send strings)
    const quantity = typeof body.quantity === 'string' ? parseInt(body.quantity, 10) : body.quantity

    if (!orgId || !productId || !type || quantity === undefined) {
      return NextResponse.json(
        { error: 'orgId, productId, type, and quantity are required' },
        { status: 400 }
      )
    }

    if (!['in', 'out', 'transfer', 'adjustment'].includes(type)) {
      return NextResponse.json({ error: 'Invalid movement type' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'inventory')
      if (moduleError) return moduleError
    }

    const product = await db.product.findFirst({
      where: { id: productId, organizationId: orgId }
    })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const previousStock = product.quantity
    let newStock: number

    if (type === 'in') {
      newStock = previousStock + quantity
    } else if (type === 'out') {
      newStock = Math.max(0, previousStock - quantity)
    } else {
      // adjustment - quantity is the new absolute value
      newStock = quantity
    }

    // Wrap stock movement creation + product update in a transaction
    // to prevent race conditions (TOCTOU on quantity, partial writes)
    const movement = await db.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          organizationId: orgId,
          shopId: shopId || null,
          productId,
          type,
          quantity,
          previousStock,
          newStock,
          reason: reason || null,
          reference: reference || null,
        }
      })

      await tx.product.update({
        where: { id: productId },
        data: { quantity: newStock }
      })

      return movement
    })

    return NextResponse.json({ movement }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Add stock movement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

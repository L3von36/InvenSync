import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'
import { cache, CacheNamespaces, CacheTTL } from '@/lib/cache'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

// GET /api/reports?orgId=xxx&type=daily|weekly|monthly&startDate=xxx&endDate=xxx&shopId=xxx
export async function GET(request: Request) {
  // Rate limit reports endpoint — stricter tier for expensive aggregation queries (10 req/min per user/IP)
  const rateLimitResult = applyRateLimit(request, RateLimitTiers.ADMIN)
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

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

    const shopIdRaw = searchParams.get('shopId')
    const shopId = (shopIdRaw && shopIdRaw !== 'undefined' && shopIdRaw !== 'null') ? shopIdRaw : undefined

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'reports')
      if (moduleError) return moduleError
    }

    const type = searchParams.get('type') || 'daily' // daily, weekly, monthly
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const now = new Date()
    const defaultEnd = now
    let defaultStart: Date

    switch (type) {
      case 'weekly':
        defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'monthly':
        defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      default: // daily
        defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }

    const periodStart = startDate ? new Date(startDate) : defaultStart
    const periodEnd = endDate ? new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000) : defaultEnd

    // Use SWR cache for reports (expensive aggregation queries)
    const cacheKey = `${orgId}:${shopId || 'all'}:${type}:${startDate || 'default'}:${endDate || 'default'}`

    const data = await cache.swr(
      CacheNamespaces.BUSINESS_DASHBOARD,
      `report:${cacheKey}`,
      () => fetchReportData(orgId, shopId, type, periodStart, periodEnd),
      { ttl: CacheTTL.WARM, staleTtl: CacheTTL.COLD } // 30s fresh, 5min stale
    )

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=300',
      }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Reports error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function fetchReportData(
  orgId: string,
  shopId: string | undefined,
  type: string,
  periodStart: Date,
  periodEnd: Date
) {
  // Build sale where clause with optional shopId filter
  const saleWhere = {
    organizationId: orgId,
    saleDate: { gte: periodStart, lte: periodEnd },
    status: 'completed' as const,
    ...(shopId ? { shopId } : {}),
  }

  const productWhere = {
    organizationId: orgId,
    isActive: true,
    ...(shopId ? { AND: [{ OR: [{ shopId }, { shopId: null }] }] } : {}),
  }

  // OPTIMIZATION: Run all independent queries in parallel
  // Previously: sequential queries (sales → groupBy → N+1 product fetch → inventory)
  // Now: All independent queries run concurrently
  const [
    saleAggregates,
    salesForBreakdown,
    paymentMethodBreakdown,
    saleItemsForCogs,
    bestSellingProducts,
    inventoryProducts,
  ] = await Promise.all([
    // Aggregate sale totals (much faster than fetching all sales with items)
    db.sale.aggregate({
      where: saleWhere,
      _sum: { total: true, discount: true, tax: true },
      _count: true,
    }),

    // Sales for daily breakdown (only needed fields, no items include)
    db.sale.findMany({
      where: saleWhere,
      select: { total: true, saleDate: true },
      orderBy: { saleDate: 'asc' },
    }),

       // Payment method breakdown
    db.sale.groupBy({
      by: ['paymentMethod'],
      where: saleWhere,
      _count: true,
      _sum: { total: true },
    }),

    // Sale items for COGS calculation (only needed fields)
    db.saleItem.findMany({
      where: { sale: saleWhere },
      select: { costPrice: true, quantity: true, total: true, sale: { select: { saleDate: true } } },
    }),

    // Best-selling products
    db.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          organizationId: orgId,
          saleDate: { gte: periodStart, lte: periodEnd },
          status: 'completed',
          ...(shopId ? { shopId } : {}),
        }
      },
      _sum: { total: true, quantity: true },
      _count: true,
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),

    // Inventory valuation
    db.product.findMany({
      where: productWhere,
      select: { name: true, quantity: true, costPrice: true, sellingPrice: true },
    }),
  ])

  // OPTIMIZATION: Batch fetch best-selling product names instead of N+1
  // Previously: Promise.all(items.map(async () => db.product.findUnique())) — N+1 pattern
  // Now: Single query with { id: { in: [...] } }
  const bestSellingIds = bestSellingProducts.map(item => item.productId).filter(Boolean) as string[]
  const bestSellingProductMap = bestSellingIds.length > 0
    ? new Map(
        (await db.product.findMany({
          where: { id: { in: bestSellingIds } },
          select: { id: true, name: true, sku: true, sellingPrice: true }
        })).map(p => [p.id, p])
      )
    : new Map<string, { id: string; name: string; sku: string | null; sellingPrice: number }>()

  const bestSellingWithDetails = bestSellingProducts.map(item => {
    const product = bestSellingProductMap.get(item.productId)
    return {
      id: item.productId,
      name: product?.name || 'Unknown',
      sku: product?.sku || null,
      sellingPrice: product?.sellingPrice || 0,
      totalRevenue: item._sum.total || 0,
      totalQuantity: item._sum.quantity || 0,
      salesCount: item._count,
    }
  })

  // Group sales by date using lightweight data
  const salesByDate: Record<string, { revenue: number; cost: number; profit: number; count: number }> = {}

  // Build a date → cost map from saleItems for COGS per day
  const costByDate = new Map<string, number>()
  for (const item of saleItemsForCogs) {
    const dateKey = item.sale.saleDate.toISOString().split('T')[0]
    costByDate.set(dateKey, (costByDate.get(dateKey) || 0) + (item.costPrice * item.quantity))
  }

  for (const sale of salesForBreakdown) {
    const dateKey = sale.saleDate.toISOString().split('T')[0]
    if (!salesByDate[dateKey]) {
      salesByDate[dateKey] = { revenue: 0, cost: 0, profit: 0, count: 0 }
    }
    salesByDate[dateKey].revenue += sale.total
    salesByDate[dateKey].count += 1
    salesByDate[dateKey].cost += costByDate.get(dateKey) || 0
    salesByDate[dateKey].profit += sale.total - (costByDate.get(dateKey) || 0)
  }

  const inventoryValuation = {
    totalItems: inventoryProducts.reduce((sum, p) => sum + p.quantity, 0),
    totalCostValue: inventoryProducts.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0),
    totalRetailValue: inventoryProducts.reduce((sum, p) => sum + (p.quantity * p.sellingPrice), 0),
    potentialProfit: inventoryProducts.reduce((sum, p) => sum + (p.quantity * (p.sellingPrice - p.costPrice)), 0),
  }

  // Summary from aggregates (no need to iterate all sales)
  const totalRevenue = saleAggregates._sum.total || 0
  const totalCost = saleItemsForCogs.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0)

  // Format salesByDate as salesByPeriod with period field for consistency
  const salesByPeriod = Object.entries(salesByDate).map(([date, data]) => ({
    period: date,
    revenue: data.revenue,
    cost: data.cost,
    profit: data.profit,
    count: data.count,
  }))

  return {
    period: { start: periodStart, end: periodEnd, type },
    summary: {
      totalRevenue,
      totalCost,
      totalProfit: totalRevenue - totalCost,
      totalSales: saleAggregates._count || 0,
      averageSaleValue: saleAggregates._count > 0 ? totalRevenue / saleAggregates._count : 0,
    },
    salesByPeriod,
    salesByDate: Object.entries(salesByDate).map(([date, data]) => ({
      date,
      ...data,
    })),
    bestSellingProducts: bestSellingWithDetails,
    paymentMethodBreakdown: paymentMethodBreakdown.map(item => ({
      method: item.paymentMethod || 'cash',
      count: item._count,
      revenue: item._sum.total || 0,
    })),
    inventoryValuation,
  }
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'
import { cache, CacheNamespaces, CacheTTL } from '@/lib/cache'

// GET /api/analytics/profit-loss?organizationId=xxx&from=DATE&to=DATE
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    const now = new Date()
    const fromDate = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), now.getMonth(), 1)
    const toDate = toParam ? new Date(toParam) : now

    // Ensure toDate includes the full day
    toDate.setHours(23, 59, 59, 999)

    // Use SWR cache for analytics (expensive aggregation queries)
    const cacheKey = `${organizationId}:${fromParam || 'default'}:${toParam || 'default'}`
    
    const data = await cache.swr(
      CacheNamespaces.AI_BUSINESS_ASSISTANT, // Reuse analytics namespace
      `pnl:${cacheKey}`,
      () => fetchProfitLossData(organizationId, fromDate, toDate),
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
    console.error('Profit & Loss error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function fetchProfitLossData(organizationId: string, fromDate: Date, toDate: Date) {
  // OPTIMIZATION: Use parallel queries with selective fields instead of fetching all data
  // Previously: fetch ALL sales with items (N+1 pattern with includes), then reduce in memory
  // Now: Fetch sale summaries and sale items separately, using aggregation for totals
  
  const saleWhere = {
    organizationId,
    status: 'completed' as const,
    saleDate: { gte: fromDate, lte: toDate },
  }

  const expenseWhere = {
    organizationId,
    expenseDate: { gte: fromDate, lte: toDate },
  }

  // Run all independent queries in parallel
  const [
    saleAggregates,
    saleItemsForCogs,
    salesForBreakdown,
    expenseAggregates,
    expensesForBreakdown,
    topProductGroups,
  ] = await Promise.all([
    // Aggregate sale totals (much faster than fetching all sales)
    db.sale.aggregate({
      where: saleWhere,
      _sum: { total: true, discount: true, tax: true },
      _count: true,
    }),

    // COGS: fetch only needed fields from sale items
    db.saleItem.findMany({
      where: { sale: saleWhere },
      select: { costPrice: true, quantity: true, total: true, productId: true, sale: { select: { saleDate: true } } },
    }),

    // Sales for monthly/daily breakdown (only needed fields)
    db.sale.findMany({
      where: saleWhere,
      select: { total: true, saleDate: true },
    }),

    // Expense aggregates
    db.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
    }),

    // Expenses for breakdown
    db.expense.findMany({
      where: expenseWhere,
      select: { amount: true, category: true, expenseDate: true },
    }),

    // Top products by profit (batch approach instead of N+1)
    db.saleItem.groupBy({
      by: ['productId'],
      where: { sale: saleWhere },
      _sum: { total: true, costPrice: true, quantity: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    }),
  ])

  // Calculate totals
  const totalRevenue = saleAggregates._sum.total || 0
  const totalDiscount = saleAggregates._sum.discount || 0
  const totalTax = saleAggregates._sum.tax || 0

  // Calculate COGS from items
  const costOfGoods = saleItemsForCogs.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0)

  const totalExpenses = expenseAggregates._sum.amount || 0
  const grossProfit = totalRevenue - costOfGoods
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
  const netProfit = grossProfit - totalExpenses

  // Monthly breakdown - combine sale and expense data
  const monthlyMap = new Map<string, { revenue: number; cost: number; expenses: number }>()

  // Group sales by month
  const salesByMonth = new Map<string, { revenue: number; saleIds: Set<string> }>()
  for (const sale of salesForBreakdown) {
    const monthKey = sale.saleDate.toISOString().slice(0, 7)
    const existing = salesByMonth.get(monthKey) || { revenue: 0, saleIds: new Set<string>() }
    existing.revenue += sale.total
    salesByMonth.set(monthKey, existing)
    
    const monthData = monthlyMap.get(monthKey) || { revenue: 0, cost: 0, expenses: 0 }
    monthData.revenue += sale.total
    monthlyMap.set(monthKey, monthData)
  }

  // Group COGS by month from saleItems
  for (const item of saleItemsForCogs) {
    const monthKey = item.sale.saleDate.toISOString().slice(0, 7)
    const monthData = monthlyMap.get(monthKey) || { revenue: 0, cost: 0, expenses: 0 }
    monthData.cost += item.costPrice * item.quantity
    monthlyMap.set(monthKey, monthData)
  }

  // Group expenses by month
  for (const expense of expensesForBreakdown) {
    const monthKey = expense.expenseDate.toISOString().slice(0, 7)
    const monthData = monthlyMap.get(monthKey) || { revenue: 0, cost: 0, expenses: 0 }
    monthData.expenses += expense.amount
    monthlyMap.set(monthKey, monthData)
  }

  const monthlyBreakdown = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      revenue: Math.round(data.revenue * 100) / 100,
      cost: Math.round(data.cost * 100) / 100,
      expenses: Math.round(data.expenses * 100) / 100,
      profit: Math.round((data.revenue - data.cost - data.expenses) * 100) / 100,
    }))

  // Expense breakdown by category
  const expenseByCategory = new Map<string, number>()
  for (const expense of expensesForBreakdown) {
    const current = expenseByCategory.get(expense.category) || 0
    expenseByCategory.set(expense.category, current + expense.amount)
  }
  const expenseBreakdown = Array.from(expenseByCategory.entries())
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)

  // Profit trend (daily) - using the lightweight sale data + COGS items
  const dailyMap = new Map<string, { revenue: number; cost: number; expenses: number }>()
  
  for (const sale of salesForBreakdown) {
    const dayKey = sale.saleDate.toISOString().slice(0, 10)
    const existing = dailyMap.get(dayKey) || { revenue: 0, cost: 0, expenses: 0 }
    existing.revenue += sale.total
    dailyMap.set(dayKey, existing)
  }
  
  for (const item of saleItemsForCogs) {
    const dayKey = item.sale.saleDate.toISOString().slice(0, 10)
    const existing = dailyMap.get(dayKey) || { revenue: 0, cost: 0, expenses: 0 }
    existing.cost += item.costPrice * item.quantity
    dailyMap.set(dayKey, existing)
  }
  
  for (const expense of expensesForBreakdown) {
    const dayKey = expense.expenseDate.toISOString().slice(0, 10)
    const existing = dailyMap.get(dayKey) || { revenue: 0, cost: 0, expenses: 0 }
    existing.expenses += expense.amount
    dailyMap.set(dayKey, existing)
  }

  const profitTrend = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      profit: Math.round((data.revenue - data.cost - data.expenses) * 100) / 100,
      grossProfit: Math.round((data.revenue - data.cost) * 100) / 100,
    }))

  // Top profitable products - batch fetch product names instead of N+1
  const topProductIds = topProductGroups.map(item => item.productId).filter(Boolean) as string[]
  const topProductMap = topProductIds.length > 0
    ? new Map(
        (await db.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true, sku: true }
        })).map(p => [p.id, p])
      )
    : new Map<string, { id: string; name: string; sku: string | null }>()

  const topProducts = topProductGroups.map(item => {
    const product = item.productId ? topProductMap.get(item.productId) : undefined
    const revenue = item._sum.total || 0
    const cost = (item._sum.costPrice || 0) * (item._sum.quantity || 0)
    return {
      id: item.productId,
      name: product?.name || 'Unknown',
      sku: product?.sku || null,
      revenue: Math.round(revenue * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      profit: Math.round((revenue - cost) * 100) / 100,
      quantity: item._sum.quantity || 0,
      margin: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 10000) / 100 : 0,
    }
  }).sort((a, b) => b.profit - a.profit)

  return {
    revenue: Math.round(totalRevenue * 100) / 100,
    costOfGoods: Math.round(costOfGoods * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossMargin: Math.round(grossMargin * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    expenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    monthlyBreakdown,
    expenseBreakdown,
    profitTrend,
    topProducts,
  }
}

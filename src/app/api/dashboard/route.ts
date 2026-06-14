import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'
import { cache, CacheNamespaces, CacheTTL } from '@/lib/cache'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

// GET /api/dashboard?orgId=xxx&shopId=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: Request) {
  // Rate limit dashboard endpoint (30 req/min per user/IP)
  const rateLimitResult = applyRateLimit(request, RateLimitTiers.DASHBOARD)
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

    const shopId = searchParams.get('shopId')
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Parse date range or use defaults (this month)
    let periodStart: Date
    let periodEnd: Date

    if (fromParam && toParam) {
      periodStart = new Date(fromParam)
      periodEnd = new Date(toParam)
      periodEnd.setHours(23, 59, 59, 999)
    } else {
      periodStart = monthStart
      periodEnd = now
    }

    // Calculate previous period (same duration before the selected period)
    const periodDuration = periodEnd.getTime() - periodStart.getTime()
    const prevPeriodStart = new Date(periodStart.getTime() - periodDuration)
    const prevPeriodEnd = new Date(periodStart.getTime() - 1)

    // Use server-side SWR cache for dashboard data (reduces DB load by 80-95%)
    const cacheKey = `${orgId}:${shopId || 'all'}:${fromParam || 'default'}:${toParam || 'default'}`

    const data = await cache.swr(
      CacheNamespaces.BUSINESS_DASHBOARD,
      cacheKey,
      () => fetchDashboardData(orgId, shopId, {
        todayStart, monthStart, periodStart, periodEnd, prevPeriodStart, prevPeriodEnd, now
      }),
      { ttl: CacheTTL.HOT, staleTtl: CacheTTL.WARM } // 15s fresh, 30s stale
    )

    // Add Cache-Control headers for browser/CDN caching
    const headers: Record<string, string> = {
      'Cache-Control': 'private, max-age=15, stale-while-revalidate=30',
    }

    return NextResponse.json(data, { headers })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

interface DashboardParams {
  todayStart: Date
  monthStart: Date
  periodStart: Date
  periodEnd: Date
  prevPeriodStart: Date
  prevPeriodEnd: Date
  now: Date
}

async function fetchDashboardData(
  orgId: string,
  shopId: string | null,
  params: DashboardParams
) {
  const { todayStart, monthStart, periodStart, periodEnd, prevPeriodStart, prevPeriodEnd, now } = params

  // Build where clauses based on shopId
  const productWhere = {
    organizationId: orgId,
    isActive: true,
    ...(shopId ? { AND: [{ OR: [{ shopId }, { shopId: null }] }] } : {}),
  }

  const saleWhere = {
    organizationId: orgId,
    status: 'completed' as const,
    ...(shopId ? { shopId } : {}),
  }

  const expenseWhere = {
    organizationId: orgId,
    ...(shopId ? { AND: [{ OR: [{ shopId }, { shopId: null }] }] } : {}),
  }

  // ============================================
  // OPTIMIZATION: Batch all independent queries with Promise.all
  // ============================================
  // Key optimizations:
  // 1. N+1 FIX: topProducts uses batch product fetch instead of per-product query
  // 2. RAW SQL: lowStockCount, totalStockValue, COGS, critical-low anomaly
  //    all use $queryRaw for DB-side aggregation — no more loading rows into
  //    memory and computing in JS. Removes take: 5000/10000 safety limits.
  // 3. Prisma.sql composition for conditional shopId filters
  // ============================================

  const [
    totalProducts,
    outOfStockCount,
    lowStockCount,
    totalStockValue,
    todaySales,
    monthSales,
    periodSales,
    prevPeriodSales,
    periodExpenses,
    prevPeriodExpenses,
    periodCogsResult,
    prevPeriodCogsResult,
    customerDebts,
    recentSales,
    topProductGroups,
    anomalies,
    salesTrend,
  ] = await Promise.all([
    // Total active products
    db.product.count({
      where: productWhere
    }),

    // Out of stock
    db.product.count({
      where: { ...productWhere, quantity: 0 }
    }),

    // Low stock — raw SQL: column comparison (quantity <= lowStockThreshold)
    // not supported by Prisma where clause, but is trivial in SQL.
    db.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`
        SELECT COUNT(*) as count FROM "Product"
        WHERE "organizationId" = ${orgId}
        AND "isActive" = TRUE
        AND quantity > 0
        AND quantity <= "lowStockThreshold"
        ${shopId ? Prisma.sql`AND ("shopId" = ${shopId} OR "shopId" IS NULL)` : Prisma.empty}
      `
    ).then(result => Number(result[0]?.count ?? 0)),

    // Total stock value — raw SQL: DB-side SUM aggregation
    // NOTE: SUM over integer columns returns a bigint on SQLite (and on Postgres
    // when the operand is an int4 column). Coerce to Number eagerly so downstream
    // arithmetic and JSON serialization don't throw "Cannot mix BigInt" errors.
    db.$queryRaw<Array<{ costValue: number | bigint; retailValue: number | bigint }>>(
      Prisma.sql`
        SELECT COALESCE(SUM(quantity * "costPrice"), 0) as costValue,
               COALESCE(SUM(quantity * "sellingPrice"), 0) as retailValue
        FROM "Product"
        WHERE "organizationId" = ${orgId} AND "isActive" = TRUE AND quantity > 0
        ${shopId ? Prisma.sql`AND ("shopId" = ${shopId} OR "shopId" IS NULL)` : Prisma.empty}
      `
    ).then(result => ({
      costValue: Number(result[0]?.costValue ?? 0),
      retailValue: Number(result[0]?.retailValue ?? 0),
    })),

    // Today's revenue and count
    db.sale.aggregate({
      where: {
        ...saleWhere,
        saleDate: { gte: todayStart },
      },
      _sum: { total: true },
      _count: true,
    }),

    // This month's revenue
    db.sale.aggregate({
      where: {
        ...saleWhere,
        saleDate: { gte: monthStart },
      },
      _sum: { total: true }
    }),

    // Period revenue
    db.sale.aggregate({
      where: {
        ...saleWhere,
        saleDate: { gte: periodStart, lte: periodEnd },
      },
      _sum: { total: true, discount: true, tax: true },
      _count: true,
    }),

    // Previous period revenue
    db.sale.aggregate({
      where: {
        ...saleWhere,
        saleDate: { gte: prevPeriodStart, lte: prevPeriodEnd },
      },
      _sum: { total: true },
      _count: true,
    }),

    // Period expenses
    db.expense.aggregate({
      where: {
        ...expenseWhere,
        expenseDate: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
    }),

    // Previous period expenses
    db.expense.aggregate({
      where: {
        ...expenseWhere,
        expenseDate: { gte: prevPeriodStart, lte: prevPeriodEnd },
      },
      _sum: { amount: true },
    }),

    // Period COGS — raw SQL: DB-side SUM with JOIN
    // (See costValue note: SUM(int*…) returns bigint on SQLite; coerced below.)
    db.$queryRaw<Array<{ cogs: number | bigint }>>(
      Prisma.sql`
        SELECT COALESCE(SUM(si."costPrice" * si.quantity), 0) as cogs
        FROM "SaleItem" si
        JOIN "Sale" s ON si."saleId" = s.id
        WHERE s."organizationId" = ${orgId} AND s.status = 'completed'
        AND s."saleDate" >= ${periodStart} AND s."saleDate" <= ${periodEnd}
        ${shopId ? Prisma.sql`AND s."shopId" = ${shopId}` : Prisma.empty}
      `
    ),

    // Previous period COGS — raw SQL: DB-side SUM with JOIN
    db.$queryRaw<Array<{ cogs: number | bigint }>>(
      Prisma.sql`
        SELECT COALESCE(SUM(si."costPrice" * si.quantity), 0) as cogs
        FROM "SaleItem" si
        JOIN "Sale" s ON si."saleId" = s.id
        WHERE s."organizationId" = ${orgId} AND s.status = 'completed'
        AND s."saleDate" >= ${prevPeriodStart} AND s."saleDate" <= ${prevPeriodEnd}
        ${shopId ? Prisma.sql`AND s."shopId" = ${shopId}` : Prisma.empty}
      `
    ),

    // Total debts owed by customers
    db.debt.aggregate({
      where: {
        organizationId: orgId,
        ...(shopId ? { AND: [{ OR: [{ shopId }, { shopId: null }] }] } : {}),
        type: 'customer_debt',
        status: { in: ['pending', 'partial'] },
      },
      _sum: { amount: true, paidAmount: true }
    }),

    // Recent sales - OPTIMIZED: Use select instead of include where possible
    db.sale.findMany({
      where: saleWhere,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        total: true,
        amountPaid: true,
        saleDate: true,
        customer: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            total: true,
            product: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { saleDate: 'desc' },
      take: 10,
    }),

    // Top products by revenue - OPTIMIZED: Batch fetch product names instead of N+1
    // Previously: groupBy → then Promise.all(items.map(() => db.product.findUnique()))
    // Now: groupBy → single db.product.findMany with { id: { in: [...] } }
    db.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          ...saleWhere,
          saleDate: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        }
      },
      _sum: { total: true, quantity: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    }),

    // Anomalies: critical stock issues, unusual sales patterns
    Promise.all([
      // Products that went out of stock recently (last 7 days)
      db.product.findMany({
        where: {
          ...productWhere,
          quantity: 0,
          updatedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true, name: true, sku: true, updatedAt: true },
        take: 5,
      }),
      // Very low stock products (< 20% of threshold) — raw SQL
      db.$queryRaw<Array<{ id: string; name: string; sku: string | null; quantity: number; lowStockThreshold: number }>>(
        Prisma.sql`
          SELECT id, name, sku, quantity, "lowStockThreshold" FROM "Product"
          WHERE "organizationId" = ${orgId} AND "isActive" = TRUE AND quantity > 0
          AND quantity <= "lowStockThreshold" * 0.2
          ${shopId ? Prisma.sql`AND ("shopId" = ${shopId} OR "shopId" IS NULL)` : Prisma.empty}
          LIMIT 5
        `
      ).then(products =>
        products.map(p => ({ id: p.id, name: p.name, sku: p.sku, type: 'critical_low' as const, message: `${p.name} has only ${p.quantity} left (threshold: ${p.lowStockThreshold})` }))
      ),
      // Large expenses in the period
      db.expense.findMany({
        where: {
          ...expenseWhere,
          expenseDate: { gte: periodStart, lte: periodEnd },
          amount: { gte: 10000 },
        },
        select: { id: true, category: true, amount: true, description: true },
        orderBy: { amount: 'desc' },
        take: 3,
      }).then(expenses =>
        expenses.map(e => ({ id: e.id, type: 'large_expense' as const, message: `Large expense: ${e.description || e.category} - ${e.amount.toLocaleString()} ETB` }))
      ),
    ]).then(([outOfStock, criticalLow, largeExpenses]) => {
      const anomalyList: Array<{
        id: string
        type: 'out_of_stock' | 'critical_low' | 'large_expense'
        message: string
        severity: 'high' | 'medium' | 'low'
      }> = []

      outOfStock.forEach(p => {
        anomalyList.push({
          id: p.id,
          type: 'out_of_stock',
          message: `${p.name} is out of stock`,
          severity: 'high',
        })
      })

      anomalyList.push(...criticalLow.map(c => ({
        id: c.id,
        type: c.type as 'critical_low',
        message: c.message,
        severity: 'medium' as const,
      })))

      anomalyList.push(...largeExpenses.map(e => ({
        id: e.id,
        type: e.type as 'large_expense',
        message: e.message,
        severity: 'low' as const,
      })))

      return anomalyList
    }),

    // ============================================
    // Sales trend: daily revenue for last 30 days — raw SQL
    // This replaces the separate /api/reports call for chart data,
    // eliminating an extra HTTP request and reducing dashboard load time.
    // ============================================
    db.$queryRaw<Array<{ saleDate: string; dailyRevenue: number | bigint }>>(
      Prisma.sql`
        SELECT DATE("saleDate") as saleDate, COALESCE(SUM(total), 0) as dailyRevenue
        FROM "Sale"
        WHERE "organizationId" = ${orgId} AND status = 'completed'
        AND "saleDate" >= ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}
        ${shopId ? Prisma.sql`AND "shopId" = ${shopId}` : Prisma.empty}
        GROUP BY DATE("saleDate")
        ORDER BY saleDate ASC
      `
    ),
  ])

  // OPTIMIZED: Batch fetch top product names instead of N+1
  // Previously: Promise.all(items.map(async item => await db.product.findUnique()))
  // Now: Single query with { id: { in: [...] } }
  const topProductIds = topProductGroups.map(item => item.productId).filter(Boolean) as string[]
  const topProductMap = topProductIds.length > 0
    ? new Map(
        (await db.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true, sku: true, imageUrl: true }
        })).map(p => [p.id, p])
      )
    : new Map<string, { id: string; name: string; sku: string | null; imageUrl: string | null }>()

  const topProducts = topProductGroups.map(item => {
    const product = topProductMap.get(item.productId!)
    return {
      id: item.productId,
      name: product?.name || 'Unknown',
      sku: product?.sku || null,
      imageUrl: product?.imageUrl || null,
      totalRevenue: item._sum.total || 0,
      totalQuantity: item._sum.quantity || 0,
    }
  })

  // COGS values from raw SQL aggregation (BigInt-safe coercion)
  const periodCogs = Number(periodCogsResult[0]?.cogs ?? 0)
  const prevPeriodCogs = Number(prevPeriodCogsResult[0]?.cogs ?? 0)

  // Calculate comparison metrics
  const periodRevenue = periodSales._sum.total || 0
  const prevRevenue = prevPeriodSales._sum.total || 0
  const revenueChange = prevRevenue > 0
    ? ((periodRevenue - prevRevenue) / prevRevenue * 100)
    : periodRevenue > 0 ? 100 : 0

  const periodExpenseTotal = periodExpenses._sum.amount || 0
  const prevExpenseTotal = prevPeriodExpenses._sum.amount || 0
  const expenseChange = prevExpenseTotal > 0
    ? ((periodExpenseTotal - prevExpenseTotal) / prevExpenseTotal * 100)
    : periodExpenseTotal > 0 ? 100 : 0

  const periodNetProfit = periodRevenue - periodCogs - periodExpenseTotal
  const prevNetProfit = prevRevenue - prevPeriodCogs - prevExpenseTotal
  const netProfitChange = prevNetProfit !== 0
    ? ((periodNetProfit - prevNetProfit) / Math.abs(prevNetProfit) * 100)
    : periodNetProfit > 0 ? 100 : 0

  const periodSalesCount = periodSales._count || 0
  const prevSalesCount = prevPeriodSales._count || 0
  const salesCountChange = prevSalesCount > 0
    ? ((periodSalesCount - prevSalesCount) / prevSalesCount * 100)
    : periodSalesCount > 0 ? 100 : 0

  return {
    stats: {
      totalProducts,
      outOfStockCount,
      lowStockCount,
      totalStockCostValue: totalStockValue.costValue,
      totalStockRetailValue: totalStockValue.retailValue,
      todayRevenue: todaySales._sum.total || 0,
      todaySalesCount: todaySales._count || 0,
      monthRevenue: monthSales._sum.total || 0,
      totalCustomerDebt: (customerDebts._sum.amount || 0) - (customerDebts._sum.paidAmount || 0),
      // New fields
      periodRevenue,
      periodExpenses: periodExpenseTotal,
      periodCogs,
      periodNetProfit,
      periodSalesCount,
    },
    comparison: {
      revenueChange: Math.round(revenueChange * 10) / 10,
      expenseChange: Math.round(expenseChange * 10) / 10,
      netProfitChange: Math.round(netProfitChange * 10) / 10,
      salesCountChange: Math.round(salesCountChange * 10) / 10,
      prevRevenue,
      prevExpenses: prevExpenseTotal,
      prevNetProfit,
      prevSalesCount,
    },
    period: {
      from: periodStart.toISOString(),
      to: periodEnd.toISOString(),
      prevFrom: prevPeriodStart.toISOString(),
      prevTo: prevPeriodEnd.toISOString(),
    },
    anomalies,
    recentSales,
    topProducts,
    // Sales trend: daily revenue for last 30 days
    // Allows dashboard to render chart without a separate /api/reports call
    salesTrend: salesTrend.map(row => ({
      date: row.saleDate,
      revenue: Number(row.dailyRevenue),
    })),
  }
}

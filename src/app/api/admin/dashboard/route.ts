import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { cache, CacheNamespaces, CacheTTL } from '@/lib/cache'
import { applyRateLimit, RateLimitTiers, getRateLimitHeaders } from '@/lib/rate-limit'
import { circuitBreakers, withTimeout } from '@/lib/resilience'
import { isDatabaseError } from '@/lib/api-error'

// ============================================
// Admin Dashboard API — Netflix/Google/YouTube Optimized
// ============================================

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const rateLimitResult = applyRateLimit(request, RateLimitTiers.DASHBOARD, user.id)
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!
    }

    const { searchParams } = new URL(request.url)
    const regionId = searchParams.get('regionId') || undefined

    const cacheKey = regionId || 'global'

    const data = await cache.swr(
      CacheNamespaces.ADMIN_DASHBOARD,
      cacheKey,
      () => withTimeout(
        () => circuitBreakers.database.execute(() => fetchDashboardData(regionId)),
        15_000,
        'Dashboard query timed out'
      ),
      { ttl: CacheTTL.HOT, staleTtl: CacheTTL.WARM }
    )

    const headers: Record<string, string> = {
      'Cache-Control': 'private, max-age=15, stale-while-revalidate=30',
      ...getRateLimitHeaders(rateLimitResult.remaining, Date.now() + 30_000),
    }

    return NextResponse.json(data, { headers })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================
// Optimized data fetching
// ============================================

async function fetchDashboardData(regionId?: string) {
  const orgWhere = regionId ? { regionId } : {}

  // Fetch org IDs for region once, reuse everywhere
  let orgIdsInRegion: string[] | undefined
  if (regionId) {
    const orgsInRegion = await db.organization.findMany({
      where: { regionId },
      select: { id: true }
    })
    orgIdsInRegion = orgsInRegion.map(o => o.id)
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1)

  const orgFilter = orgIdsInRegion
    ? (orgIdsInRegion.length > 0
      ? { in: orgIdsInRegion }
      : { in: [] as string[] })
    : undefined

  const [
    totalOrganizations,
    totalUsers,
    totalProducts,
    totalShops,
    completedSales,
    newShopsThisMonth,
    activeSubscriptions,
    orgsByType,
    salesTeamData,
    // Financials
    thisMonthSalesData,
    lastMonthSalesData,
    thisMonthExpenses,
    // Engagement
    activeOrgsToday,
    activeOrgsThisWeek,
    orgsWithPendingDebt,
    totalCustomerDebt,
  ] = await Promise.all([
    db.organization.count({ where: orgWhere }),

    regionId && orgIdsInRegion && orgIdsInRegion.length > 0
      ? db.organizationMember.findMany({
          where: { organizationId: { in: orgIdsInRegion } },
          select: { userId: true },
        }).then(members => new Set(members.map(m => m.userId)).size)
      : regionId && orgIdsInRegion && orgIdsInRegion.length === 0
        ? 0
        : db.user.count(),

    orgIdsInRegion && orgIdsInRegion.length > 0
      ? db.product.count({ where: { organizationId: { in: orgIdsInRegion } } })
      : orgIdsInRegion && orgIdsInRegion.length === 0
        ? 0
        : db.product.count(),

    orgIdsInRegion && orgIdsInRegion.length > 0
      ? db.shop.count({ where: { organizationId: { in: orgIdsInRegion } } })
      : orgIdsInRegion && orgIdsInRegion.length === 0
        ? 0
        : db.shop.count(),

    // Sales data for 12 months (for charts + total revenue)
    db.sale.findMany({
      where: {
        status: 'completed',
        saleDate: { gte: twelveMonthsAgo() },
        ...(orgFilter ? { organizationId: orgFilter } : {}),
      },
      select: { total: true, saleDate: true, organizationId: true }
    }),

    db.organization.count({
      where: { createdAt: { gte: thisMonthStart }, ...orgWhere }
    }),

    db.organization.groupBy({
      by: ['subscriptionPlan'],
      where: { subscriptionStatus: 'active', ...orgWhere },
      _count: { subscriptionPlan: true }
    }),

    db.organization.groupBy({
      by: ['businessType'],
      where: orgWhere,
      _count: { businessType: true }
    }),

    Promise.all([
      db.salesRep.count({ where: { isActive: true } }),
      db.salesRep.findMany({
        where: { isActive: true },
        include: { _count: { select: { registrations: true } } },
      }),
      db.organization.count({
        where: { referredById: { not: null }, createdAt: { gte: thisMonthStart } },
      }),
    ]),

    // This month sales (revenue + count)
    db.sale.aggregate({
      where: {
        status: 'completed',
        saleDate: { gte: thisMonthStart },
        ...(orgFilter ? { organizationId: orgFilter } : {}),
      },
      _sum: { total: true },
      _count: true,
    }),

    // Last month sales (revenue + count)
    db.sale.aggregate({
      where: {
        status: 'completed',
        saleDate: { gte: lastMonthStart, lt: lastMonthEnd },
        ...(orgFilter ? { organizationId: orgFilter } : {}),
      },
      _sum: { total: true },
      _count: true,
    }),

    // This month expenses
    db.expense.aggregate({
      where: {
        expenseDate: { gte: thisMonthStart },
        ...(orgFilter ? { organizationId: orgFilter } : {}),
      },
      _sum: { amount: true },
    }),

    // Active orgs today (orgs with at least one completed sale today)
    orgIdsInRegion
      ? (orgIdsInRegion.length > 0
          ? db.sale.findMany({
              where: {
                status: 'completed',
                saleDate: { gte: todayStart },
                organizationId: { in: orgIdsInRegion },
              },
              select: { organizationId: true },
              distinct: ['organizationId'],
            }).then(rows => rows.length)
          : 0)
      : db.sale.findMany({
          where: { status: 'completed', saleDate: { gte: todayStart } },
          select: { organizationId: true },
          distinct: ['organizationId'],
        }).then(rows => rows.length),

    // Active orgs this week
    orgIdsInRegion
      ? (orgIdsInRegion.length > 0
          ? db.sale.findMany({
              where: {
                status: 'completed',
                saleDate: { gte: weekStart },
                organizationId: { in: orgIdsInRegion },
              },
              select: { organizationId: true },
              distinct: ['organizationId'],
            }).then(rows => rows.length)
          : 0)
      : db.sale.findMany({
          where: { status: 'completed', saleDate: { gte: weekStart } },
          select: { organizationId: true },
          distinct: ['organizationId'],
        }).then(rows => rows.length),

    // Orgs with pending debt
    db.debt.groupBy({
      by: ['organizationId'],
      where: {
        type: 'customer_debt',
        status: { in: ['pending', 'partial'] },
        ...(orgFilter ? { organizationId: orgFilter } : {}),
      },
    }).then(rows => rows.length),

    // Total outstanding customer debt
    db.debt.aggregate({
      where: {
        type: 'customer_debt',
        status: { in: ['pending', 'partial'] },
        ...(orgFilter ? { organizationId: orgFilter } : {}),
      },
      _sum: { amount: true, paidAmount: true },
    }),
  ])

  // ====== Derived computations ======
  const totalRevenue = completedSales.reduce((sum, s) => sum + s.total, 0)

  // Financials
  const thisMonthRevenue = Number(thisMonthSalesData._sum.total || 0)
  const lastMonthRevenue = Number(lastMonthSalesData._sum.total || 0)
  const revenueChange = lastMonthRevenue > 0
    ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10
    : thisMonthRevenue > 0 ? 100 : 0

  const thisMonthExpensesTotal = Number(thisMonthExpenses._sum.amount || 0)
  const thisMonthNetProfit = thisMonthRevenue - thisMonthExpensesTotal

  const thisMonthSalesCount = Number(thisMonthSalesData._count || 0)
  const lastMonthSalesCount = Number(lastMonthSalesData._count || 0)
  const salesCountChange = lastMonthSalesCount > 0
    ? Math.round(((thisMonthSalesCount - lastMonthSalesCount) / lastMonthSalesCount) * 1000) / 10
    : thisMonthSalesCount > 0 ? 100 : 0

  // Engagement
  const avgRevenuePerOrg = totalOrganizations > 0
    ? Math.round(thisMonthRevenue / totalOrganizations)
    : 0
  const totalCustomerDebtOutstanding =
    Number(totalCustomerDebt._sum.amount || 0) - Number(totalCustomerDebt._sum.paidAmount || 0)

  // Subscriptions
  const activeSubscriptionsByPlan = activeSubscriptions.reduce<Record<string, number>>((acc, item) => {
    acc[item.subscriptionPlan] = item._count.subscriptionPlan
    return acc
  }, {})

  // Business type distribution
  const organizationsByBusinessType = orgsByType.reduce<Record<string, number>>((acc, item) => {
    acc[item.businessType] = item._count.businessType
    return acc
  }, {})

  // Revenue by month (last 6 months)
  const revenueByMonth: { month: string; revenue: number }[] = []
  const salesByMonth: { month: string; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const monthSales = completedSales.filter(s => s.saleDate >= monthStart && s.saleDate < monthEnd)
    revenueByMonth.push({
      month: monthStart.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      revenue: monthSales.reduce((sum, s) => sum + s.total, 0),
    })
    salesByMonth.push({
      month: monthStart.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      count: monthSales.length,
    })
  }

  // Top shops by revenue
  const orgRevenueMap = new Map<string, number>()
  completedSales.forEach(s => {
    orgRevenueMap.set(s.organizationId, (orgRevenueMap.get(s.organizationId) || 0) + s.total)
  })

  const topOrgIds = [...orgRevenueMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  const topOrgs = topOrgIds.length > 0
    ? await db.organization.findMany({
        where: { id: { in: topOrgIds } },
        select: { id: true, name: true, businessType: true, city: true }
      })
    : []

  const topShopsByRevenue = topOrgIds.map(id => {
    const org = topOrgs.find(o => o.id === id)
    return {
      id,
      name: org?.name || 'Unknown',
      businessType: org?.businessType || 'retail',
      city: org?.city || null,
      totalRevenue: orgRevenueMap.get(id) || 0,
    }
  })

  // Sales team stats
  const [activeSalesReps, salesRepsWithRegistrations, registrationsThisMonth] = salesTeamData
  const totalRegistrationsByReps = salesRepsWithRegistrations.reduce(
    (sum, rep) => sum + rep._count.registrations, 0
  )

  // Region breakdown
  const [regionInfo, regionsBreakdown] = await Promise.all([
    regionId
      ? db.region.findUnique({
          where: { id: regionId },
          select: { id: true, name: true, slug: true }
        })
      : null,
    fetchRegionsBreakdown(),
  ])

  return {
    totalOrganizations,
    totalUsers,
    totalShops,
    totalRevenue,
    totalProducts,
    newShopsThisMonth,

    // Financials
    thisMonthRevenue,
    lastMonthRevenue,
    revenueChange,
    thisMonthExpenses: thisMonthExpensesTotal,
    thisMonthNetProfit,
    thisMonthSalesCount,
    lastMonthSalesCount,
    salesCountChange,

    // Engagement
    activeOrgsToday,
    activeOrgsThisWeek,
    orgsWithPendingDebt,
    avgRevenuePerOrg,
    totalCustomerDebt: totalCustomerDebtOutstanding,

    // Distribution
    activeSubscriptions: activeSubscriptionsByPlan,
    organizationsByBusinessType,

    // Charts
    revenueByMonth,
    salesByMonth,
    topShopsByRevenue,

    // Sales team
    salesTeam: {
      activeReps: activeSalesReps,
      totalRegistrationsByReps,
      registrationsThisMonth,
    },

    // Region
    regionInfo,
    regionsBreakdown,
  }
}

// ============================================
// Regions breakdown — cached separately
// ============================================

async function fetchRegionsBreakdown() {
  return cache.swr(
    CacheNamespaces.ADMIN_REGIONS,
    'breakdown',
    async () => {
      const orgCounts = await db.organization.groupBy({
        by: ['regionId'],
        _count: { regionId: true },
        where: { regionId: { not: null } },
      })

      const revenueByOrg = await db.sale.groupBy({
        by: ['organizationId'],
        where: {
          status: 'completed',
          saleDate: { gte: twelveMonthsAgo() },
        },
        _sum: { total: true },
      })

      const allOrgs = await db.organization.findMany({
        where: { regionId: { not: null } },
        select: { id: true, regionId: true },
      })
      const orgRegionMap = new Map<string, string>()
      allOrgs.forEach(org => {
        if (org.regionId) orgRegionMap.set(org.id, org.regionId)
      })

      const regionRevenueMap = new Map<string, number>()
      revenueByOrg.forEach(item => {
        const rid = orgRegionMap.get(item.organizationId)
        if (rid) {
          regionRevenueMap.set(rid, (regionRevenueMap.get(rid) || 0) + (item._sum.total || 0))
        }
      })

      const allRegions = await db.region.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { order: 'asc' },
      })

      const orgCountMap = new Map(
        orgCounts.map(item => [item.regionId as string, item._count.regionId])
      )

      return allRegions.map(region => ({
        regionId: region.id,
        regionName: region.name,
        orgCount: orgCountMap.get(region.id) || 0,
        revenue: regionRevenueMap.get(region.id) || 0,
      }))
    },
    { ttl: CacheTTL.WARM, staleTtl: CacheTTL.COLD }
  )
}

// ============================================
// Utility functions
// ============================================

function twelveMonthsAgo(): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - 12)
  return d
}
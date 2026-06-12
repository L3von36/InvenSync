import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { cache, CacheNamespaces, CacheTTL } from '@/lib/cache'
import { applyRateLimit, RateLimitTiers, getRateLimitHeaders } from '@/lib/rate-limit'
import { circuitBreakers, withTimeout } from '@/lib/resilience'
import { isDatabaseError } from '@/lib/api-error'

// ============================================
// Admin Dashboard API — Netflix/Google/YouTube Optimized
// ============================================
// Patterns applied:
// 1. Netflix EVCache: Multi-layer server-side cache with SWR
// 2. Google API: Rate limiting with token bucket
// 3. Netflix Hystrix: Circuit breaker for DB operations
// 4. YouTube: Optimized queries to reduce N+1
// 5. Google: HTTP cache headers for client-side caching
// 6. Netflix: Bulkhead (timeout) to prevent hanging

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Google Pattern: Rate limiting
    const rateLimitResult = applyRateLimit(request, RateLimitTiers.DASHBOARD, user.id)
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!
    }

    const { searchParams } = new URL(request.url)
    const regionId = searchParams.get('regionId') || undefined

    // Netflix Pattern: Server-side SWR cache
    // Cache key includes regionId so different regions get different cache entries
    const cacheKey = regionId || 'global'

    const data = await cache.swr(
      CacheNamespaces.ADMIN_DASHBOARD,
      cacheKey,
      () => withTimeout(
        () => circuitBreakers.database.execute(() => fetchDashboardData(regionId)),
        15_000, // 15s timeout (Netflix pattern: fail fast)
        'Dashboard query timed out'
      ),
      { ttl: CacheTTL.HOT, staleTtl: CacheTTL.WARM } // 15s fresh, 30s stale
    )

    // Google Pattern: Cache-Control headers for browser/CDN caching
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
// Optimized data fetching (YouTube pattern: minimize DB round-trips)
// ============================================

async function fetchDashboardData(regionId?: string) {
  // Build org-level where clause based on region filter
  const orgWhere = regionId ? { regionId } : {}

  // YouTube Pattern: Fetch org IDs for region ONCE, reuse everywhere
  // This eliminates N+1 queries that plagued the regions breakdown
  let orgIdsInRegion: string[] | undefined
  if (regionId) {
    const orgsInRegion = await db.organization.findMany({
      where: { regionId },
      select: { id: true }
    })
    orgIdsInRegion = orgsInRegion.map(o => o.id)
  }

  // YouTube Pattern: Batch all independent queries with Promise.all
  // Netflix Pattern: Select only needed fields to reduce payload
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
  ] = await Promise.all([
    // Org count
    db.organization.count({ where: orgWhere }),

    // User count (via org memberships for region filter)
    regionId && orgIdsInRegion && orgIdsInRegion.length > 0
      ? db.organizationMember.findMany({
          where: { organizationId: { in: orgIdsInRegion } },
          select: { userId: true },
        }).then(members => new Set(members.map(m => m.userId)).size)
      : regionId && orgIdsInRegion && orgIdsInRegion.length === 0
        ? 0
        : db.user.count(),

    // Product count (via organizationId IN, NOT via organization relation)
    orgIdsInRegion && orgIdsInRegion.length > 0
      ? db.product.count({ where: { organizationId: { in: orgIdsInRegion } } })
      : orgIdsInRegion && orgIdsInRegion.length === 0
        ? 0
        : db.product.count(),

    // Shop count
    orgIdsInRegion && orgIdsInRegion.length > 0
      ? db.shop.count({ where: { organizationId: { in: orgIdsInRegion } } })
      : orgIdsInRegion && orgIdsInRegion.length === 0
        ? 0
        : db.shop.count(),

    // Sales data (single query, compute everything in memory - YouTube pattern)
    db.sale.findMany({
      where: {
        status: 'completed',
        saleDate: { gte: twelveMonthsAgo() },
        ...(orgIdsInRegion ? {
          organizationId: orgIdsInRegion.length > 0
            ? { in: orgIdsInRegion }
            : 'impossible' as unknown as undefined
        } : {}),
      },
      select: { total: true, saleDate: true, organizationId: true }
    }),

    // New shops this month
    db.organization.count({
      where: { createdAt: { gte: startOfMonth() }, ...orgWhere }
    }),

    // Active subscriptions by plan
    db.organization.groupBy({
      by: ['subscriptionPlan'],
      where: { subscriptionStatus: 'active', ...orgWhere },
      _count: { subscriptionPlan: true }
    }),

    // Organizations by business type
    db.organization.groupBy({
      by: ['businessType'],
      where: orgWhere,
      _count: { businessType: true }
    }),

    // Sales team data (batched)
    Promise.all([
      db.salesRep.count({ where: { isActive: true } }),
      db.salesRep.findMany({
        where: { isActive: true },
        include: { _count: { select: { registrations: true } } },
      }),
      db.organization.count({
        where: {
          referredById: { not: null },
          createdAt: { gte: startOfMonth() },
        }
      }),
    ]),
  ])

  // Compute derived data in memory (YouTube pattern: compute once, not per-DB-query)
  const totalRevenue = completedSales.reduce((sum, s) => sum + s.total, 0)

  const activeSubscriptionsByPlan = activeSubscriptions.reduce<Record<string, number>>((acc, item) => {
    acc[item.subscriptionPlan] = item._count.subscriptionPlan
    return acc
  }, {})

  const organizationsByBusinessType = orgsByType.reduce<Record<string, number>>((acc, item) => {
    acc[item.businessType] = item._count.businessType
    return acc
  }, {})

  // YouTube Pattern: Compute revenue by month from already-fetched data
  // No additional DB query needed!
  const now = new Date()
  const revenueByMonth: { month: string; revenue: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const monthSales = completedSales.filter(s => s.saleDate >= monthStart && s.saleDate < monthEnd)
    revenueByMonth.push({
      month: monthStart.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      revenue: monthSales.reduce((sum, s) => sum + s.total, 0)
    })
  }

  // Top shops by revenue (computed from already-fetched sales)
  const orgRevenueMap = new Map<string, number>()
  completedSales.forEach(s => {
    orgRevenueMap.set(s.organizationId, (orgRevenueMap.get(s.organizationId) || 0) + s.total)
  })

  const topOrgIds = [...orgRevenueMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  // Only fetch org names for top 10 (minimal additional query)
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

  // Netflix Pattern: Batch region breakdown into a single optimized query
  // instead of N+1 queries per region
  const [regionInfo, regionsBreakdown] = await Promise.all([
    regionId
      ? db.region.findUnique({
          where: { id: regionId },
          select: { id: true, name: true, slug: true }
        })
      : null,
    fetchRegionsBreakdown(orgIdsInRegion),
  ])

  return {
    totalOrganizations,
    totalUsers,
    totalShops,
    totalRevenue,
    totalProducts,
    newShopsThisMonth,
    activeSubscriptions: activeSubscriptionsByPlan,
    organizationsByBusinessType,
    revenueByMonth,
    topShopsByRevenue,
    salesTeam: {
      activeReps: activeSalesReps,
      totalRegistrationsByReps,
      registrationsThisMonth,
    },
    regionInfo,
    regionsBreakdown,
  }
}

// ============================================
// YouTube Pattern: Optimized regions breakdown
// Single query with GROUP BY instead of N+1 queries per region
// ============================================

async function fetchRegionsBreakdown(_orgIdsInRegion?: string[]) {
  // Netflix Pattern: Cache the regions breakdown separately since it's expensive
  return cache.swr(
    CacheNamespaces.ADMIN_REGIONS,
    'breakdown',
    async () => {
      // YouTube Pattern: Single GROUP BY query instead of N separate queries
      const orgCounts = await db.organization.groupBy({
        by: ['regionId'],
        _count: { regionId: true },
        where: { regionId: { not: null } },
      })

      // Revenue per region using sales with org join
      const revenueByRegion = await db.sale.groupBy({
        by: ['organizationId'],
        where: {
          status: 'completed',
          saleDate: { gte: twelveMonthsAgo() },
        },
        _sum: { total: true },
      })

      // Get org-to-region mapping
      const orgRegionMap = new Map<string, string>()
      const allOrgs = await db.organization.findMany({
        where: { regionId: { not: null } },
        select: { id: true, regionId: true },
      })
      allOrgs.forEach(org => {
        if (org.regionId) orgRegionMap.set(org.id, org.regionId)
      })

      // Compute revenue by region in memory
      const regionRevenueMap = new Map<string, number>()
      revenueByRegion.forEach(item => {
        const regionId = orgRegionMap.get(item.organizationId)
        if (regionId) {
          regionRevenueMap.set(regionId, (regionRevenueMap.get(regionId) || 0) + (item._sum.total || 0))
        }
      })

      // Get all regions
      const allRegions = await db.region.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { order: 'asc' },
      })

      // Combine in memory
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

function startOfMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

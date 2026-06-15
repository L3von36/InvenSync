import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { cache, CacheNamespaces, CacheTTL } from '@/lib/cache'
import { applyRateLimit, RateLimitTiers, getRateLimitHeaders } from '@/lib/rate-limit'
import { circuitBreakers } from '@/lib/resilience'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/admin/regions - List all regions with stats (admin only)
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    // Google Pattern: Rate limiting
    const rateLimitResult = applyRateLimit(request, RateLimitTiers.LIST, user.id)
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const includeStats = searchParams.get('includeStats') !== 'false'

    // Netflix Pattern: Cache regions list (cold cache - rarely changes)
    const cacheKey = `list:${search}:${includeStats}`

    const data = await cache.swr(
      CacheNamespaces.ADMIN_REGIONS,
      cacheKey,
      () => circuitBreakers.database.execute(() =>
        fetchRegionsList(search, includeStats)
      ),
      { ttl: CacheTTL.COLD, staleTtl: CacheTTL.STATIC }
    )

    // Google Pattern: Cache-Control headers
    const headers: Record<string, string> = {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      ...getRateLimitHeaders(rateLimitResult.remaining, Date.now() + 60_000),
    }

    return NextResponse.json(data, { headers })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin list regions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// YouTube Pattern: Optimized region fetching with batched queries
async function fetchRegionsList(search: string, includeStats: boolean) {
  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { slug: { contains: search } },
      { country: { contains: search } },
    ]
  }

  const regions = await db.region.findMany({
    where,
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      organizations: {
        select: {
          id: true,
          name: true,
          slug: true,
          businessType: true,
          createdAt: true,
          _count: { select: { members: true, shops: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
      _count: { select: { organizations: true } },
    },
  })

  if (!includeStats) {
    return {
      regions: regions.map(region => ({
        id: region.id,
        name: region.name,
        slug: region.slug,
        country: region.country,
        latitude: region.latitude,
        longitude: region.longitude,
        population: region.population,
        description: region.description,
        isActive: region.isActive,
        order: region.order,
        createdAt: region.createdAt.toISOString(),
        updatedAt: region.updatedAt.toISOString(),
      })),
    }
  }

  // YouTube Pattern: Batch all region stats computation
  // Get all org IDs per region first
  const regionOrgIds = await db.organization.findMany({
    where: { regionId: { in: regions.map(r => r.id) } },
    select: { id: true, regionId: true },
  })

  const orgIdsByRegion = new Map<string, string[]>()
  regionOrgIds.forEach(org => {
    if (org.regionId) {
      const ids = orgIdsByRegion.get(org.regionId) || []
      ids.push(org.id)
      orgIdsByRegion.set(org.regionId, ids)
    }
  })

  // YouTube Pattern: Single batch query for all org members (not N per region)
  const allOrgIds = regionOrgIds.map(o => o.id)
  const [allMembers, allShops, allRevenue] = await Promise.all([
    allOrgIds.length > 0
      ? db.organizationMember.findMany({
          where: { organizationId: { in: allOrgIds } },
          select: { organizationId: true, userId: true },
        })
      : [],
    allOrgIds.length > 0
      ? db.shop.groupBy({
          by: ['organizationId'],
          where: { organizationId: { in: allOrgIds } },
          _count: { organizationId: true },
        })
      : [],
    allOrgIds.length > 0
      ? db.sale.groupBy({
          by: ['organizationId'],
          where: {
            organizationId: { in: allOrgIds },
            status: 'completed',
          },
          _sum: { total: true },
        })
      : [],
  ])

  // Compute per-region stats in memory
  const membersByOrg = new Map<string, Set<string>>()
  allMembers.forEach(m => {
    const set = membersByOrg.get(m.organizationId) || new Set<string>()
    set.add(m.userId)
    membersByOrg.set(m.organizationId, set)
  })

  const shopsByOrg = new Map<string, number>()
  allShops.forEach(s => {
    shopsByOrg.set(s.organizationId, s._count.organizationId)
  })

  const revenueByOrg = new Map<string, number>()
  allRevenue.forEach(r => {
    revenueByOrg.set(r.organizationId, r._sum.total ?? 0)
  })

  // Assemble region stats from computed data
  const regionsWithStats = regions.map(region => {
    const orgIds = orgIdsByRegion.get(region.id) || []
    const userCount = new Set(
      orgIds.flatMap(id => [...(membersByOrg.get(id) || [])])
    ).size
    const shopCount = orgIds.reduce((sum, id) => sum + (shopsByOrg.get(id) || 0), 0)
    const revenue = orgIds.reduce((sum, id) => sum + (revenueByOrg.get(id) || 0), 0)

    return {
      id: region.id,
      name: region.name,
      slug: region.slug,
      country: region.country,
      latitude: region.latitude,
      longitude: region.longitude,
      population: region.population,
      description: region.description,
      isActive: region.isActive,
      order: region.order,
      createdAt: region.createdAt.toISOString(),
      updatedAt: region.updatedAt.toISOString(),
      orgCount: region._count.organizations,
      userCount,
      shopCount,
      revenue,
      recentOrgs: region.organizations.map(org => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        businessType: org.businessType,
        createdAt: org.createdAt.toISOString(),
        memberCount: org._count.members,
        shopCount: org._count.shops,
      })),
    }
  })

  return { regions: regionsWithStats }
}

// POST /api/admin/regions - Create a new region (admin only)
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    // Google Pattern: Stricter rate limit for mutations
    const rateLimitResult = applyRateLimit(request, RateLimitTiers.MUTATION, user.id)
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { name, slug, country, latitude, longitude, population, description, order } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }

    // Check uniqueness
    const existingName = await db.region.findUnique({ where: { name: name.trim() } })
    if (existingName) {
      return NextResponse.json({ error: 'A region with this name already exists' }, { status: 409 })
    }
    const existingSlug = await db.region.findUnique({ where: { slug: slug.trim() } })
    if (existingSlug) {
      return NextResponse.json({ error: 'A region with this slug already exists' }, { status: 409 })
    }

    const region = await db.region.create({
      data: {
        name: name.trim(),
        slug: slug.trim(),
        country: typeof country === 'string' ? country : 'Ethiopia',
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
        population: typeof population === 'number' ? population : null,
        description: typeof description === 'string' ? description : null,
        order: typeof order === 'number' ? order : 0,
      },
    })

    // Netflix Pattern: Invalidate caches on mutation
    cache.invalidate(CacheNamespaces.ADMIN_REGIONS)
    cache.invalidate(CacheNamespaces.ADMIN_DASHBOARD)

    return NextResponse.json({
      region: {
        id: region.id,
        name: region.name,
        slug: region.slug,
        country: region.country,
        latitude: region.latitude,
        longitude: region.longitude,
        population: region.population,
        description: region.description,
        isActive: region.isActive,
        order: region.order,
        createdAt: region.createdAt.toISOString(),
        updatedAt: region.updatedAt.toISOString(),
      },
    }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin create region error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

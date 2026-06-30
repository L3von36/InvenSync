import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

// GET /api/admin/organizations - List all organizations with module info (admin only)
export async function GET(request: Request) {
  // Rate limit admin endpoints
  const rateLimitResult = applyRateLimit(request, RateLimitTiers.ADMIN)
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const regionId = searchParams.get('regionId') || undefined

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { city: { contains: search } },
        { slug: { contains: search } },
      ]
    }
    if (regionId) {
      where.regionId = regionId
    }

    const [organizations, total] = await Promise.all([
      db.organization.findMany({
        where,
        include: {
          members: { select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } } },
          shops: { select: { id: true, name: true, city: true, isActive: true } },
          activeModules: {
            include: { module: true },
          },
          region: { select: { id: true, name: true, slug: true } },
          _count: { select: { productTypes: true, sales: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.organization.count({ where }),
    ])

    return NextResponse.json({
      organizations: organizations.map(org => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        businessType: org.businessType,
        description: org.description,
        address: org.address,
        city: org.city,
        latitude: org.latitude,
        longitude: org.longitude,
        phone: org.phone,
        subscriptionPlan: org.subscriptionPlan,
        subscriptionStatus: org.subscriptionStatus,
        createdAt: org.createdAt.toISOString(),
        region: org.region,
        memberCount: org.members.length,
        shopCount: org.shops.length,
        productCount: org._count.productTypes,
        salesCount: org._count.sales,
        members: org.members.map(m => ({
          id: m.id,
          role: m.role,
          name: m.user.name,
          email: m.user.email,
        })),
        shops: org.shops,
        modules: org.activeModules.map(om => ({
          id: om.id,
          key: om.module.key,
          name: om.module.name,
          status: om.status,
          isActive: om.isActive,
          expiresAt: om.expiresAt ? om.expiresAt.toISOString() : null,
          priceAtActivation: om.priceAtActivation,
          autoRenew: om.autoRenew,
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin list organizations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

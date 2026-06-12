import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/admin/regions/[id]/organizations - List organizations in a specific region (admin only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id } = await params

    // Verify region exists
    const region = await db.region.findUnique({ where: { id } })
    if (!region) {
      return NextResponse.json({ error: 'Region not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const businessType = searchParams.get('businessType') || ''
    const subscriptionPlan = searchParams.get('subscriptionPlan') || ''

    const where: Record<string, unknown> = { regionId: id }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { city: { contains: search } },
        { phone: { contains: search } },
      ]
    }
    if (businessType) {
      where.businessType = businessType
    }
    if (subscriptionPlan) {
      where.subscriptionPlan = subscriptionPlan
    }

    const [organizations, total] = await Promise.all([
      db.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          businessType: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          description: true,
          address: true,
          city: true,
          phone: true,
          createdAt: true,
          _count: { select: { members: true, shops: true, sales: true } },
          sales: {
            where: { status: 'completed' },
            select: { total: true },
          },
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
        subscriptionPlan: org.subscriptionPlan,
        subscriptionStatus: org.subscriptionStatus,
        description: org.description,
        address: org.address,
        city: org.city,
        phone: org.phone,
        createdAt: org.createdAt.toISOString(),
        memberCount: org._count.members,
        shopCount: org._count.shops,
        salesCount: org._count.sales,
        revenue: org.sales.reduce((sum, s) => sum + s.total, 0),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin list region organizations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

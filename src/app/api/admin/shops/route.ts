import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const businessType = searchParams.get('businessType')
    const city = searchParams.get('city')
    const subscriptionPlan = searchParams.get('subscriptionPlan')
    const search = searchParams.get('search')
    const regionId = searchParams.get('regionId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Build where clause (SQLite doesn't support mode: 'insensitive')
    const where: Record<string, unknown> = {}
    if (businessType) where.businessType = businessType
    if (city) where.city = { contains: city }
    if (subscriptionPlan) where.subscriptionPlan = subscriptionPlan
    if (regionId) where.regionId = regionId
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { city: { contains: search } },
      ]
    }

    const [organizations, total] = await Promise.all([
      db.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          businessType: true,
          city: true,
          latitude: true,
          longitude: true,
          phone: true,
          subscriptionPlan: true,
          createdAt: true,
          region: { select: { id: true, name: true, slug: true } },
          _count: {
            select: { members: true, shops: true, productTypes: true, customers: true }
          },
          sales: {
            where: { status: 'completed' },
            select: { total: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.organization.count({ where })
    ])

    const shops = organizations.map(org => ({
      id: org.id,
      name: org.name,
      businessType: org.businessType,
      city: org.city,
      latitude: org.latitude,
      longitude: org.longitude,
      phone: org.phone,
      subscriptionPlan: org.subscriptionPlan,
      createdAt: org.createdAt,
      region: org.region,
      memberCount: org._count.members,
      shopCount: org._count.shops,
      productTypeCount: org._count.productTypes,
      totalRevenue: org.sales.reduce((sum, s) => sum + s.total, 0),
    }))

    return NextResponse.json({
      shops,
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
    console.error('Admin shops error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

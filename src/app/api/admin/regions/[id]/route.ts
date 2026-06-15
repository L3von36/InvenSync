import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/admin/regions/[id] - Get single region with full stats (admin only)
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

    const region = await db.region.findUnique({
      where: { id },
      include: {
        organizations: {
          select: { id: true },
        },
        salesReps: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            _count: { select: { registrations: true, commissions: true } },
          },
          where: { isActive: true },
        },
      },
    })

    if (!region) {
      return NextResponse.json({ error: 'Region not found' }, { status: 404 })
    }

    const orgIds = region.organizations.map(o => o.id)

    const [userCount, shopCount, revenueResult, organizations, orgTotal] = await Promise.all([
      // Count unique users via OrganizationMember
      orgIds.length > 0
        ? db.organizationMember.findMany({
            where: { organizationId: { in: orgIds } },
            select: { userId: true },
          }).then(members => new Set(members.map(m => m.userId)).size)
        : 0,
      // Count shops
      db.shop.count({
        where: { organizationId: { in: orgIds } },
      }),
      // Sum of completed sales total
      orgIds.length > 0
        ? db.sale.aggregate({
            where: {
              organizationId: { in: orgIds },
              status: 'completed',
            },
            _sum: { total: true },
          }).then(result => result._sum.total ?? 0)
        : 0,
      // List of organizations (paginated - first page)
      db.organization.findMany({
        where: { regionId: id },
        select: {
          id: true,
          name: true,
          slug: true,
          businessType: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          city: true,
          createdAt: true,
          _count: { select: { members: true, shops: true, sales: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      // Total org count
      db.organization.count({ where: { regionId: id } }),
    ])

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
        orgCount: orgTotal,
        userCount,
        shopCount,
        revenue: revenueResult,
        salesReps: region.salesReps.map(rep => ({
          id: rep.id,
          userId: rep.userId,
          name: rep.user.name,
          email: rep.user.email,
          avatarUrl: rep.user.avatarUrl,
          phone: rep.phone,
          commissionRate: rep.commissionRate,
          commissionPerReg: rep.commissionPerReg,
          registrationCount: rep._count.registrations,
          commissionCount: rep._count.commissions,
          joinedAt: rep.joinedAt.toISOString(),
        })),
        organizations: organizations.map(org => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          businessType: org.businessType,
          subscriptionPlan: org.subscriptionPlan,
          subscriptionStatus: org.subscriptionStatus,
          city: org.city,
          createdAt: org.createdAt.toISOString(),
          memberCount: org._count.members,
          shopCount: org._count.shops,
          salesCount: org._count.sales,
        })),
        organizationsPagination: {
          total: orgTotal,
          showing: organizations.length,
          hasMore: orgTotal > 20,
        },
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin get region error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/regions/[id] - Update region (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id } = await params
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { name, slug, country, latitude, longitude, population, description, isActive, order } = body

    // Verify region exists
    const existing = await db.region.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Region not found' }, { status: 404 })
    }

    // Check uniqueness if name is being changed
    if (name !== undefined && name !== existing.name) {
      const existingName = await db.region.findUnique({ where: { name } })
      if (existingName) {
        return NextResponse.json({ error: 'A region with this name already exists' }, { status: 409 })
      }
    }

    // Check uniqueness if slug is being changed
    if (slug !== undefined && slug !== existing.slug) {
      const existingSlug = await db.region.findUnique({ where: { slug } })
      if (existingSlug) {
        return NextResponse.json({ error: 'A region with this slug already exists' }, { status: 409 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (slug !== undefined) updateData.slug = slug
    if (country !== undefined) updateData.country = country
    if (latitude !== undefined) updateData.latitude = latitude
    if (longitude !== undefined) updateData.longitude = longitude
    if (population !== undefined) updateData.population = population
    if (description !== undefined) updateData.description = description
    if (isActive !== undefined) updateData.isActive = isActive
    if (order !== undefined) updateData.order = order

    const region = await db.region.update({
      where: { id },
      data: updateData,
    })

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
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin update region error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/regions/[id] - Delete region (admin only)
export async function DELETE(
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
    const existing = await db.region.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Region not found' }, { status: 404 })
    }

    // Set regionId to null on all linked organizations before deleting
    await db.organization.updateMany({
      where: { regionId: id },
      data: { regionId: null },
    })

    // Set regionId to null on all linked sales reps
    await db.salesRep.updateMany({
      where: { regionId: id },
      data: { regionId: null },
    })

    // Delete the region
    await db.region.delete({ where: { id } })

    return NextResponse.json({ message: 'Region deleted successfully' })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin delete region error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

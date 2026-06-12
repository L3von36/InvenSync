import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/admin/organizations/[id] - Get org details (admin only)
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

    const org = await db.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          },
          orderBy: { joinedAt: 'asc' }
        },
        shops: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            phone: true,
            isActive: true,
            createdAt: true,
          }
        },
        activeModules: {
          include: { module: true },
          orderBy: { module: { order: 'asc' } }
        },
        sales: {
          where: { status: 'completed' },
          select: { total: true, saleDate: true, invoiceNumber: true, paymentMethod: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Calculate revenue (sum of completed sales)
    const revenue = org.sales.reduce((sum, s) => sum + s.total, 0)

    // Recent 10 sales
    const recentSales = org.sales.slice(0, 10).map(s => ({
      invoiceNumber: s.invoiceNumber,
      total: s.total,
      paymentMethod: s.paymentMethod,
      saleDate: s.saleDate.toISOString(),
      createdAt: s.createdAt.toISOString(),
    }))

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        currency: org.currency,
        country: org.country,
        businessType: org.businessType,
        description: org.description,
        address: org.address,
        city: org.city,
        latitude: org.latitude,
        longitude: org.longitude,
        phone: org.phone,
        subscriptionPlan: org.subscriptionPlan,
        subscriptionStatus: org.subscriptionStatus,
        subscriptionExpiresAt: org.subscriptionExpiresAt ? org.subscriptionExpiresAt.toISOString() : null,
        referredById: org.referredById,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
        members: org.members.map(m => ({
          id: m.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        })),
        shops: org.shops.map(s => ({
          ...s,
          createdAt: s.createdAt.toISOString(),
        })),
        modules: org.activeModules.map(om => ({
          id: om.id,
          key: om.module.key,
          name: om.module.name,
          description: om.module.description,
          icon: om.module.icon,
          category: om.module.category,
          status: om.status,
          isActive: om.isActive,
          activatedAt: om.activatedAt.toISOString(),
          expiresAt: om.expiresAt ? om.expiresAt.toISOString() : null,
          priceAtActivation: om.priceAtActivation,
          autoRenew: om.autoRenew,
        })),
        revenue,
        recentSales,
        totalSalesCount: org.sales.length,
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin get organization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/organizations/[id] - Update org (admin only)
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

    // Verify org exists
    const existing = await db.organization.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Support updating all fields for full CRUD
    const { name, businessType, description, address, city, phone, subscriptionPlan, subscriptionStatus, isActive } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (businessType !== undefined) updateData.businessType = businessType
    if (description !== undefined) updateData.description = description
    if (address !== undefined) updateData.address = address
    if (city !== undefined) updateData.city = city
    if (phone !== undefined) updateData.phone = phone
    if (subscriptionPlan !== undefined) updateData.subscriptionPlan = subscriptionPlan
    if (subscriptionStatus !== undefined) updateData.subscriptionStatus = subscriptionStatus

    // Handle isActive via subscriptionStatus mapping if provided
    if (isActive !== undefined) {
      updateData.subscriptionStatus = isActive ? 'active' : 'suspended'
    }

    const organization = await db.organization.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        businessType: organization.businessType,
        description: organization.description,
        address: organization.address,
        city: organization.city,
        phone: organization.phone,
        subscriptionPlan: organization.subscriptionPlan,
        subscriptionStatus: organization.subscriptionStatus,
        subscriptionExpiresAt: organization.subscriptionExpiresAt ? organization.subscriptionExpiresAt.toISOString() : null,
        isActive: organization.subscriptionStatus !== 'suspended',
        createdAt: organization.createdAt.toISOString(),
        updatedAt: organization.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin update organization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/organizations/[id] - Delete an organization and all its data (admin only)
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

    // Verify org exists
    const existing = await db.organization.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { members: true, shops: true, sales: true, customers: true, products: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Delete the organization — cascading deletes handle all related data
    await db.organization.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: `Organization "${existing.name}" deleted successfully along with ${existing._count.shops} shop(s), ${existing._count.members} member(s), ${existing._count.sales} sale(s), ${existing._count.customers} customer(s), and ${existing._count.products} product(s).`,
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin delete organization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

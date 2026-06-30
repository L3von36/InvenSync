import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/shops/[id] - Get a single shop
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const shop = await db.shop.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        },
        _count: {
          select: { products: true, sales: true, stockMovements: true }
        }
      }
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    const hasAccess = await verifyOrgAccess(user, shop.organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ shop })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get shop error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/shops/[id] - Update a shop
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const shop = await db.shop.findUnique({
      where: { id }
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    const hasAccess = await verifyOrgAccess(user, shop.organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses) - required for updating shops
    if (user.role !== 'admin') {
      const moduleError = await requireModule(shop.organizationId, 'multi-shop')
      if (moduleError) return moduleError
    }

    // Only owner or manager can update shops
    const membership = user.memberships.find(m => m.organizationId === shop.organizationId)
    if (!membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
      return NextResponse.json({ error: 'Insufficient permissions. Only owners and managers can update shops.' }, { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { name, address, city, latitude, longitude, phone, isActive } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (address !== undefined) updateData.address = address
    if (city !== undefined) updateData.city = city
    if (latitude !== undefined) updateData.latitude = latitude !== null ? parseFloat(String(latitude)) : null
    if (longitude !== undefined) updateData.longitude = longitude !== null ? parseFloat(String(longitude)) : null
    if (phone !== undefined) updateData.phone = phone
    if (isActive !== undefined) updateData.isActive = isActive

    const updatedShop = await db.shop.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ shop: updatedShop })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update shop error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/shops/[id] - Soft delete a shop (set isActive=false)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const shop = await db.shop.findUnique({
      where: { id }
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    const hasAccess = await verifyOrgAccess(user, shop.organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only owner can delete shops
    const membership = user.memberships.find(m => m.organizationId === shop.organizationId)
    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Insufficient permissions. Only owners can delete shops.' }, { status: 403 })
    }

    const updatedShop = await db.shop.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({
      shop: updatedShop,
      message: 'Shop deactivated successfully'
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Delete shop error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// PATCH /api/shops/[id]/members/[memberId] - Update member role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: shopId, memberId } = await params
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { orgId, role } = body

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const validRoles = ['manager', 'cashier', 'warehouse', 'sales']
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: `role is required and must be one of: ${validRoles.join(', ')}` }, { status: 400 })
    }

    // Verify shop exists and belongs to the organization
    const shop = await db.shop.findUnique({
      where: { id: shopId }
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    if (shop.organizationId !== orgId) {
      return NextResponse.json({ error: 'Shop does not belong to this organization' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only owner or manager can change roles
    const membership = user.memberships.find(m => m.organizationId === orgId)
    if (!membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
      return NextResponse.json({ error: 'Insufficient permissions. Only owners and managers can change member roles.' }, { status: 403 })
    }

    // Verify the shop member exists
    const shopMember = await db.shopMember.findUnique({
      where: { id: memberId }
    })

    if (!shopMember) {
      return NextResponse.json({ error: 'Shop member not found' }, { status: 404 })
    }

    if (shopMember.shopId !== shopId) {
      return NextResponse.json({ error: 'Member does not belong to this shop' }, { status: 400 })
    }

    const updatedMember = await db.shopMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        }
      }
    })

    return NextResponse.json({
      member: {
        id: updatedMember.id,
        userId: updatedMember.userId,
        shopId: updatedMember.shopId,
        role: updatedMember.role,
        joinedAt: updatedMember.joinedAt,
        user: updatedMember.user,
      }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update shop member error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/shops/[id]/members/[memberId] - Remove member from shop
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: shopId, memberId } = await params

    // Get orgId from query params for DELETE
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json({ error: 'orgId query parameter is required' }, { status: 400 })
    }

    // Verify shop exists and belongs to the organization
    const shop = await db.shop.findUnique({
      where: { id: shopId }
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    if (shop.organizationId !== orgId) {
      return NextResponse.json({ error: 'Shop does not belong to this organization' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only owner or manager can remove members
    const membership = user.memberships.find(m => m.organizationId === orgId)
    if (!membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
      return NextResponse.json({ error: 'Insufficient permissions. Only owners and managers can remove shop members.' }, { status: 403 })
    }

    // Verify the shop member exists
    const shopMember = await db.shopMember.findUnique({
      where: { id: memberId }
    })

    if (!shopMember) {
      return NextResponse.json({ error: 'Shop member not found' }, { status: 404 })
    }

    if (shopMember.shopId !== shopId) {
      return NextResponse.json({ error: 'Member does not belong to this shop' }, { status: 400 })
    }

    await db.shopMember.delete({
      where: { id: memberId }
    })

    return NextResponse.json({
      message: 'Member removed from shop successfully'
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Remove shop member error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

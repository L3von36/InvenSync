import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'

// POST /api/shops/[id]/members - Add a member to a shop
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: shopId } = await params
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { orgId, userId, role } = body

    if (!orgId || !userId || !role) {
      return NextResponse.json({ error: 'orgId, userId, and role are required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'multi-shop')
      if (moduleError) return moduleError
    }

    // Verify shop belongs to org
    const shop = await db.shop.findFirst({
      where: { id: shopId, organizationId: orgId }
    })
    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // Check if user is already a member of this shop
    const existing = await db.shopMember.findUnique({
      where: { userId_shopId: { userId, shopId } }
    })
    if (existing) {
      return NextResponse.json({ error: 'User is already a member of this shop' }, { status: 409 })
    }

    const member = await db.shopMember.create({
      data: { userId, shopId, role },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } }
      }
    })

    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Add shop member error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/shops/[id]/members - Update a member's role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: shopId } = await params
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { orgId, memberId, role } = body

    if (!orgId || !memberId || !role) {
      return NextResponse.json({ error: 'orgId, memberId, and role are required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'multi-shop')
      if (moduleError) return moduleError
    }

    const member = await db.shopMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } }
      }
    })

    return NextResponse.json({ member })
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

// DELETE /api/shops/[id]/members - Remove a member from a shop
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: shopId } = await params
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const memberId = searchParams.get('memberId')

    if (!orgId || !memberId) {
      return NextResponse.json({ error: 'orgId and memberId are required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'multi-shop')
      if (moduleError) return moduleError
    }

    await db.shopMember.delete({ where: { id: memberId } })

    return NextResponse.json({ message: 'Member removed from shop' })
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

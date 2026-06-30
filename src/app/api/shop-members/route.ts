import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/shop-members?orgId=xxx - Get current user's shop role for the given org
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Find the user's shop memberships for this org
    const shopMemberships = await db.shopMember.findMany({
      where: {
        userId: user.id,
        shop: { organizationId: orgId }
      },
      include: {
        shop: {
          select: { id: true, name: true, organizationId: true }
        }
      }
    })

    if (shopMemberships.length === 0) {
      return NextResponse.json({ shopRole: null, currentShopId: null, shops: [] })
    }

    // Return all shop memberships and the first one as default
    const primaryMembership = shopMemberships[0]
    const shops = shopMemberships.map(sm => ({
      shopId: sm.shop.id,
      shopName: sm.shop.name,
      role: sm.role,
    }))

    return NextResponse.json({
      shopRole: primaryMembership.role,
      currentShopId: primaryMembership.shop.id,
      shops,
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Shop members error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

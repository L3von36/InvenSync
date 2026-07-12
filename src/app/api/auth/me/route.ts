import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { db } from '@/lib/prisma'
import { isDatabaseError } from '@/lib/api-error'

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2FA status — needed by the Security settings tab. Not part of the
    // AuthUser shape, so fetch it explicitly.
    const securityInfo = await db.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true },
    })

    // Get user's shop memberships
    const shopMemberships = await db.shopMember.findMany({
      where: { userId: user.id },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            phone: true,
            isActive: true,
            organizationId: true,
          }
        }
      }
    })

    // Get active modules for each organization the user belongs to
    const orgIds = user.memberships.map(m => m.organizationId)

    const orgModules = await db.organizationModule.findMany({
      where: {
        organizationId: { in: orgIds },
        isActive: true,
      },
      include: {
        module: {
          select: {
            id: true,
            key: true,
            name: true,
            icon: true,
            category: true,
          }
        }
      }
    })

    // Group org modules by organizationId
    const modulesByOrg = orgModules.reduce((acc, om) => {
      if (!acc[om.organizationId]) {
        acc[om.organizationId] = []
      }
      acc[om.organizationId].push({
        id: om.module.id,
        key: om.module.key,
        name: om.module.name,
        icon: om.module.icon,
        category: om.module.category,
        activatedAt: om.activatedAt.toISOString(),
        expiresAt: om.expiresAt ? om.expiresAt.toISOString() : null,
      })
      return acc
    }, {} as Record<string, Array<{
      id: string
      key: string
      name: string
      icon: string
      category: string
      activatedAt: string
      expiresAt: string | null
    }>>)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        twoFactorEnabled: securityInfo?.twoFactorEnabled ?? false,
      },
      organizations: user.memberships.map(m => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        currency: m.organization.currency,
        country: m.organization.country,
        subscriptionPlan: m.organization.subscriptionPlan,
        subscriptionStatus: m.organization.subscriptionStatus,
        activeModules: modulesByOrg[m.organization.id] || [],
      })),
      shopMemberships: shopMemberships.map(sm => ({
        id: sm.id,
        role: sm.role,
        joinedAt: sm.joinedAt.toISOString(),
        shop: sm.shop,
      }))
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get current user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

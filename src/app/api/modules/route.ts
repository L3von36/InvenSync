import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { batchExpireTrials, invalidateModuleCache } from '@/lib/module-cache'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/modules?orgId=xxx - List available modules with org status
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')

    // Get all active platform modules
    const allModules = await db.module.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    })

    // Batch auto-expire trials (fast, uses bulk update)
    if (orgId) {
      const hasAccess = await verifyOrgAccess(user, orgId)
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      // Batch expire all stale trials (single query instead of N+1)
      await batchExpireTrials(db)
    }

    let orgModules: Record<string, {
      isActive: boolean
      status: string
      activatedAt: string | null
      expiresAt: string | null
      priceAtActivation: number
      autoRenew: boolean
    }> = {}

    if (orgId) {
      const activeModules = await db.organizationModule.findMany({
        where: { organizationId: orgId },
        include: { module: { select: { key: true } } }
      })

      orgModules = activeModules.reduce((acc, om) => {
        acc[om.module.key] = {
          isActive: om.isActive,
          status: om.status,
          activatedAt: om.activatedAt.toISOString(),
          expiresAt: om.expiresAt ? om.expiresAt.toISOString() : null,
          priceAtActivation: om.priceAtActivation,
          autoRenew: om.autoRenew,
        }
        return acc
      }, {} as Record<string, {
        isActive: boolean
        status: string
        activatedAt: string | null
        expiresAt: string | null
        priceAtActivation: number
        autoRenew: boolean
      }>)
    }

    return NextResponse.json({
      modules: allModules.map(m => ({
        id: m.id,
        key: m.key,
        name: m.name,
        description: m.description,
        icon: m.icon,
        category: m.category,
        priceETB: m.priceETB,
        isFree: m.isFree,
        freeTrialDays: m.freeTrialDays,
        billingCycle: m.billingCycle,
        order: m.order,
        isActive: m.isActive,
        // If orgId provided, include org-specific status
        orgStatus: orgId ? (orgModules[m.key] || null) : undefined,
      }))
    }, {
      headers: {
        // Modules rarely change - cache for 2 minutes, serve stale for 5 minutes
        'Cache-Control': orgId
          ? 'private, max-age=30, stale-while-revalidate=120'
          : 'private, max-age=120, stale-while-revalidate=300',
      }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('List modules error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

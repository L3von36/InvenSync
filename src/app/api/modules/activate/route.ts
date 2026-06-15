import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { invalidateModuleCache } from '@/lib/module-cache'
import { isDatabaseError } from '@/lib/api-error'

// POST /api/modules/activate - Activate a module for an org
// Only admin can activate paid modules. Org owners can only activate free modules.
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { orgId, moduleKey } = body

    if (!orgId || !moduleKey) {
      return NextResponse.json({ error: 'orgId and moduleKey are required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const moduleRecord = await db.module.findUnique({
      where: { key: moduleKey }
    })
    if (!moduleRecord) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }

    if (!moduleRecord.isActive) {
      return NextResponse.json({ error: 'Module is not available' }, { status: 400 })
    }

    // Only admin can activate paid modules
    if (!moduleRecord.isFree && moduleRecord.priceETB > 0 && user.role !== 'admin') {
      return NextResponse.json({
        error: 'Only the platform admin can activate paid modules. Please contact support to purchase this module.',
        requiresAdmin: true,
      }, { status: 403 })
    }

    const resolvedStatus = moduleRecord.isFree ? 'active' : 'trial'
    const days = moduleRecord.isFree ? 0 : moduleRecord.freeTrialDays
    const expiresAt = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null

    const orgModule = await db.organizationModule.upsert({
      where: {
        organizationId_moduleId: {
          organizationId: orgId,
          moduleId: moduleRecord.id,
        }
      },
      create: {
        organizationId: orgId,
        moduleId: moduleRecord.id,
        status: resolvedStatus,
        isActive: true,
        expiresAt,
        priceAtActivation: moduleRecord.priceETB,
        autoRenew: false,
      },
      update: {
        status: resolvedStatus,
        isActive: true,
        expiresAt: expiresAt || undefined,
        priceAtActivation: moduleRecord.priceETB,
      }
    })

    // Invalidate cache for this org
    invalidateModuleCache(orgId)

    return NextResponse.json({ orgModule, module: moduleRecord })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Activate module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

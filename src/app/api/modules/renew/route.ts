import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { invalidateModuleCache } from '@/lib/module-cache'
import { isDatabaseError } from '@/lib/api-error'

// POST /api/modules/renew - Renew an existing module subscription
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

    // Find the existing OrganizationModule by orgId + moduleKey, include the Module relation
    const orgModule = await db.organizationModule.findFirst({
      where: {
        organizationId: orgId,
        module: { key: moduleKey },
      },
      include: {
        module: true,
      }
    })

    if (!orgModule) {
      return NextResponse.json({ error: 'Module subscription not found' }, { status: 404 })
    }

    // Determine billing cycle from the priceAtActivation and module price
    // If priceAtActivation equals module.priceETB * 10, it's yearly; otherwise monthly
    const isYearly = orgModule.priceAtActivation === orgModule.module.priceETB * 10 && orgModule.module.priceETB > 0
    const billingCycle = isYearly ? 'yearly' : 'monthly'

    // Calculate new expiry: current expiresAt + billing period
    // If module is expired, start from now
    const now = new Date()
    const isExpired = !orgModule.expiresAt || new Date(orgModule.expiresAt) < now
    const baseDate = isExpired ? now : new Date(orgModule.expiresAt)

    const daysToAdd = billingCycle === 'yearly' ? 365 : 30
    const newExpiresAt = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)

    const updatedOrgModule = await db.organizationModule.update({
      where: { id: orgModule.id },
      data: {
        status: 'active',
        isActive: true,
        expiresAt: newExpiresAt,
        autoRenew: true,
      }
    })

    // Invalidate cache for this org
    invalidateModuleCache(orgId)

    return NextResponse.json({
      orgModule: {
        id: updatedOrgModule.id,
        status: updatedOrgModule.status,
        isActive: updatedOrgModule.isActive,
        expiresAt: updatedOrgModule.expiresAt,
      }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Renew module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { invalidateModuleCache } from '@/lib/module-cache'
import { isDatabaseError } from '@/lib/api-error'

// POST /api/modules/subscribe - Subscribe an org to a paid module
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
    const { orgId, moduleKey, billingCycle = 'monthly' } = body

    if (!orgId || !moduleKey) {
      return NextResponse.json({ error: 'orgId and moduleKey are required' }, { status: 400 })
    }

    if (billingCycle !== 'monthly' && billingCycle !== 'yearly') {
      return NextResponse.json({ error: 'billingCycle must be "monthly" or "yearly"' }, { status: 400 })
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

    // Calculate price: yearly gets 2 months free (price * 10 vs price * 12)
    const pricePerMonth = moduleRecord.priceETB
    const priceAtActivation = billingCycle === 'yearly'
      ? pricePerMonth * 10
      : pricePerMonth

    // Calculate expiry: monthly = 30 days, yearly = 365 days from now
    const daysToAdd = billingCycle === 'yearly' ? 365 : 30
    const expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000)

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
        status: 'active',
        isActive: true,
        expiresAt,
        priceAtActivation,
        autoRenew: true,
      },
      update: {
        status: 'active',
        isActive: true,
        expiresAt,
        priceAtActivation,
        autoRenew: true,
      }
    })

    // Invalidate cache for this org
    invalidateModuleCache(orgId)

    return NextResponse.json({
      orgModule: {
        id: orgModule.id,
        status: orgModule.status,
        isActive: orgModule.isActive,
        expiresAt: orgModule.expiresAt,
      }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Subscribe module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

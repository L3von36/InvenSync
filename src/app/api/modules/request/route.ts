import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { invalidateModuleCache } from '@/lib/module-cache'
import { isDatabaseError } from '@/lib/api-error'

// POST /api/modules/request - Business requests access to a module
// This creates a record that the admin can see in their dashboard
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
      return NextResponse.json(
        { error: 'orgId and moduleKey are required' },
        { status: 400 }
      )
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check module exists
    const moduleRecord = await db.module.findUnique({
      where: { key: moduleKey }
    })
    if (!moduleRecord) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }

    // Check if org already has this module
    const existing = await db.organizationModule.findUnique({
      where: {
        organizationId_moduleId: {
          organizationId: orgId,
          moduleId: moduleRecord.id,
        }
      }
    })

    if (existing && existing.status === 'active') {
      return NextResponse.json(
        { error: 'Module is already active for your organization' },
        { status: 400 }
      )
    }

    // For free modules, activate directly as permanently active (never expires)
    if (moduleRecord.isFree) {
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
          expiresAt: null,
          priceAtActivation: moduleRecord.priceETB,
          autoRenew: false,
        },
        update: {
          status: 'active',
          isActive: true,
          expiresAt: null,
          priceAtActivation: moduleRecord.priceETB,
        }
      })

      // Invalidate cache for this org
      invalidateModuleCache(orgId)

      return NextResponse.json({
        success: true,
        message: 'Free module activated successfully',
        orgModule,
      })
    }

    // For paid modules, create a request record with status "requested"
    // The admin will see this and decide to activate or not
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
        status: 'requested',
        isActive: false,
        priceAtActivation: moduleRecord.priceETB,
        autoRenew: false,
      },
      update: {
        // If previously expired/cancelled, mark as requested again
        ...(existing && ['expired', 'cancelled'].includes(existing.status)
          ? { status: 'requested', isActive: false }
          : {}),
      }
    })

    // Invalidate cache for this org
    invalidateModuleCache(orgId)

    return NextResponse.json({
      success: true,
      message: 'Module request submitted. Our team will contact you shortly.',
      orgModule,
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Module request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

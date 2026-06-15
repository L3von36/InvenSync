import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
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

    if (existing && existing.status === 'requested') {
      return NextResponse.json(
        { error: 'You have already requested this module. Our team will review it shortly.' },
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

      // Notify the org that their free module was activated
      await db.notification.create({
        data: {
          organizationId: orgId,
          type: 'subscription',
          title: 'Module Activated',
          message: `${moduleRecord.name} has been activated for your organization.`,
          actionUrl: '/modules',
          metadata: JSON.stringify({ moduleKey, status: 'active' }),
        },
      }).catch(() => {})

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

    // Notify the requesting org that their request was submitted
    await db.notification.create({
      data: {
        organizationId: orgId,
        type: 'subscription',
        title: 'Module Request Submitted',
        message: `Your request for ${moduleRecord.name} has been submitted. Our team will review it shortly.`,
        actionUrl: '/modules',
        metadata: JSON.stringify({ moduleKey, status: 'requested', orgName: '', moduleName: moduleRecord.name }),
      },
    }).catch(() => {})

    // Notify all admin users about the new module request
    // Find all admin users and their organizations to create notifications
    try {
      const adminUsers = await db.user.findMany({
        where: { role: 'admin', isActive: true },
        select: { id: true },
      })

      // Find any organization that admins belong to, so we can create notifications
      // Since notifications require an organizationId, we use the requesting org's ID
      // and set userId to each admin so only they see it
      if (adminUsers.length > 0) {
        await db.notification.createMany({
          data: adminUsers.map(admin => ({
            organizationId: orgId,
            userId: admin.id,
            type: 'subscription',
            title: 'New Module Request',
            message: `A module request for ${moduleRecord.name} has been submitted. Review and approve it from the organization details.`,
            actionUrl: '/admin-organizations',
            metadata: JSON.stringify({
              moduleKey,
              moduleName: moduleRecord.name,
              requestingOrgId: orgId,
              requestedBy: user.name,
              type: 'module_request',
            }),
          })),
        })
      }
    } catch (notifError) {
      // Notification failure should not block the request
      console.error('Failed to send admin notification for module request:', notifError)
    }

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

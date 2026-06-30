import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { invalidateModuleCache } from '@/lib/module-cache'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/admin/organizations/[id]/modules - Get org's module subscriptions (admin only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id: orgId } = await params

    const orgModules = await db.organizationModule.findMany({
      where: { organizationId: orgId },
      include: { module: true },
      orderBy: { module: { order: 'asc' } }
    })

    return NextResponse.json({
      modules: orgModules.map(om => ({
        id: om.id,
        moduleId: om.moduleId,
        key: om.module.key,
        name: om.module.name,
        description: om.module.description,
        icon: om.module.icon,
        category: om.module.category,
        priceETB: om.module.priceETB,
        isFree: om.module.isFree,
        status: om.status,
        isActive: om.isActive,
        activatedAt: om.activatedAt.toISOString(),
        expiresAt: om.expiresAt ? om.expiresAt.toISOString() : null,
        priceAtActivation: om.priceAtActivation,
        autoRenew: om.autoRenew,
      }))
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin get org modules error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/organizations/[id]/modules - Assign/activate a module for an org (admin only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id: orgId } = await params
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { moduleKey, status, durationDays, autoRenew } = body

    if (!moduleKey) {
      return NextResponse.json({ error: 'moduleKey is required' }, { status: 400 })
    }

    const moduleRecord = await db.module.findUnique({ where: { key: moduleKey } })
    if (!moduleRecord) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }

    // Check if org exists
    const org = await db.organization.findUnique({ where: { id: orgId } })
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const resolvedStatus = status || (moduleRecord.isFree ? 'active' : 'trial')
    const days = durationDays ?? (moduleRecord.isFree ? 0 : moduleRecord.freeTrialDays)
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
        autoRenew: autoRenew ?? false,
      },
      update: {
        status: resolvedStatus,
        isActive: true,
        expiresAt: expiresAt || undefined,
        priceAtActivation: moduleRecord.priceETB,
        autoRenew: autoRenew ?? false,
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
    console.error('Admin assign module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/organizations/[id]/modules - Update org module (approve request, renew, change status)
// When approving a requested module (status → 'active'), sets appropriate trial/billing dates and notifies the org
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id: orgId } = await params
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { moduleKey, status, isActive, autoRenew, durationDays } = body

    if (!moduleKey) {
      return NextResponse.json({ error: 'moduleKey is required' }, { status: 400 })
    }

    const moduleRecord = await db.module.findUnique({ where: { key: moduleKey } })
    if (!moduleRecord) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }

    const existing = await db.organizationModule.findUnique({
      where: {
        organizationId_moduleId: {
          organizationId: orgId,
          moduleId: moduleRecord.id,
        }
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Module not assigned to this organization' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (isActive !== undefined) updateData.isActive = isActive
    if (autoRenew !== undefined) updateData.autoRenew = autoRenew

    // When approving a requested module (changing from 'requested' to 'active' or 'trial')
    const isApproval = existing.status === 'requested' && (status === 'active' || status === 'trial')
    if (isApproval) {
      // Set activation date and expiry
      updateData.isActive = true
      if (moduleRecord.isFree || status === 'active') {
        // Free modules or explicitly set to active: no expiry
        updateData.expiresAt = null
      } else {
        // Trial: set trial period
        const days = durationDays ?? moduleRecord.freeTrialDays ?? 30
        updateData.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      }
    } else if (durationDays !== undefined) {
      updateData.expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
    }

    const orgModule = await db.organizationModule.update({
      where: { id: existing.id },
      data: updateData,
    })

    // Invalidate cache for this org
    invalidateModuleCache(orgId)

    // Notify the org about the approval
    if (isApproval) {
      const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true } })
      const statusLabel = orgModule.status === 'trial' ? 'activated with a trial period' : 'activated'
      await db.notification.create({
        data: {
          organizationId: orgId,
          type: 'subscription',
          title: 'Module Approved',
          message: `${moduleRecord.name} has been ${statusLabel} for your organization. You can now access it from the sidebar.`,
          actionUrl: '/modules',
          metadata: JSON.stringify({ moduleKey, status: orgModule.status, type: 'module_approved' }),
        },
      }).catch(() => {})
    }

    return NextResponse.json({ orgModule, module: moduleRecord })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin update org module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/organizations/[id]/modules - Revoke/deactivate a module from an org
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id: orgId } = await params
    const { searchParams } = new URL(request.url)
    const moduleKey = searchParams.get('moduleKey')

    if (!moduleKey) {
      return NextResponse.json({ error: 'moduleKey is required' }, { status: 400 })
    }

    const moduleRecord = await db.module.findUnique({ where: { key: moduleKey } })
    if (!moduleRecord) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }

    const orgModule = await db.organizationModule.update({
      where: {
        organizationId_moduleId: {
          organizationId: orgId,
          moduleId: moduleRecord.id,
        }
      },
      data: {
        isActive: false,
        status: 'cancelled',
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
    console.error('Admin revoke module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

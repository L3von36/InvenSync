import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { invalidateModuleCache } from '@/lib/module-cache'
import { isDatabaseError } from '@/lib/api-error'

// POST /api/modules/deactivate - Deactivate a module for an org
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
        isActive: false,
        status: 'cancelled',
        priceAtActivation: moduleRecord.priceETB,
      },
      update: {
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
    console.error('Deactivate module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

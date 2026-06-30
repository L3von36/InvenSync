import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/audit-logs - List audit logs for an organization (business users)
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const action = searchParams.get('action') || ''
    const entity = searchParams.get('entity') || ''
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    // Verify the user has access to this organization
    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - No access to this organization' }, { status: 403 })
    }

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId,
    }

    if (action) {
      where.action = action
    }

    if (entity) {
      where.entity = entity
    }

    if (from || to) {
      const createdAt: Record<string, Date> = {}
      if (from) createdAt.gte = new Date(from)
      if (to) createdAt.lte = new Date(to)
      where.createdAt = createdAt
    }

    // OPTIMIZED: Run all queries in parallel instead of sequentially
    // Previously: logs+count in parallel, then uniqueActions + uniqueEntities sequentially
    // Now: All 4 queries run in parallel
    const [logs, total, uniqueActions, uniqueEntities] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
      // Get unique actions for filter dropdowns
      db.auditLog.findMany({
        where: { organizationId },
        select: { action: true },
        distinct: ['action'],
        orderBy: { action: 'asc' },
      }),
      db.auditLog.findMany({
        where: { organizationId },
        select: { entity: true },
        distinct: ['entity'],
        orderBy: { entity: 'asc' },
      }),
    ])

    return NextResponse.json({
      logs: logs.map(log => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        details: log.details,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
        user: log.user
          ? { id: log.user.id, name: log.user.name, email: log.user.email }
          : null,
      })),
      filters: {
        actions: uniqueActions.map(a => a.action),
        entities: uniqueEntities.map(e => e.entity),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Audit logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

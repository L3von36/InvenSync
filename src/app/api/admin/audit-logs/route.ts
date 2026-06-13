import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

// GET /api/admin/audit-logs - List all audit logs (admin only, paginated)
export async function GET(request: Request) {
  // Rate limit admin endpoints
  const rateLimitResult = applyRateLimit(request, RateLimitTiers.ADMIN)
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const action = searchParams.get('action') || ''
    const entity = searchParams.get('entity') || ''
    const userId = searchParams.get('userId') || ''
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    const search = searchParams.get('search') || ''

    // Build where clause
    const where: Record<string, unknown> = {}

    if (action) {
      where.action = action
    }

    if (entity) {
      where.entity = entity
    }

    if (userId) {
      where.userId = userId
    }

    if (from || to) {
      const createdAt: Record<string, Date> = {}
      if (from) createdAt.gte = new Date(from)
      if (to) createdAt.lte = new Date(to)
      where.createdAt = createdAt
    }

    if (search) {
      where.OR = [
        { entityId: { contains: search } },
        { details: { contains: search } },
      ]
    }

    // Fetch audit logs with user info
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ])

    // Summary stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todayCount, mostActiveUser, mostChangedEntity] = await Promise.all([
      // Total actions today
      db.auditLog.count({
        where: { createdAt: { gte: today } },
      }),
      // Most active user today
      db.auditLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: today }, userId: { not: null } },
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 1,
      }),
      // Most changed entity today
      db.auditLog.groupBy({
        by: ['entity'],
        where: { createdAt: { gte: today } },
        _count: { entity: true },
        orderBy: { _count: { entity: 'desc' } },
        take: 1,
      }),
    ])

    // Get most active user's name
    let mostActiveUserName: string | null = null
    if (mostActiveUser.length > 0 && mostActiveUser[0].userId) {
      const activeUser = await db.user.findUnique({
        where: { id: mostActiveUser[0].userId },
        select: { name: true },
      })
      mostActiveUserName = activeUser?.name || null
    }

    // Get unique actions and entities for filter dropdowns
    const [uniqueActions, uniqueEntities] = await Promise.all([
      db.auditLog.findMany({
        select: { action: true },
        distinct: ['action'],
        orderBy: { action: 'asc' },
      }),
      db.auditLog.findMany({
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
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString(),
        organizationId: log.organizationId,
        user: log.user
          ? { id: log.user.id, name: log.user.name, email: log.user.email, role: log.user.role }
          : null,
      })),
      summary: {
        totalActionsToday: todayCount,
        mostActiveUser: mostActiveUserName
          ? { name: mostActiveUserName, count: mostActiveUser[0]._count.userId }
          : null,
        mostChangedEntity: mostChangedEntity.length > 0
          ? { entity: mostChangedEntity[0].entity, count: mostChangedEntity[0]._count.entity }
          : null,
      },
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
    console.error('Admin audit logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

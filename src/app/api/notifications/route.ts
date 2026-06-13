import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/notifications?orgId=xxx&unreadOnly=true&limit=50
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const shopId = searchParams.get('shopId')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const since = searchParams.get('since')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const whereClause: Record<string, unknown> = {
      organizationId: orgId,
      OR: [
        { userId: null },
        { userId: user.id },
      ],
    }
    if (shopId) whereClause.AND = [{ OR: [{ shopId }, { shopId: null }] }]

    if (unreadOnly) {
      whereClause.isRead = false
    }

    // Support for polling: only return notifications created after 'since' timestamp
    if (since) {
      const sinceDate = new Date(since)
      if (!isNaN(sinceDate.getTime())) {
        whereClause.createdAt = { gt: sinceDate }
      }
    }

    const unreadWhere: Record<string, unknown> = {
      organizationId: orgId,
      isRead: false,
      OR: [
        { userId: null },
        { userId: user.id },
      ],
    }
    if (shopId) unreadWhere.AND = [{ OR: [{ shopId }, { shopId: null }] }]

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.notification.count({
        where: unreadWhere,
      }),
    ])

    return NextResponse.json(
      { notifications, unreadCount },
      {
        headers: {
          // Notifications are polled frequently - short cache to reduce load
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        }
      }
    )
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/notifications - Create a notification (internal use)
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
    const { orgId, shopId, userId, type, title, message, actionUrl, metadata } = body

    if (!orgId || !type || !title || !message) {
      return NextResponse.json(
        { error: 'orgId, type, title, and message are required' },
        { status: 400 }
      )
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const notification = await db.notification.create({
      data: {
        organizationId: orgId,
        shopId: shopId || null,
        userId: userId || null,
        type,
        title,
        message,
        actionUrl: actionUrl || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })

    return NextResponse.json({ notification }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Create notification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

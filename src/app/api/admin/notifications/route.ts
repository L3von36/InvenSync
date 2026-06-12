import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/admin/notifications - List recent admin-sent notifications (admin only)
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {
      type: { in: ['system', 'announcement', 'warning', 'info'] },
    }

    // Filter by specific notification type
    if (type) {
      where.type = type
    }

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        include: {
          organization: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.notification.count({ where }),
    ])

    return NextResponse.json({
      notifications: notifications.map(n => ({
        id: n.id,
        organizationId: n.organizationId,
        organizationName: n.organization.name,
        type: n.type,
        title: n.title,
        message: n.message,
        userId: n.userId,
        isRead: n.isRead,
        actionUrl: n.actionUrl,
        metadata: n.metadata,
        createdAt: n.createdAt.toISOString(),
      })),
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
    console.error('Admin list notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/notifications - Send announcement/notification (admin only)
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { title, message, targetOrgId, type } = body

    if (!title || !message || !type) {
      return NextResponse.json(
        { error: 'title, message, and type are required' },
        { status: 400 }
      )
    }

    const validTypes = ['announcement', 'warning', 'info']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const notificationMetadata = JSON.stringify({ sentBy: user.id, sentByName: user.name })

    let notificationsCreated = 0

    if (targetOrgId) {
      // Create notification for a specific organization
      const org = await db.organization.findUnique({ where: { id: targetOrgId } })
      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      await db.notification.create({
        data: {
          organizationId: targetOrgId,
          userId: null, // All org members
          type,
          title,
          message,
          metadata: notificationMetadata,
        },
      })
      notificationsCreated = 1
    } else {
      // Create notification for ALL organizations
      const allOrgs = await db.organization.findMany({
        select: { id: true },
      })

      if (allOrgs.length > 0) {
        await db.notification.createMany({
          data: allOrgs.map(org => ({
            organizationId: org.id,
            userId: null, // All org members
            type,
            title,
            message,
            metadata: notificationMetadata,
          })),
        })
        notificationsCreated = allOrgs.length
      }
    }

    return NextResponse.json({
      success: true,
      count: notificationsCreated,
    }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin send notification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

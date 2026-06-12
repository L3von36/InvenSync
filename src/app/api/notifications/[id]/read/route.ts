import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// POST /api/notifications/[id]/read - Mark a notification as read
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Find the notification first to verify it belongs to this user or their org
    const notification = await db.notification.findUnique({
      where: { id },
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    // Verify the notification is accessible to this user:
    // - It must be targeted to them (userId = user.id) or be org-wide (userId = null)
    if (notification.userId !== null && notification.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.notification.update({
      where: { id },
      data: { isRead: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Mark notification read error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

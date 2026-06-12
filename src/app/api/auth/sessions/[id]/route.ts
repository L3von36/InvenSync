import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { parseUserAgent } from '@/lib/two-factor'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rateLimitResult = applyRateLimit(request, RateLimitTiers.MUTATION)
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Find the device
    const device = await db.userDevice.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!device) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Check if this is the current session — don't allow revoking current session
    const userAgent = request.headers.get('user-agent') || ''
    const parsed = parseUserAgent(userAgent)
    const isCurrent = device.browser === parsed.browser &&
      device.os === parsed.os &&
      device.deviceType === parsed.deviceType

    if (isCurrent) {
      return NextResponse.json(
        { error: 'Cannot revoke your current session. Use logout instead.' },
        { status: 400 }
      )
    }

    // Mark the device as inactive
    await db.userDevice.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Session revoke error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

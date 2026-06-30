import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { parseUserAgent } from '@/lib/two-factor'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

export async function POST(request: Request) {
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

    // Get current device info to keep it active
    const userAgent = request.headers.get('user-agent') || ''
    const parsed = parseUserAgent(userAgent)

    // Find the current device
    const currentDevice = await db.userDevice.findFirst({
      where: {
        userId: user.id,
        browser: parsed.browser,
        os: parsed.os,
        deviceType: parsed.deviceType,
        isActive: true,
      },
    })

    // Revoke all other active sessions
    const revoked = await db.userDevice.updateMany({
      where: {
        userId: user.id,
        isActive: true,
        ...(currentDevice ? { id: { not: currentDevice.id } } : {}),
      },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      message: `Revoked ${revoked.count} other session${revoked.count !== 1 ? 's' : ''}.`,
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Revoke all sessions error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

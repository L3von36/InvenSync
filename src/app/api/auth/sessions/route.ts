import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { parseUserAgent } from '@/lib/two-factor'
import { isDatabaseError } from '@/lib/api-error'

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the current token to identify the current session
    const authHeader = request.headers.get('authorization')
    const currentToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

    // Get current device info for comparison
    const userAgent = request.headers.get('user-agent') || ''
    const parsed = parseUserAgent(userAgent)
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const currentIp = forwarded?.split(',')[0]?.trim() || realIp || null

    // Get all active devices for the user
    const devices = await db.userDevice.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    })

    // Determine which is the current session
    const sessions = devices.map(device => {
      const isCurrent = device.browser === parsed.browser &&
        device.os === parsed.os &&
        device.deviceType === parsed.deviceType &&
        (currentIp ? device.ipAddress === currentIp : true)

      return {
        id: device.id,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        browser: device.browser,
        os: device.os,
        ipAddress: device.ipAddress,
        lastActiveAt: device.lastActiveAt.toISOString(),
        isActive: device.isActive,
        isCurrent,
        createdAt: device.createdAt.toISOString(),
      }
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Sessions list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

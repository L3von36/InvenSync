import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, isSupabaseAuth } from '@/lib/auth'
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
    // Try to get user from request for device tracking
    const user = await getUserFromRequest(request).catch(() => null)

    if (user) {
      // Mark the current device as inactive
      try {
        const userAgent = request.headers.get('user-agent') || ''
        const parsed = parseUserAgent(userAgent)

        const currentDevice = await db.userDevice.findFirst({
          where: {
            userId: user.id,
            browser: parsed.browser,
            os: parsed.os,
            deviceType: parsed.deviceType,
            isActive: true,
          },
        })

        if (currentDevice) {
          await db.userDevice.update({
            where: { id: currentDevice.id },
            data: { isActive: false },
          })
        }
      } catch (deviceErr) {
        console.error('[Logout] Device tracking error:', deviceErr)
        // Don't fail logout if device tracking fails
      }
    }

    if (isSupabaseAuth()) {
      // Supabase Auth: sign out via Supabase to clear httpOnly cookies
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      await supabase.auth.signOut()
    }
    // In both modes, the client clears its local state
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

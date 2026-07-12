// ============================================
// Cron endpoint – check module expiries
// ============================================
// Can be called as a scheduled task or manually.
// Returns the count of notifications created.
//
// Authentication:
// - Vercel Cron jobs: send `x-cron-secret` header matching CRON_SECRET
// - Frontend/API calls: send Authorization Bearer JWT (standard auth)
// Either method is accepted. This allows both automated cron triggers
// and authenticated user-triggered checks.

import { NextResponse } from 'next/server'
import { checkAndNotifyExpiringModules } from '@/lib/module-notifications'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

export async function GET(request: Request) {
  // Check cron secret first (for Vercel Cron jobs). Vercel sends the
  // secret as `Authorization: Bearer <CRON_SECRET>`; manual triggers may
  // use the `x-cron-secret` header. Accept either.
  const secret = process.env.CRON_SECRET
  const cronHeader = request.headers.get('x-cron-secret')
  const authHeader = request.headers.get('authorization')
  const isCronAuthed = !!secret && (
    cronHeader === secret || authHeader === `Bearer ${secret}`
  )

  // If not cron-authed, check JWT auth (for frontend/API calls)
  let isJwtAuthed = false
  if (!isCronAuthed) {
    const user = await getUserFromRequest(request)
    isJwtAuthed = !!user
  }

  // Must be authenticated via either method — no open fallback.
  // A missing CRON_SECRET must never mean "allow everyone": if the env var
  // is ever unset in production, this endpoint would be publicly triggerable.
  if (!isCronAuthed && !isJwtAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const notificationsCreated = await checkAndNotifyExpiringModules()

    return NextResponse.json({
      success: true,
      notificationsCreated,
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { success: false, error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 },
      )
    }
    console.error('[cron/check-expiries] Error checking module expiries:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check module expiries' },
      { status: 500 },
    )
  }
}

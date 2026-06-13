// ============================================
// Cron endpoint – check module expiries
// ============================================
// Can be called as a scheduled task or manually.
// Returns the count of notifications created.

import { NextResponse } from 'next/server'
import { checkAndNotifyExpiringModules } from '@/lib/module-notifications'
import { isDatabaseError } from '@/lib/api-error'

export async function GET(request: Request) {
  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
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

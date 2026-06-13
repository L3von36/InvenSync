import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'
import { errorMonitor } from '@/lib/error-monitor'

// ============================================
// Admin Error Monitoring API
// ============================================
// GET  /api/admin/system/errors?type=api&limit=50  — view captured errors
// DELETE /api/admin/system/errors                   — clear all captured errors

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const endpoint = searchParams.get('endpoint')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

    // Filter by endpoint if provided
    if (endpoint) {
      return NextResponse.json({
        errors: errorMonitor.getByEndpoint(endpoint, limit),
        stats: errorMonitor.getStats(),
      })
    }

    // Filter by type if provided
    if (type) {
      return NextResponse.json({
        errors: errorMonitor.getByType(type as 'api' | 'auth' | 'database' | 'ai' | 'validation' | 'unknown', limit),
        stats: errorMonitor.getStats(),
      })
    }

    // Default: return recent errors + stats
    return NextResponse.json({
      errors: errorMonitor.getRecent(limit),
      stats: errorMonitor.getStats(),
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('[Admin Errors API]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    errorMonitor.clear()
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('[Admin Errors API]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

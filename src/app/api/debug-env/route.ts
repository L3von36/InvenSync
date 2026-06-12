import { NextResponse } from 'next/server'
import { requireAuth, requireAdmin, apiHandler } from '@/lib/api-error'

// GET /api/debug-env — Development-only endpoint, requires admin auth
export async function GET(request: Request) {
  return apiHandler(request, async (req) => {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
    }

    const user = await requireAuth(req)
    requireAdmin(user)

    const dbUrl = process.env.DATABASE_URL || 'NOT SET'
    const directUrl = process.env.DIRECT_URL || 'NOT SET'
    return NextResponse.json({
      DATABASE_URL_prefix: dbUrl.substring(0, 20),
      DATABASE_URL_length: dbUrl.length,
      DIRECT_URL_prefix: directUrl.substring(0, 20),
      DIRECT_URL_length: directUrl.length,
      NODE_ENV: process.env.NODE_ENV,
    })
  }, 'debug-env')
}

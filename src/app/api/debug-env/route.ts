import { NextResponse } from 'next/server'
import { requireAuth, requireAdmin, apiHandler } from '@/lib/api-error'

// GET /api/debug-env — Development-only endpoint, requires admin auth
// SECURITY: This endpoint is intentionally restricted:
// 1. Only available in development mode (returns 404 in production)
// 2. Requires admin authentication
// 3. Does NOT expose any URL prefixes or credentials
export async function GET(request: Request) {
  return apiHandler(request, async (req) => {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
    }

    const user = await requireAuth(req)
    requireAdmin(user)

    // Only expose whether critical env vars are set, NOT their values
    return NextResponse.json({
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      DIRECT_URL_SET: !!process.env.DIRECT_URL,
      JWT_SECRET_SET: !!process.env.JWT_SECRET,
      SUPABASE_CONFIGURED: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://your-project.supabase.co'),
    })
  }, 'debug-env')
}

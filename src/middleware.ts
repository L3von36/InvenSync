import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // Build CSP with Supabase URL if configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : ''

  // CSP - allow inline styles and scripts from self, plus fonts, and Supabase connections
  const connectSrc = [
    "'self'",
    'ws:',
    'wss:',
    // Allow connections to Supabase (auth, realtime, storage)
    supabaseHost ? `https://${supabaseHost}` : '',
    // Allow Supabase realtime WebSocket
    supabaseHost ? `wss://${supabaseHost}` : '',
  ].filter(Boolean).join(' ')

  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src ${connectSrc};`
  )

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { checkDistributedRateLimit } from '@/lib/rate-limit-edge'

export async function middleware(request: NextRequest) {
  // 0. Distributed rate limiting for auth endpoints — enforced at the edge,
  //    before the serverless function even starts. The in-memory limiter in
  //    the route handlers resets on cold starts, so brute-force protection
  //    for login/register must live in shared storage (Upstash Redis).
  //    No-op when UPSTASH_REDIS_REST_URL is not configured.
  //    Scoped to credential-guessing surfaces only — logout/session routes
  //    are authenticated actions and shouldn't consume the shared-IP budget
  //    (many Ethiopian businesses sit behind one NAT IP).
  const BRUTE_FORCE_PATHS = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/reset-password',
    '/api/auth/forgot-password',
    '/api/auth/2fa',
  ]
  if (
    request.method === 'POST' &&
    BRUTE_FORCE_PATHS.some(p => request.nextUrl.pathname.startsWith(p))
  ) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const result = await checkDistributedRateLimit('auth', ip, 30, 15 * 60)
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(result.retryAfterSec) },
        },
      )
    }
  }
  // 1. Refresh Supabase Auth session cookies (if Supabase is configured).
  //    This ensures httpOnly session tokens are refreshed on every request,
  //    preventing silent session expiry for Supabase-authenticated users.
  //    When Supabase is NOT configured, updateSession() is a no-op.
  const supabaseResponse = await updateSession(request)

  // 2. Security headers — apply to the Supabase-aware response so that
  //    any cookie updates from step 1 are preserved.
  const response = supabaseResponse

  // Generate a unique request ID for tracing (using Web Crypto API — Edge Runtime compatible)
  const requestId = crypto.randomUUID()
  response.headers.set('X-Request-ID', requestId)

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // HSTS — enforce HTTPS (1 year max-age, include subdomains, preload-ready)
  // Only set in production to avoid issues with local HTTP development
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // Permissions Policy — restrict browser features
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(), sync-xhr=()'
  )

  // CSRF protection — reject cross-origin requests to mutation API endpoints
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin && host) {
    const originHost = origin.replace(/^https?:\/\//, '')
    if (originHost !== host) {
      // Cross-origin request to API — block mutation methods
      const url = new URL(request.url)
      if (url.pathname.startsWith('/api/')) {
        if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
          return NextResponse.json(
            { error: 'Cross-origin request denied' },
            { status: 403 }
          )
        }
      }
    }
  }

  // CSP — Content Security Policy
  // Comprehensively allows only the domains actually required by the application:
  // - OpenStreetMap tiles (a/b/c.tile.openstreetmap.org) for Leaflet maps
  // - Nominatim (nominatim.openstreetmap.org) for reverse geocoding
  // - Google Fonts (fonts.googleapis.com / fonts.gstatic.com)
  // - Leaflet marker icons are served from /images/leaflet/ (no CDN needed)
  // NOTE: unsafe-inline and unsafe-eval are required by Next.js runtime.
  // In a production hardening pass, replace with nonce-based CSP.
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' ws: wss: https://*.openstreetmap.org",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ')
  )

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

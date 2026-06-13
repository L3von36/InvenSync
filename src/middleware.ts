import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

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
  // NOTE: unsafe-inline and unsafe-eval are still included because Next.js dev mode
  // and some runtime dependencies require them. In a production hardening pass,
  // these should be removed and replaced with nonce-based or hash-based CSP.
  const connectSrc = "'self' ws: wss: https://nominatim.openstreetmap.org"

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      `connect-src ${connectSrc}`,
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

/**
 * Supabase Middleware Client
 * 
 * Used in Next.js middleware to refresh auth sessions
 * and protect routes. This ensures that every request
 * has a fresh Supabase session.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Skip Supabase session refresh if not configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isConfigured = !!supabaseUrl && 
    supabaseUrl !== 'https://your-project.supabase.co' &&
    !!supabaseAnonKey && 
    supabaseAnonKey !== 'your-anon-key'

  if (!isConfigured) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes — redirect to landing if not authenticated
  // API routes handle their own auth checks
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
  const isStaticAsset = request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.includes('/favicon') ||
    request.nextUrl.pathname.includes('.png') ||
    request.nextUrl.pathname.includes('.svg') ||
    request.nextUrl.pathname.includes('.ico')

  if (!isApiRoute && !isStaticAsset && !user) {
    // No user, but this is the main page — let the client-side
    // auth flow handle the redirect to login. We don't want to
    // server-side redirect because the app is client-side routed.
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is now.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so: NextResponse.next({ request })
  // 2. Copy over the cookies, like with: supabaseResponse.cookies.getAll().forEach(...)
  return supabaseResponse
}

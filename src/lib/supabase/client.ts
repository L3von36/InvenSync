/**
 * Supabase Browser Client
 * 
 * Used in client-side components for auth state, realtime subscriptions,
 * and direct database access (when protected by RLS).
 * 
 * Uses @supabase/ssr for proper cookie-based session management
 * that works with Next.js App Router.
 */
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

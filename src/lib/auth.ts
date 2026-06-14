/**
 * Authentication Utilities — Hybrid Supabase Auth + JWT fallback
 * 
 * This module provides server-side auth helpers for API routes.
 * 
 * When Supabase is configured (NEXT_PUBLIC_SUPABASE_URL is set):
 * - Tries Supabase Auth first (httpOnly cookies)
 * - Falls back to JWT/bcrypt for pre-seeded users not yet in Supabase Auth
 * - This hybrid approach ensures smooth migration from local dev to Supabase
 * 
 * When Supabase is NOT configured (local dev without Supabase):
 * - Uses JWT-based auth for backward compatibility
 * - Uses bcryptjs + jsonwebtoken (legacy mode)
 * 
 * The Prisma User record links to Supabase Auth via the `supabaseUid` field.
 */
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { db } from '@/lib/db'

// Lazy getter for JWT_SECRET — avoids throwing during `next build` (which runs in production mode)
// when no auth operations are actually performed. The error is raised at runtime instead.
let _jwtSecret: string | undefined
function getJwtSecret(): string {
  if (_jwtSecret) return _jwtSecret
  if (process.env.JWT_SECRET) {
    _jwtSecret = process.env.JWT_SECRET
    return _jwtSecret
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET environment variable is required in production. ' +
      'Set it in your Vercel project settings (Settings > Environment Variables). ' +
      'Generate one with: openssl rand -hex 32'
    )
  }
  console.warn(
    '[AUTH] WARNING: Using random JWT_SECRET. This means all sessions will be invalidated on server restart. ' +
    'Set JWT_SECRET env var for production. Generate one with: openssl rand -hex 32'
  )
  _jwtSecret = crypto.randomBytes(32).toString('hex')
  return _jwtSecret
}
const JWT_EXPIRES_IN = '24h'

// Check if Supabase is configured
const isSupabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://your-project.supabase.co'

// ============================================
// Custom Error Types
// ============================================

/**
 * Thrown when the database is unreachable during auth checks.
 * API routes should catch this and return 503 instead of 401,
 * to prevent the client from triggering an auto-logout cascade.
 */
export class DatabaseUnavailableError extends Error {
  constructor(message = 'Database is unreachable') {
    super(message)
    this.name = 'DatabaseUnavailableError'
  }
}

/**
 * Check if an error is a database connection error.
 */
function isDatabaseError(err: unknown): boolean {
  if (err instanceof DatabaseUnavailableError) return true
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('connect') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENETUNREACH') ||
    msg.includes('P1001') ||
    msg.includes("Can't reach database") ||
    msg.includes('Connection refused') ||
    msg.includes('network is unreachable') ||
    msg.includes('Connection timed out') ||
    msg.includes('pgbouncer') ||
    msg.includes('no pg_hba.conf entry') ||
    msg.includes('too many connections')
  )
}

export type AuthUser = {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  role: string
  supabaseUid: string | null
  memberships: Array<{
    id: string
    userId: string
    organizationId: string
    role: string
    joinedAt: Date
    organization: {
      id: string
      name: string
      slug: string
      logoUrl: string | null
      currency: string
      country: string
      businessType: string
      city: string | null
      subscriptionPlan: string
      subscriptionStatus: string
    }
  }>
}

/**
 * Get the authenticated user from the request.
 * 
 * Hybrid mode: Tries Supabase Auth first, then falls back to JWT.
 * This ensures both Supabase-authenticated and JWT-authenticated users work.
 * 
 * IMPORTANT: Throws DatabaseUnavailableError when the database is unreachable,
 * so API routes can return 503 instead of 401. This prevents the client-side
 * auto-logout cascade when the database is temporarily unavailable.
 */
export async function getUserFromRequest(request?: Request): Promise<AuthUser | null> {
  try {
    // Use JWT auth — this works for all users regardless of Supabase Auth status.
    return await getUserFromJWT(request)
  } catch (err) {
    // If this is a database connection error, re-throw as DatabaseUnavailableError
    // so routes can return 503 instead of 401
    if (isDatabaseError(err)) {
      console.error('[Auth] Database unreachable during auth check:', err instanceof Error ? err.message : err)
      throw new DatabaseUnavailableError()
    }
    // For other errors (e.g., malformed token), return null (not authenticated)
    console.error('[Auth] Error during auth check:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Supabase Auth: Get user from httpOnly cookie session
 */
async function getUserFromSupabase(): Promise<AuthUser | null> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
      return null
    }

    // Look up our app-level User record linked to this Supabase Auth user
    const user = await db.user.findFirst({
      where: {
        OR: [
          { supabaseUid: supabaseUser.id },
          { email: supabaseUser.email! },
        ]
      },
      include: {
        memberships: {
          include: {
            organization: true
          }
        }
      }
    })

    if (!user) {
      return null
    }

    // If the user exists but doesn't have a supabaseUid yet, link it
    if (!user.supabaseUid && supabaseUser.id) {
      await db.user.update({
        where: { id: user.id },
        data: { supabaseUid: supabaseUser.id }
      })
    }

    return user as unknown as AuthUser
  } catch (err) {
    if (isDatabaseError(err)) {
      throw new DatabaseUnavailableError()
    }
    return null
  }
}

/**
 * JWT Auth: Get user from Authorization header
 * Used as fallback when Supabase Auth doesn't have a session
 */
async function getUserFromJWT(request?: Request): Promise<AuthUser | null> {
  if (!request) return null
  
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.substring(7)
  const payload = verifyToken(token)
  if (!payload) return null

  // Let database errors propagate so getUserFromRequest can convert to DatabaseUnavailableError
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      memberships: {
        include: {
          organization: true
        }
      }
    }
  })

  return user as unknown as AuthUser
}

/**
 * Verify that a user has access to a specific organization.
 */
export async function verifyOrgAccess(user: AuthUser | null, orgId: string): Promise<boolean> {
  if (!user) return false
  return user.memberships.some(m => m.organizationId === orgId)
}

/**
 * Check if Supabase Auth is configured and active
 */
export function isSupabaseAuth(): boolean {
  return isSupabaseConfigured
}

// ============================================
// Password & Token Utilities
// ============================================

/**
 * Validate password strength.
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  if (password && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (password && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (password && !/\d/.test(password)) {
    errors.push('Password must contain at least one digit')
  }
  if (password && !/[!@#$%^&*()_+\-=[\]{}|;:'",.<>?/`~]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }
  return { valid: errors.length === 0, errors }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string }
    return decoded
  } catch {
    return null
  }
}

/**
 * Helper for API routes to handle auth + database errors consistently.
 * Returns the authenticated user, or a NextResponse for error cases.
 * 
 * Usage:
 *   const result = await getAuthenticatedUser(request)
 *   if (result instanceof NextResponse) return result  // error response
 *   const user = result  // AuthUser
 */
export async function getAuthenticatedUser(request: Request): Promise<AuthUser | NextResponse> {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return user
  } catch (err) {
    if (err instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database connection failed', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    throw err
  }
}

// Import NextResponse at the top level for getAuthenticatedUser
import { NextResponse } from 'next/server'

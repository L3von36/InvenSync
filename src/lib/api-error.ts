// ============================================
// Centralized API Error Handling
// ============================================
// This module provides consistent error handling across ALL API routes:
// - Database unavailability detection → 503 (prevents auto-logout cascade)
// - Input validation with Zod → 400 with field-level errors
// - Rate limiting integration → 429 with Retry-After
// - Consistent error response format
// - Sanitized error messages (never leak technical details)
//
// USAGE:
//   import { apiHandler, validateBody, validateQuery, requireAuth, requireOrgAccess } from '@/lib/api-error'
//
//   export async function POST(request: Request) {
//     return apiHandler(request, async (req) => {
//       const user = await requireAuth(req)
//       const body = await validateBody(req, myZodSchema)
//       await requireOrgAccess(user, body.orgId)
//       // ... business logic
//       return NextResponse.json({ success: true })
//     })
//   }

import { NextResponse } from 'next/server'
import { ZodSchema, ZodError } from 'zod'
import { getUserFromRequest, verifyOrgAccess, DatabaseUnavailableError } from '@/lib/auth'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'
import { requireModule } from '@/lib/module-guard'
import { errorMonitor } from '@/lib/error-monitor'
import type { AuthUser } from '@/lib/auth'

// ============================================
// Error Response Helpers
// ============================================

export interface ApiErrorResponse {
  error: string
  code?: string
  details?: Array<{ field: string; message: string }>
}

/**
 * Create a consistent error response.
 * NEVER includes technical details (stack traces, Prisma codes, etc.)
 */
export function errorResponse(
  message: string,
  status: number,
  code?: string,
  details?: Array<{ field: string; message: string }>
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = { error: message }
  if (code) body.code = code
  if (details && details.length > 0) body.details = details
  return NextResponse.json(body, { status })
}

// ============================================
// Database Error Detection
// ============================================

const DB_ERROR_PATTERNS = [
  'connect',
  'ECONNREFUSED',
  'ENETUNREACH',
  'P1001',
  "Can't reach database",
  'Connection refused',
  'network is unreachable',
  'Connection timed out',
  'pgbouncer',
  'no pg_hba.conf entry',
  'too many connections',
  'Connection pool',
  'Timed out',
  'write EPIPE',
  'read ECONNRESET',
  'fetch failed',
]

/**
 * Check if an error is a database connection issue.
 * If so, return 503 with DB_UNREACHABLE code (prevents client auto-logout cascade).
 */
export function isDatabaseError(err: unknown): boolean {
  if (err instanceof DatabaseUnavailableError) return true
  const msg = err instanceof Error ? err.message : String(err)
  return DB_ERROR_PATTERNS.some(pattern => msg.includes(pattern))
}

/**
 * Handle a caught error in an API route.
 * - Database errors → 503 Service Unavailable
 * - ZodError → 400 Validation Error with field details
 * - Known user-facing errors → pass through with appropriate status
 * - Unknown errors → 500 Internal Server Error (sanitized)
 *
 * Also captures the error into the error monitoring system (ring buffer)
 * for admin dashboard review. Skips noisy 429/404 errors.
 */
export function handleApiError(error: unknown, context?: string): NextResponse<ApiErrorResponse> {
  // Log the full error for debugging (server-side only)
  if (context) {
    console.error(`[${context}]`, error)
  } else {
    console.error('[API Error]', error)
  }

  // Determine error type and status code for monitoring
  let monitorType: 'api' | 'auth' | 'database' | 'ai' | 'validation' | 'unknown' = 'unknown'
  let statusCode: number | undefined

  // Database unavailability → 503 (prevents client auto-logout cascade)
  if (isDatabaseError(error)) {
    monitorType = 'database'
    statusCode = 503
    // Capture for monitoring
    errorMonitor.capture(error, { type: 'database', statusCode: 503, endpoint: context })
    return errorResponse(
      'Service temporarily unavailable. Please try again.',
      503,
      'DB_UNREACHABLE'
    )
  }

  // Zod validation errors → 400 with field details
  if (error instanceof ZodError) {
    monitorType = 'validation'
    statusCode = 400
    // Capture for monitoring (validation errors are lower priority but still useful)
    errorMonitor.capture(error, { type: 'validation', statusCode: 400, endpoint: context })
    const zodIssues = error.issues ?? error.errors ?? []
    const details = zodIssues.map((e: { path: (string | number)[]; message: string }) => ({
      field: e.path.join('.'),
      message: e.message,
    }))
    return errorResponse('Validation failed', 400, 'VALIDATION_ERROR', details)
  }

  // Known user-facing errors with specific messages
  if (error instanceof ApiError) {
    monitorType = error.status === 401 || error.status === 403 ? 'auth' : 'api'
    statusCode = error.status
    // Capture for monitoring (skip 404/429 — too noisy)
    errorMonitor.capture(error, { type: monitorType, statusCode, endpoint: context })
    return errorResponse(error.message, error.status, error.code)
  }

  // Generic error — sanitize for user display
  errorMonitor.capture(error, { type: 'unknown', statusCode: 500, endpoint: context })
  return errorResponse(
    'An unexpected error occurred. Please try again.',
    500
  )
}

// ============================================
// Custom API Error Class
// ============================================

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// Convenience constructors
export const ApiErrors = {
  unauthorized: () => new ApiError('Unauthorized', 401, 'UNAUTHORIZED'),
  forbidden: (msg = 'You do not have permission to perform this action') => new ApiError(msg, 403, 'FORBIDDEN'),
  notFound: (resource = 'Resource') => new ApiError(`${resource} not found`, 404, 'NOT_FOUND'),
  badRequest: (msg: string) => new ApiError(msg, 400, 'BAD_REQUEST'),
  rateLimited: () => new ApiError('Too many requests. Please try again later.', 429, 'RATE_LIMITED'),
  conflict: (msg: string) => new ApiError(msg, 409, 'CONFLICT'),
  serviceUnavailable: (msg = 'Service temporarily unavailable. Please try again.') => new ApiError(msg, 503, 'SERVICE_UNAVAILABLE'),
}

// ============================================
// API Route Wrapper
// ============================================

type HandlerFn = (request: Request) => Promise<NextResponse>

/**
 * Wrap an API route handler with comprehensive error handling.
 * Catches ALL errors and returns appropriate responses.
 *
 * Usage:
 *   export async function GET(request: Request) {
 *     return apiHandler(request, async (req) => {
 *       const user = await requireAuth(req)
 *       // ... business logic
 *       return NextResponse.json({ data })
 *     })
 *   }
 */
export function apiHandler(
  request: Request,
  handler: HandlerFn,
  context?: string
): Promise<NextResponse> {
  return handler(request).catch(err => handleApiError(err, context))
}

// ============================================
// Auth & Access Helpers
// ============================================

/**
 * Require authentication. Throws ApiError if not authenticated.
 * Handles database unavailability → 503 instead of 401.
 */
export async function requireAuth(request: Request): Promise<AuthUser> {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      throw ApiErrors.unauthorized()
    }
    return user
  } catch (err) {
    // If it's already an ApiError, re-throw
    if (err instanceof ApiError) throw err
    // Database unavailability
    if (isDatabaseError(err)) {
      throw ApiErrors.serviceUnavailable('Service temporarily unavailable. Please try again.')
    }
    // Other auth errors
    throw ApiErrors.unauthorized()
  }
}

/**
 * Require organization access. Throws ApiError if denied.
 * IMPORTANT: Properly awaits the async verifyOrgAccess function.
 */
export async function requireOrgAccess(user: AuthUser, orgId: string): Promise<void> {
  const hasAccess = await verifyOrgAccess(user, orgId)
  if (!hasAccess) {
    throw ApiErrors.forbidden()
  }
}

/**
 * Require admin role. Throws ApiError if not admin.
 */
export function requireAdmin(user: AuthUser): void {
  if (user.role !== 'admin') {
    throw ApiErrors.forbidden('Admin access required')
  }
}

/**
 * Require module access. Throws ApiError if module not available.
 */
export async function requireModuleAccess(orgId: string, moduleKey: string, userRole?: string): Promise<void> {
  // Admin bypasses module checks
  if (userRole === 'admin') return

  const moduleError = await requireModule(orgId, moduleKey)
  if (moduleError) {
    throw ApiErrors.forbidden('This feature is not available on your current plan')
  }
}

// ============================================
// Input Validation Helpers
// ============================================

/**
 * Parse and validate request body using a Zod schema.
 * Throws ApiError with 400 if validation fails.
 */
export async function validateBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw ApiErrors.badRequest('Invalid JSON in request body')
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    throw result.error // ZodError will be caught by handleApiError
  }

  return result.data
}

/**
 * Validate query parameters using a Zod schema.
 * Throws ApiError with 400 if validation fails.
 */
export function validateQuery<T>(request: Request, schema: ZodSchema<T>): T {
  const { searchParams } = new URL(request.url)
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    params[key] = value
  })

  const result = schema.safeParse(params)
  if (!result.success) {
    throw result.error // ZodError will be caught by handleApiError
  }

  return result.data
}

/**
 * Require a specific query parameter. Throws 400 if missing.
 */
export function requireQueryParam(request: Request, paramName: string): string {
  const { searchParams } = new URL(request.url)
  const value = searchParams.get(paramName)
  if (!value) {
    throw ApiErrors.badRequest(`${paramName} is required`)
  }
  return value
}

/**
 * Parse an integer query parameter with a default value.
 * Returns default if missing or invalid.
 */
export function parseIntQuery(request: Request, paramName: string, defaultValue: number): number {
  const { searchParams } = new URL(request.url)
  const value = searchParams.get(paramName)
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? defaultValue : parsed
}

// ============================================
// Rate Limiting Helper
// ============================================

/**
 * Apply rate limiting to an API route.
 * Throws ApiError with 429 if rate limit exceeded.
 */
export function applyRateLimitGuard(
  request: Request,
  tier: typeof RateLimitTiers[keyof typeof RateLimitTiers],
  userId?: string
): void {
  const result = applyRateLimit(request, tier, userId)
  if (!result.allowed) {
    throw ApiErrors.rateLimited()
  }
}

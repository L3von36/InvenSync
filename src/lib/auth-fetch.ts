'use client'

// ============================================
// Auth-aware fetch utility
// ============================================
// Centralizes JWT token injection into fetch requests.
// All client-side raw fetch() calls to API routes should use
// this helper instead of manually reading from localStorage.
//
// This prevents:
// 1. 401 errors from forgetting to add Authorization header
// 2. Sending "Authorization: Bearer null" when token is missing
// 3. Inconsistent auth header patterns across components
// ============================================

/**
 * Returns the JWT token from localStorage (client-side only).
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sb_token')
}

/**
 * Returns fetch headers that include the Authorization Bearer token
 * when a valid JWT is present in localStorage.
 *
 * Returns an object with just the Content-Type header (or empty if
 * contentType is false) when no token is available, preventing
 * `Authorization: Bearer null` from being sent.
 *
 * @param contentType - Whether to include Content-Type: application/json.
 *                      Set to false for FormData uploads. Default: true.
 */
export function getAuthHeaders(contentType = true): Record<string, string> {
  const headers: Record<string, string> = {}
  if (contentType) {
    headers['Content-Type'] = 'application/json'
  }
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

/**
 * Drop-in replacement for fetch() when calling authenticated API routes.
 *
 * Automatically injects the Authorization header from localStorage.
 * Merges with any headers you provide (your headers take precedence).
 *
 * @example
 * // Simple GET with auth
 * const res = await authFetch('/api/notifications?orgId=123')
 *
 * // POST with body
 * const res = await authFetch('/api/scheduled-reports', {
 *   method: 'POST',
 *   body: JSON.stringify(payload),
 * })
 *
 * // FormData upload (no Content-Type — browser sets multipart boundary)
 * const res = await authFetch('/api/upload', {
 *   method: 'POST',
 *   contentType: false,
 *   body: formData,
 * })
 */
export async function authFetch(
  url: string,
  options: RequestInit & { contentType?: boolean } = {}
): Promise<Response> {
  const { contentType: includeContentType = true, ...fetchOptions } = options

  const authHeaders = getAuthHeaders(includeContentType)

  // Merge: caller-provided headers override our defaults
  const mergedHeaders = {
    ...authHeaders,
    ...(fetchOptions.headers as Record<string, string> | undefined),
  }

  return fetch(url, {
    ...fetchOptions,
    headers: mergedHeaders,
  })
}

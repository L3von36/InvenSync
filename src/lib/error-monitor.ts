// ============================================
// Lightweight Error Monitoring System
// ============================================
// Captures errors with rich context, stores them in a ring buffer,
// and provides query/filter capabilities for the admin dashboard.
//
// Design goals:
// - Non-blocking: never throws, always try/catches internally
// - Memory-bounded: ring buffer of last 100 errors max
// - Sanitized: strips passwords, tokens, and secrets before storing
// - Filtered: skips noisy 404 and 429 errors
// - No external dependencies (no Sentry, etc.)

import { randomUUID } from 'crypto'

// ============================================
// Types
// ============================================

export interface ErrorEntry {
  id: string
  timestamp: string
  type: 'api' | 'auth' | 'database' | 'ai' | 'validation' | 'unknown'
  message: string
  stack?: string
  endpoint?: string
  method?: string
  userId?: string
  orgId?: string
  statusCode?: number
  metadata?: Record<string, unknown>
}

export interface ErrorStats {
  total: number
  byType: Record<string, number>
  byEndpoint: Record<string, number>
  last24h: number
}

// ============================================
// Sanitization
// ============================================

/** Patterns that indicate sensitive data — values for these keys are redacted */
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /apikey/i,
  /api[-_]?key/i,
  /auth/i,
  /cookie/i,
  /session/i,
  /credential/i,
  /private[-_]?key/i,
  /access[-_]?key/i,
  /refresh[-_]?token/i,
  /bearer/i,
  /jwt/i,
]

/**
 * Sanitize a string by redacting values associated with sensitive keys.
 * Handles JSON strings, URL query params, and key=value patterns.
 */
function sanitizeString(input: string): string {
  let result = input

  // Redact JSON key-value pairs like "password": "value"
  result = result.replace(
    /("(?:[^"]*)"\s*:\s*")([^"]*)(")/g,
    (_match, prefix: string, _value: string, suffix: string) => {
      if (SENSITIVE_KEY_PATTERNS.some(p => p.test(prefix))) {
        return `${prefix}[REDACTED]${suffix}`
      }
      return _match
    }
  )

  // Redact URL query params like password=secret
  result = result.replace(
    /([?&](?:[^=]+)=)([^&\s]*)/g,
    (_match, prefix: string, _value: string) => {
      const keyName = prefix.replace(/[?&]=/, '')
      if (SENSITIVE_KEY_PATTERNS.some(p => p.test(keyName))) {
        return `${prefix}[REDACTED]`
      }
      return _match
    }
  )

  // Redact key=value patterns in plain text
  result = result.replace(
    /\b(\w+)\s*=\s*([^\s,;]+)/g,
    (_match, key: string, _value: string) => {
      if (SENSITIVE_KEY_PATTERNS.some(p => p.test(key))) {
        return `${key}=[REDACTED]`
      }
      return _match
    }
  )

  return result
}

/**
 * Recursively sanitize an object, redacting values for sensitive keys.
 */
function sanitizeObject(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 5) return { '[truncated]': true }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEY_PATTERNS.some(p => p.test(key))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, depth + 1)
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => {
        if (typeof item === 'string') return sanitizeString(item)
        if (item && typeof item === 'object') return sanitizeObject(item as Record<string, unknown>, depth + 1)
        return item
      })
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

// ============================================
// ErrorMonitor Class
// ============================================

const MAX_BUFFER_SIZE = 100
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

/** Status codes we do NOT capture — too noisy or too common */
const SKIPPED_STATUS_CODES = new Set([404, 429])

class ErrorMonitor {
  private errors: ErrorEntry[] = []
  private maxSize = MAX_BUFFER_SIZE
  private errorCounts = new Map<string, number>()

  /**
   * Capture an error with optional context.
   * Non-blocking: never throws. Silently fails if anything goes wrong.
   */
  capture(error: Error | unknown, context?: Partial<ErrorEntry>): void {
    try {
      // Skip noisy errors: 429 rate limits and 404 not founds
      const statusCode = context?.statusCode ?? this.extractStatusCode(error)
      if (statusCode !== undefined && SKIPPED_STATUS_CODES.has(statusCode)) {
        return
      }

      const entry = this.buildEntry(error, context)
      this.addEntry(entry)
    } catch {
      // Error monitor must never throw — silently ignore failures
    }
  }

  /**
   * Get the most recent errors, newest first.
   */
  getRecent(limit = 50): ErrorEntry[] {
    try {
      return this.errors.slice(0, Math.min(limit, this.errors.length))
    } catch {
      return []
    }
  }

  /**
   * Get errors filtered by type, newest first.
   */
  getByType(type: ErrorEntry['type'], limit = 50): ErrorEntry[] {
    try {
      return this.errors
        .filter(e => e.type === type)
        .slice(0, Math.min(limit, this.errors.length))
    } catch {
      return []
    }
  }

  /**
   * Get errors filtered by endpoint, newest first.
   */
  getByEndpoint(endpoint: string, limit = 50): ErrorEntry[] {
    try {
      return this.errors
        .filter(e => e.endpoint === endpoint)
        .slice(0, Math.min(limit, this.errors.length))
    } catch {
      return []
    }
  }

  /**
   * Get aggregate error statistics.
   */
  getStats(): ErrorStats {
    try {
      const now = Date.now()
      const byType: Record<string, number> = {}
      const byEndpoint: Record<string, number> = {}
      let last24h = 0

      for (const entry of this.errors) {
        // Count by type
        byType[entry.type] = (byType[entry.type] || 0) + 1

        // Count by endpoint
        if (entry.endpoint) {
          byEndpoint[entry.endpoint] = (byEndpoint[entry.endpoint] || 0) + 1
        }

        // Count last 24h
        const entryTime = new Date(entry.timestamp).getTime()
        if (now - entryTime < TWENTY_FOUR_HOURS_MS) {
          last24h++
        }
      }

      return {
        total: this.errors.length,
        byType,
        byEndpoint,
        last24h,
      }
    } catch {
      return { total: 0, byType: {}, byEndpoint: {}, last24h: 0 }
    }
  }

  /**
   * Clear all captured errors and reset counts.
   */
  clear(): void {
    try {
      this.errors = []
      this.errorCounts.clear()
    } catch {
      // Silently ignore
    }
  }

  // ============================================
  // Private helpers
  // ============================================

  private buildEntry(error: Error | unknown, context?: Partial<ErrorEntry>): ErrorEntry {
    let message: string
    let stack: string | undefined
    let type: ErrorEntry['type'] = context?.type ?? 'unknown'

    if (error instanceof Error) {
      message = sanitizeString(error.message)
      stack = error.stack ? sanitizeString(error.stack) : undefined
    } else if (typeof error === 'string') {
      message = sanitizeString(error)
    } else {
      message = sanitizeString(String(error))
    }

    // If type wasn't provided in context, try to infer it
    if (type === 'unknown' && error instanceof Error) {
      type = this.inferType(error)
    }

    const metadata = context?.metadata
      ? sanitizeObject(context.metadata)
      : undefined

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      message,
      stack,
      endpoint: context?.endpoint,
      method: context?.method,
      userId: context?.userId,
      orgId: context?.orgId,
      statusCode: context?.statusCode ?? this.extractStatusCode(error),
      metadata,
    }
  }

  private addEntry(entry: ErrorEntry): void {
    // Add to front of array (newest first)
    this.errors.unshift(entry)

    // Trim to max size (ring buffer behavior)
    if (this.errors.length > this.maxSize) {
      this.errors.length = this.maxSize
    }

    // Update error counts for grouping
    const countKey = `${entry.type}::${entry.endpoint || '*'}::${entry.statusCode || 0}`
    this.errorCounts.set(countKey, (this.errorCounts.get(countKey) || 0) + 1)
  }

  private extractStatusCode(error: unknown): number | undefined {
    try {
      if (error && typeof error === 'object' && 'status' in error) {
        return (error as { status: number }).status
      }
      if (error && typeof error === 'object' && 'statusCode' in error) {
        return (error as { statusCode: number }).statusCode
      }
    } catch {
      // Ignore
    }
    return undefined
  }

  private inferType(error: Error): ErrorEntry['type'] {
    const name = error.name || ''
    const msg = error.message || ''

    if (name === 'ZodError' || msg.includes('Validation')) return 'validation'
    if (name === 'DatabaseUnavailableError' || msg.includes('database') || msg.includes('connect')) return 'database'
    if (name === 'ApiError') return 'api'
    if (msg.includes('auth') || msg.includes('Unauthorized') || msg.includes('token')) return 'auth'
    if (msg.includes('AI') || msg.includes('OpenAI') || msg.includes('gemini')) return 'ai'

    return 'unknown'
  }
}

// Singleton instance
export const errorMonitor = new ErrorMonitor()

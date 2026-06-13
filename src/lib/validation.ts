// ============================================
// Validation Utilities — Reusable form/input validation
// ============================================

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

// ============================================
// Field Validators
// ============================================

export function validateRequired(value: string, fieldName: string): ValidationError | null {
  if (!value || !value.trim()) {
    return { field: fieldName, message: `${fieldName} is required` }
  }
  return null
}

export function validateEmail(value: string, fieldName = 'Email'): ValidationError | null {
  if (!value) return null // Use validateRequired for required check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value)) {
    return { field: fieldName, message: 'Please enter a valid email address' }
  }
  return null
}

export function validatePhone(value: string, fieldName = 'Phone'): ValidationError | null {
  if (!value) return null
  // Accept formats: +251912345678, 0912345678, 251912345678
  const phoneRegex = /^(\+?251|0)?[79]\d{8}$/
  const cleaned = value.replace(/[\s\-()]/g, '')
  if (!phoneRegex.test(cleaned)) {
    return { field: fieldName, message: 'Please enter a valid Ethiopian phone number (e.g. +251912345678)' }
  }
  return null
}

export function validateMinLength(value: string, minLength: number, fieldName: string): ValidationError | null {
  if (!value) return null
  if (value.length < minLength) {
    return { field: fieldName, message: `${fieldName} must be at least ${minLength} characters` }
  }
  return null
}

export function validateNumber(value: string | number, fieldName: string, options?: {
  min?: number
  max?: number
  integer?: boolean
}): ValidationError | null {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) {
    return { field: fieldName, message: `${fieldName} must be a valid number` }
  }
  if (options?.integer && !Number.isInteger(num)) {
    return { field: fieldName, message: `${fieldName} must be a whole number` }
  }
  if (options?.min !== undefined && num < options.min) {
    return { field: fieldName, message: `${fieldName} must be at least ${options.min}` }
  }
  if (options?.max !== undefined && num > options.max) {
    return { field: fieldName, message: `${fieldName} must be at most ${options.max}` }
  }
  return null
}

export function validatePositiveNumber(value: string | number, fieldName: string): ValidationError | null {
  return validateNumber(value, fieldName, { min: 0 })
}

export function validateUrl(value: string, fieldName = 'URL'): ValidationError | null {
  if (!value) return null
  try {
    new URL(value)
    return null
  } catch {
    return { field: fieldName, message: 'Please enter a valid URL' }
  }
}

export function validatePassword(value: string, fieldName = 'Password'): ValidationError | null {
  if (!value) return { field: fieldName, message: 'Password is required' }
  if (value.length < 8) {
    return { field: fieldName, message: 'Password must be at least 8 characters' }
  }
  if (!/[A-Z]/.test(value)) {
    return { field: fieldName, message: 'Password must contain at least one uppercase letter' }
  }
  if (!/[a-z]/.test(value)) {
    return { field: fieldName, message: 'Password must contain at least one lowercase letter' }
  }
  if (!/\d/.test(value)) {
    return { field: fieldName, message: 'Password must contain at least one digit' }
  }
  if (!/[!@#$%^&*()_+\-=[\]{}|;:'",.<>?/`~]/.test(value)) {
    return { field: fieldName, message: 'Password must contain at least one special character' }
  }
  return null
}

// ============================================
// Form Validator — Combines multiple validations
// ============================================

export function validateForm(validations: (ValidationError | null)[]): ValidationResult {
  const errors = validations.filter((e): e is ValidationError => e !== null)
  return { valid: errors.length === 0, errors }
}

// ============================================
// Error Message Helpers — Sanitized for user display
// ============================================

// Known user-friendly error patterns from the server that should be passed through
const KNOWN_USER_FRIENDLY_ERRORS = [
  'Invalid email or password',
  'Email already registered',
  'Account not configured for password login',
  'Organization slug already taken',
  'Invalid or inactive sales representative',
  'You are already a member',
  'Already a member of this organization',
  'Password reset token has expired',
  'Invalid reset token',
  'Database is unreachable',
  'Shop not found',
  'Product not found',
  'Customer not found',
  'Sale not found',
  'Supplier not found',
  'Insufficient stock',
  'Cannot delete',
  'Name is required',
  'orgId is required',
  'Unauthorized',
  'Forbidden',
  'Your session has expired',
  'Email already in use',
  'Sales representative not found',
  'Invalid invitation',
  'Invitation expired',
  'Invitation already accepted',
] as const

/**
 * Check if an error message is a known user-friendly message from the server.
 * These are safe to display to users.
 */
function isKnownUserFriendlyError(message: string): boolean {
  return KNOWN_USER_FRIENDLY_ERRORS.some(known => message.includes(known))
}

/**
 * Detect if a raw error message contains technical/internal details
 * that should never be shown to users (stack traces, Prisma codes, etc.)
 */
function isTechnicalErrorMessage(message: string): boolean {
  const technicalPatterns = [
    /PrismaClient/i,
    /P\d{4}$/,          // Prisma error codes like P2002, P1001
    /ECONNREFUSED/,
    /ENETUNREACH/,
    /ETIMEDOUT/,
    /ECONNRESET/,
    /fetch failed/,
    /at\s+\w+\s*\(/,    // Stack trace lines like "at functionName ("
    /\.\w+\.\w+:\d+/,   // File paths like "node_modules/foo/bar.js:42"
    /node_modules/,
    /webpack/,
    /Internal\/oauth/,
    /prisma\/schema/,
    /undefined is not/,
    /Cannot read propert/,
    /TypeError:/,
    /ReferenceError:/,
    /SyntaxError:/,
    /RangeError:/,
    /URIError:/,
    /EvalError:/,
  ]
  return technicalPatterns.some(pattern => pattern.test(message))
}

export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  if (err instanceof Error) {
    // Sanitize technical error messages
    if (isTechnicalErrorMessage(err.message)) {
      console.error('[Sanitized error for user]:', err.message)
      return fallback
    }
    return err.message
  }
  if (typeof err === 'string') {
    // Sanitize technical string errors too
    if (isTechnicalErrorMessage(err)) {
      console.error('[Sanitized error for user]:', err)
      return fallback
    }
    return err
  }
  return fallback
}

export function getNetworkErrorMessage(err: unknown): string {
  if (err instanceof TypeError && err.message === 'Failed to fetch') {
    return 'Network error — please check your internet connection and try again'
  }
  if (err instanceof Error) {
    if (err.message.includes('500')) return 'Server error — please try again later'
    if (err.message.includes('401')) return 'Your session has expired. Please log in again.'
    if (err.message.includes('403')) return 'You do not have permission to perform this action'
    if (err.message.includes('404')) return 'The requested resource was not found'
    if (err.message.includes('429')) return 'Too many requests — please wait a moment and try again'

    // If it's a known user-friendly message from the server, pass it through
    if (isKnownUserFriendlyError(err.message)) {
      return err.message
    }

    // If the message looks like a technical/internal error, hide it
    if (isTechnicalErrorMessage(err.message)) {
      console.error('[Sanitized error for user]:', err.message)
      return 'An unexpected error occurred. Please try again.'
    }

    // For other errors, still sanitize but pass through if short and reasonable
    // (likely a custom server message we haven't listed above)
    if (err.message.length <= 150 && !err.message.includes('\n')) {
      return err.message
    }

    // Long messages or multi-line messages are likely technical — sanitize
    console.error('[Sanitized error for user]:', err.message)
    return 'An unexpected error occurred. Please try again.'
  }
  return 'An unexpected error occurred. Please try again.'
}

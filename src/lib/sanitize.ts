/**
 * Sanitize user input by stripping HTML tags, event handlers, JavaScript URLs,
 * and trimming whitespace.
 * Prevents XSS by removing potentially dangerous HTML/script content.
 */
export function sanitizeInput(input: string): string {
  if (!input) return input
  return input
    // Remove event handlers (onerror=, onclick=, etc.) before removing tags
    // This catches both <img onerror=...> and standalone on* attributes
    .replace(/\bon\w+\s*=\s*(["'][^"']*["']|\S+)/gi, '')
    // Remove javascript: URLs
    .replace(/javascript\s*:/gi, '')
    // Remove data: URLs that could contain scripts
    .replace(/data\s*:\s*text\/html/gi, '')
    // Strip HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode and re-sanitize to prevent double-encoding bypass
    .replace(/&#x?0*([0-9a-f]+);?/gi, (_, hex) => {
      const code = parseInt(hex, 16)
      return code < 32 ? '' : String.fromCharCode(code)
    })
    .replace(/&(#\d+|#x[0-9a-f]+);/gi, '')
    .trim()
}

/**
 * Sanitize and limit string length to prevent excessively long inputs.
 * Returns the sanitized (and possibly truncated) string, or the original
 * falsy value if input is empty/null/undefined.
 */
export function sanitizeAndTruncate(input: string, maxLength: number = 255): string {
  if (!input) return input
  const sanitized = sanitizeInput(input)
  return sanitized.length > maxLength ? sanitized.slice(0, maxLength) : sanitized
}

/**
 * Validate that a required text field is not empty after sanitization.
 * Returns an error message if the field contains only HTML tags/whitespace,
 * or null if the field is valid.
 */
export function validateSanitizedField(
  originalValue: string | undefined | null,
  sanitizedValue: string | undefined | null,
  fieldName: string
): string | null {
  if (originalValue && !sanitizedValue) {
    return `${fieldName} contains only invalid characters`
  }
  return null
}

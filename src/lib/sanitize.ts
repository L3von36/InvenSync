/**
 * Sanitize user input by stripping HTML tags and trimming whitespace.
 * Prevents XSS by removing potentially dangerous HTML/script content.
 */
export function sanitizeInput(input: string): string {
  if (!input) return input
  return input
    .replace(/<[^>]*>/g, '') // Strip HTML tags
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

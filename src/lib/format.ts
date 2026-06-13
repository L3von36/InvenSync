// ============================================
// InvenSync Shared Formatting Utilities
// Single source of truth for all display formatting
// ============================================

/**
 * Format a number as ETB currency.
 * Standard format: "ETB X,XXX.XX"
 *
 * @param amount - The numeric amount to format
 * @param options - Optional configuration
 * @param options.decimals - Number of decimal places (default: 2)
 */
export function formatETB(
  amount: number,
  options?: { decimals?: number }
): string {
  const decimals = options?.decimals ?? 2
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  const sign = amount < 0 ? '-' : ''
  return `${sign}ETB ${formatted}`
}

/**
 * Format a date string as "Jan 15, 2025"
 * Returns '—' for null/undefined/empty values.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014' // em dash
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format a date string as "Jan 15" (no year)
 * Returns '—' for null/undefined/empty values.
 */
export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format a date string with time as "Jan 15, 2025, 2:30 PM"
 * Returns '—' for null/undefined/empty values.
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format a date string as time only "2:30 PM"
 * Returns '—' for null/undefined/empty values.
 */
export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014'
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format a number with thousand separators: "1,234,567"
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

/**
 * Format a number as percentage with 1 decimal: "12.3%"
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

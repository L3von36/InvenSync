// ============================================
// Shared Admin Utilities
// ============================================
// Centralized helpers used across all admin pages.
// Previously duplicated in 7+ files.

/**
 * Format a number as Ethiopian Birr (ETB)
 */
export function formatETB(amount: number): string {
  return `ETB ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

/**
 * Format a date string to a readable format
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format a date string with time
 */
export function formatDateWithTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Get initials from a name (up to 2 characters)
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// ============================================
// Badge Color Helpers
// ============================================

/**
 * Business type badge CSS classes
 */
export function businessTypeBadge(type: string): string {
  const colors: Record<string, string> = {
    retail: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    service: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
    mixed: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    shoe_store: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
    clothing_store: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
    mobile_phone_shop: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    grocery_minimart: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    cosmetics_shop: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
    hardware_store: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    restaurant_cafe: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    electronics_store: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    pharmacy: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    general_retail: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  }
  return colors[type] || 'bg-gray-100 text-gray-800'
}

/**
 * Business type dot color (for map markers)
 */
export function businessTypeColor(type: string): string {
  const colors: Record<string, string> = {
    retail: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    service: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    mixed: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    shoe_store: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    clothing_store: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    mobile_phone_shop: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    grocery_minimart: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    cosmetics_shop: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
    hardware_store: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    restaurant_cafe: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    electronics_store: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    pharmacy: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    general_retail: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  }
  return colors[type] || 'bg-gray-100 text-gray-800'
}

/**
 * Subscription plan badge CSS classes
 */
export function planBadge(plan: string): string {
  const colors: Record<string, string> = {
    starter: 'bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300',
    pro: 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300',
    enterprise: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  }
  return colors[plan] || 'bg-gray-100 text-gray-800'
}

/**
 * Subscription status badge CSS classes
 */
export function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    suspended: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    trial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    expired: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

/**
 * Module subscription status badge CSS classes
 */
export function moduleStatusBadge(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    trial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    expired: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400',
    requested: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

/**
 * User role badge CSS classes
 */
export function roleBadge(role: string): string {
  const colors: Record<string, string> = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    sales_rep: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    user: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  }
  return colors[role] || 'bg-gray-100 text-gray-800'
}

/**
 * Notification type badge CSS classes
 */
export function notificationTypeBadge(type: string): string {
  const colors: Record<string, string> = {
    info: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    announcement: 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300',
  }
  return colors[type] || 'bg-gray-100 text-gray-800'
}

/**
 * Module category badge CSS classes
 */
export function categoryBadge(category: string): string {
  const colors: Record<string, string> = {
    core: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    ai: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    integration: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
    analytics: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    communication: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
    reporting: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  }
  return colors[category] || 'bg-gray-100 text-gray-800'
}

/**
 * Progress bar color based on percentage
 */
export function progressColor(pct: number): string {
  if (pct < 25) return 'bg-red-500'
  if (pct <= 75) return 'bg-amber-500'
  return 'bg-emerald-500'
}

/**
 * Progress track color based on percentage
 */
export function progressTrackColor(pct: number): string {
  if (pct < 25) return 'bg-red-100 dark:bg-red-900/30'
  if (pct <= 75) return 'bg-amber-100 dark:bg-amber-900/30'
  return 'bg-emerald-100 dark:bg-emerald-900/30'
}

/**
 * Chart color palette
 */
export const CHART_COLORS = [
  '#ea580c', '#06b6d4', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#6366f1',
]

/**
 * Calculate days until a date (null if no date)
 */
export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * Slugify text for URL-safe slugs
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

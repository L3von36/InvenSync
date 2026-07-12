// ============================================
// Client-generated record IDs
// ============================================
// Offline-first creates generate their record ID on the client (UUID) and
// the server accepts it as canonical. This removes the "two-ID problem":
// no local_-to-server ID remapping, no duplicate rows after the next pull,
// and offline-created children can safely reference offline-created parents.
//
// Isomorphic: usable from browser code and API routes.

/** Generates a globally-unique, server-valid record ID. */
export function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for very old runtimes without crypto.randomUUID
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CUID_RE = /^c[a-z0-9]{20,32}$/

/**
 * Server-side validation for client-supplied record IDs.
 * Accepts UUIDs (client-generated) and cuids (Prisma's server default),
 * rejecting anything else so callers can't inject arbitrary key material.
 */
export function isValidClientId(id: unknown): id is string {
  if (typeof id !== 'string') return false
  return UUID_RE.test(id) || CUID_RE.test(id)
}

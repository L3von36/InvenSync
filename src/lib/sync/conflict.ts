// ============================================
// Conflict Resolution Strategies for Sync Engine
// ============================================
// Provides pluggable conflict resolution for the offline-first
// sync engine. Each entity can have a default strategy, and
// delta-merge is available for numeric fields (quantity, paidAmount)
// where both sides' changes must be accumulated rather than
// overwritten.
// ============================================

// -------------------------------------------
// Types
// -------------------------------------------

export type ConflictStrategy = 'last-write-wins' | 'server-wins' | 'client-wins' | 'delta-merge' | 'manual'

export interface ConflictInfo {
  entity: string
  localId: string
  serverId?: string
  operation: 'create' | 'update' | 'delete'
  localData: Record<string, unknown>
  serverData: Record<string, unknown>
  localUpdatedAt: string
  serverUpdatedAt: string
  conflictingFields: string[]
}

export interface ConflictResolution {
  strategy: ConflictStrategy
  resolvedData: Record<string, unknown> | null  // null means discard
  winner: 'local' | 'server' | 'merged'
}

// -------------------------------------------
// Delta Fields Per Entity
// -------------------------------------------

/**
 * Fields within each entity that should use delta-merge semantics
 * instead of simple last-write-wins. These are typically counter-style
 * numeric fields where concurrent changes should be accumulated.
 */
const DELTA_FIELDS: Record<string, string[]> = {
  products: ['quantity'],
  stockMovements: ['quantity'],
  debts: ['paidAmount'],
}

/**
 * Key used inside the outbox payload to store the baseline values
 * that were current when the local edit started. This allows
 * delta-merge to compute the local delta correctly.
 */
export const BASE_VALUES_KEY = '_baseValues'

// -------------------------------------------
// Strategy Map
// -------------------------------------------

export const STRATEGY_MAP: Record<string, ConflictStrategy> = {
  products: 'delta-merge',       // quantity is a delta field
  stockMovements: 'delta-merge', // quantity changes should merge
  sales: 'last-write-wins',
  saleItems: 'last-write-wins',
  customers: 'last-write-wins',
  suppliers: 'last-write-wins',
  debts: 'delta-merge',          // paidAmount is a delta field
  expenses: 'last-write-wins',
  purchaseOrders: 'last-write-wins',
  serviceBookings: 'last-write-wins',
  categories: 'last-write-wins',
  shops: 'last-write-wins',
}

// -------------------------------------------
// Public API
// -------------------------------------------

/**
 * Returns the default conflict resolution strategy for a given entity.
 * Falls back to 'last-write-wins' for unknown entities.
 */
export function getDefaultStrategy(entity: string): ConflictStrategy {
  return STRATEGY_MAP[entity] ?? 'last-write-wins'
}

/**
 * Main entry point — resolves a conflict using the specified strategy
 * or the entity's default strategy.
 *
 * - For `stockMovements` entity: uses 'delta-merge'
 * - For entities with a `quantity` field: uses 'delta-merge'
 * - Otherwise: uses 'last-write-wins'
 * - An explicit `strategy` parameter overrides the default
 */
export function resolveConflict(
  conflict: ConflictInfo,
  strategy?: ConflictStrategy,
): ConflictResolution {
  const effectiveStrategy = strategy ?? selectDefaultStrategy(conflict)

  switch (effectiveStrategy) {
    case 'last-write-wins':
      return lastWriteWins(conflict)
    case 'server-wins':
      return serverWins(conflict)
    case 'client-wins':
      return clientWins(conflict)
    case 'delta-merge':
      return deltaMerge(conflict)
    case 'manual':
      // Manual resolution requires user intervention — return null data
      return {
        strategy: 'manual',
        resolvedData: null,
        winner: 'merged', // no automatic winner; awaiting manual choice
      }
    default:
      return lastWriteWins(conflict)
  }
}

// -------------------------------------------
// Strategy Implementations
// -------------------------------------------

/**
 * Last-Write-Wins: compare `updatedAt` timestamps and keep the
 * newer version. If timestamps are equal, server wins as tie-breaker.
 */
export function lastWriteWins(conflict: ConflictInfo): ConflictResolution {
  const localTime = new Date(conflict.localUpdatedAt).getTime()
  const serverTime = new Date(conflict.serverUpdatedAt).getTime()

  if (localTime > serverTime) {
    return {
      strategy: 'last-write-wins',
      resolvedData: { ...conflict.localData },
      winner: 'local',
    }
  }

  // Server wins on tie or newer timestamp
  return {
    strategy: 'last-write-wins',
    resolvedData: { ...conflict.serverData },
    winner: 'server',
  }
}

/**
 * Server-Wins: always use the server's version of the data.
 */
export function serverWins(conflict: ConflictInfo): ConflictResolution {
  return {
    strategy: 'server-wins',
    resolvedData: { ...conflict.serverData },
    winner: 'server',
  }
}

/**
 * Client-Wins: always use the local version, effectively force-pushing
 * it to the server.
 */
export function clientWins(conflict: ConflictInfo): ConflictResolution {
  return {
    strategy: 'client-wins',
    resolvedData: { ...conflict.localData },
    winner: 'local',
  }
}

/**
 * Delta-Merge: for numeric counter fields (quantity, paidAmount), merge
 * both sides' deltas instead of picking one absolute value.
 *
 * Formula:
 *   mergedValue = serverValue + (localValue - baseValue)
 *
 * Where `baseValue` is the field value at the time the local edit began.
 * Base values are stored in the outbox payload under `_baseValues`.
 *
 * Example (product quantity):
 *   base     = 100  (value when local edit started)
 *   local    = 95   (local decreased by 5)
 *   server   = 97   (server decreased by 3)
 *   merged   = 97 + (95 - 100) = 92  (original - 5 - 3)
 *
 * For non-delta fields, falls back to last-write-wins.
 */
export function deltaMerge(conflict: ConflictInfo): ConflictResolution {
  const deltaFields = DELTA_FIELDS[conflict.entity] ?? []
  const baseValues = (conflict.localData[BASE_VALUES_KEY] ?? {}) as Record<string, unknown>

  // Start from server data as the base for the merged result
  const merged: Record<string, unknown> = { ...conflict.serverData }
  let hasMerge = false

  for (const field of deltaFields) {
    const localVal = conflict.localData[field]
    const serverVal = conflict.serverData[field]
    const baseVal = baseValues[field]

    // Only attempt delta merge if we have all three values and they are numeric
    if (
      typeof localVal === 'number' &&
      typeof serverVal === 'number' &&
      typeof baseVal === 'number'
    ) {
      const localDelta = localVal - baseVal
      merged[field] = serverVal + localDelta
      hasMerge = true
    }
    // If base value is missing, fall back to last-write-wins for this field
    // (already have server value in merged, which is the LWW server-wins result)
  }

  // For all other conflicting fields (non-delta), apply last-write-wins
  const lwwResult = lastWriteWins(conflict)
  for (const field of conflict.conflictingFields) {
    // Skip delta fields (already handled above) and metadata fields
    if (deltaFields.includes(field)) continue
    if (field === 'updatedAt' || field === 'createdAt' || field === 'id') continue
    if (field === BASE_VALUES_KEY) continue

    // Use the LWW winner's value for non-delta fields
    merged[field] = lwwResult.resolvedData![field] ?? merged[field]
  }

  // Ensure updatedAt reflects the merge
  merged['updatedAt'] = new Date().toISOString()

  // Remove the base values key from the final merged data — it's internal
  delete merged[BASE_VALUES_KEY]

  return {
    strategy: 'delta-merge',
    resolvedData: merged,
    winner: hasMerge ? 'merged' : lwwResult.winner,
  }
}

// -------------------------------------------
// Conflict Detection
// -------------------------------------------

/**
 * Compares two versions of an entity and returns the field names
 * whose values differ. Ignores metadata fields (`updatedAt`,
 * `createdAt`, `id`) since those always differ and are not
 * semantically meaningful for conflict detection.
 */
export function findConflictingFields(
  local: Record<string, unknown>,
  server: Record<string, unknown>,
): string[] {
  const ignored = new Set(['updatedAt', 'createdAt', 'id'])
  const allKeys = new Set([...Object.keys(local), ...Object.keys(server)])
  const conflicting: string[] = []

  for (const key of allKeys) {
    if (ignored.has(key)) continue
    if (key === BASE_VALUES_KEY) continue // internal field

    const localVal = local[key]
    const serverVal = server[key]

    if (!isEqual(localVal, serverVal)) {
      conflicting.push(key)
    }
  }

  return conflicting
}

// -------------------------------------------
// Internal Helpers
// -------------------------------------------

/**
 * Selects the default conflict strategy for a conflict based on
 * its entity type. Uses STRATEGY_MAP first, then heuristic:
 * - stockMovements → delta-merge
 * - entities with a `quantity` field → delta-merge
 * - everything else → last-write-wins
 */
function selectDefaultStrategy(conflict: ConflictInfo): ConflictStrategy {
  // 1. Explicit entity mapping
  const mapped = STRATEGY_MAP[conflict.entity]
  if (mapped) return mapped

  // 2. Heuristic: stockMovements always uses delta-merge
  if (conflict.entity === 'stockMovements') return 'delta-merge'

  // 3. Heuristic: if the entity data contains a `quantity` field, use delta-merge
  if (
    'quantity' in conflict.localData ||
    'quantity' in conflict.serverData
  ) {
    return 'delta-merge'
  }

  // 4. Default
  return 'last-write-wins'
}

/**
 * Shallow equality check for two values.
 * Handles primitives and simple objects/arrays via JSON serialization.
 */
function isEqual(a: unknown, b: unknown): boolean {
  // Fast path for primitives and same reference
  if (a === b) return true

  // Both null/undefined
  if (a == null && b == null) return true

  // One null/undefined but not the other
  if (a == null || b == null) return false

  // Compare types
  if (typeof a !== typeof b) return false

  // For objects/arrays, use JSON comparison as a reasonable heuristic
  if (typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch {
      return false
    }
  }

  return false
}

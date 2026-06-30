// ============================================
// Sync Engine — Offline-first sync with outbox pattern
// ============================================
// Manages bidirectional sync between local Dexie database
// and remote API. Uses an outbox table for offline writes
// and delta sync for pulls.
//
// This REPLACES the older offline-queue.ts module.
// ============================================

import { authFetch } from '@/lib/auth-fetch'
import { db } from '@/lib/db'
import {
  resolveConflict,
  findConflictingFields,
  type ConflictInfo,
  BASE_VALUES_KEY,
} from '@/lib/sync/conflict'

// ============================================
// Types
// ============================================

export interface OutboxItem {
  id: string
  entity: string
  operation: 'create' | 'update' | 'delete'
  payload: string
  localId?: string
  serverId?: string
  createdAt: string
  retryCount: number
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict'
  error?: string
  lastAttemptAt?: string | null
}

export interface SyncEvent {
  id: string
  type:
    | 'sync_start'
    | 'sync_progress'
    | 'sync_complete'
    | 'sync_error'
    | 'item_synced'
    | 'item_failed'
    | 'item_conflict'
    | 'delta_sync_start'
    | 'delta_sync_complete'
  entity?: string
  details?: string
  timestamp: number
  progress?: { completed: number; total: number }
}

export interface SyncStatus {
  isSyncing: boolean
  lastSyncedAt: Date | null
  pendingCount: number
  failedCount: number
  conflictCount: number
  pendingByEntity: Record<string, number>
  recentEvents: SyncEvent[]
}

type SyncStatusListener = (status: SyncStatus) => void

// ============================================
// Entity Mappings
// ============================================

const ENTITY_ENDPOINTS: Record<string, string> = {
  products: '/api/products',
  categories: '/api/product-types',
  customers: '/api/customers',
  suppliers: '/api/suppliers',
  sales: '/api/sales',
  saleItems: '/api/sales',
  stockMovements: '/api/inventory',
  debts: '/api/debts',
  expenses: '/api/expenses',
  purchaseOrders: '/api/purchase-orders',
  serviceBookings: '/api/service-bookings',
  serviceTypes: '/api/service-types',
  shops: '/api/shops',
}

const ENTITY_TABLES: Record<string, string> = {
  products: 'products',
  categories: 'categories',
  customers: 'customers',
  suppliers: 'suppliers',
  sales: 'sales',
  saleItems: 'saleItems',
  stockMovements: 'stockMovements',
  debts: 'debts',
  expenses: 'expenses',
  purchaseOrders: 'purchaseOrders',
  serviceBookings: 'serviceBookings',
  serviceTypes: 'serviceTypes',
  shops: 'shops',
}

const ALL_ENTITIES = Object.keys(ENTITY_ENDPOINTS)

// Exponential backoff delays: 2s, 8s, 30s, 2m, 10m
const BACKOFF_DELAYS = [2000, 8000, 30000, 120000, 600000]

const MAX_RETRIES = 5

// ============================================
// Helpers
// ============================================

function generateId(): string {
  return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function getBackoffDelay(retryCount: number): number {
  const index = Math.min(retryCount, BACKOFF_DELAYS.length) - 1
  return index >= 0 ? BACKOFF_DELAYS[index] : BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1]
}

function isReadyForRetry(item: OutboxItem): boolean {
  if (item.retryCount === 0) return true
  if (!item.lastAttemptAt) return true
  const delay = getBackoffDelay(item.retryCount)
  return Date.now() - new Date(item.lastAttemptAt).getTime() >= delay
}

function getMethodForOperation(operation: OutboxItem['operation']): string {
  switch (operation) {
    case 'create':
      return 'POST'
    case 'update':
      return 'PUT'
    case 'delete':
      return 'DELETE'
  }
}

// ============================================
// Connectivity Service Interface
// ============================================
// Minimal interface for the connectivity service.
// We import dynamically to handle the case where
// the module hasn't been created yet.

interface ConnectivityService {
  isOnline: boolean
  subscribe(callback: (online: boolean) => void): () => void
}

let connectivityService: ConnectivityService | null = null

async function getConnectivityService(): Promise<ConnectivityService | null> {
  if (connectivityService) return connectivityService
  try {
    const mod = await import('@/lib/sync/connectivity')
    connectivityService = mod.connectivityService ?? mod.default ?? null
    return connectivityService
  } catch {
    console.log('[Sync] Connectivity service not available, assuming online')
    return null
  }
}

// ============================================
// Dexie Database Helper
// ============================================

function getDexieDb(): typeof db | null {
  if (typeof window === 'undefined') return null
  try {
    return db
  } catch {
    return null
  }
}

// ============================================
// SyncEngine Class
// ============================================

class SyncEngine {
  private isSyncing = false
  private lastSyncedAt: Date | null = null
  private listeners: Set<SyncStatusListener> = new Set()
  private recentEvents: SyncEvent[] = []
  private maxRecentEvents = 50
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null
  private pullTimer: ReturnType<typeof setInterval> | null = null
  private connectivityCleanup: (() => void) | null = null
  private abortController: AbortController | null = null
  // Org/shop context for auto-pull (set when startAutoSync is called with context)
  private syncContext: { orgId: string; shopId?: string } | null = null

  constructor() {
    if (typeof window === 'undefined') return
    console.log('[Sync] Engine initialized')
  }

  // ------------------------------------------
  // Event System
  // ------------------------------------------

  private emitEvent(
    type: SyncEvent['type'],
    entity?: string,
    details?: string,
    progress?: { completed: number; total: number }
  ): void {
    const event: SyncEvent = {
      id: generateId(),
      type,
      entity,
      details,
      timestamp: Date.now(),
      progress,
    }

    this.recentEvents.unshift(event)
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents = this.recentEvents.slice(0, this.maxRecentEvents)
    }

    console.log(
      `[Sync] ${type}${entity ? ` (${entity})` : ''}${details ? ` — ${details}` : ''}`
    )

    this.notifyListeners()
  }

  private notifyListeners(): void {
    const status = this.getStatus()
    for (const listener of this.listeners) {
      try {
        listener(status)
      } catch (err) {
        console.error('[Sync] Listener error:', err)
      }
    }
  }

  // ------------------------------------------
  // Status
  // ------------------------------------------

  async getStatus(): Promise<SyncStatus> {
    const dexieDb = getDexieDb()

    let pendingCount = 0
    let failedCount = 0
    let conflictCount = 0
    const pendingByEntity: Record<string, number> = {}

    if (dexieDb) {
      try {
        const allItems: OutboxItem[] = await dexieDb.outbox.toArray()

        for (const item of allItems) {
          if (item.status === 'pending' || item.status === 'syncing') {
            pendingCount++
            pendingByEntity[item.entity] = (pendingByEntity[item.entity] ?? 0) + 1
          } else if (item.status === 'failed') {
            failedCount++
          } else if (item.status === 'conflict') {
            conflictCount++
          }
        }
      } catch (err) {
        console.error('[Sync] Failed to read outbox status:', err)
      }
    }

    return {
      isSyncing: this.isSyncing,
      lastSyncedAt: this.lastSyncedAt,
      pendingCount,
      failedCount,
      conflictCount,
      pendingByEntity,
      recentEvents: [...this.recentEvents],
    }
  }

  // ------------------------------------------
  // Subscribe
  // ------------------------------------------

  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener)

    // Immediately push current status
    this.getStatus().then((status) => {
      try {
        listener(status)
      } catch {
        // Ignore listener errors during initial push
      }
    })

    return () => {
      this.listeners.delete(listener)
    }
  }

  // ------------------------------------------
  // Push — Drain the outbox
  // ------------------------------------------

  async push(): Promise<{ synced: number; failed: number; conflicts: number }> {
    if (typeof window === 'undefined') {
      return { synced: 0, failed: 0, conflicts: 0 }
    }

    const dexieDb = getDexieDb()
    if (!dexieDb) {
      console.log('[Sync] Database not available, skipping push')
      return { synced: 0, failed: 0, conflicts: 0 }
    }

    // Check connectivity
    const connService = await getConnectivityService()
    if (connService && !connService.isOnline) {
      console.log('[Sync] Offline, skipping push')
      return { synced: 0, failed: 0, conflicts: 0 }
    }

    if (this.isSyncing) {
      console.log('[Sync] Already syncing, skipping push')
      return { synced: 0, failed: 0, conflicts: 0 }
    }

    this.isSyncing = true
    this.abortController = new AbortController()
    this.emitEvent('sync_start')

    let synced = 0
    let failed = 0
    let conflicts = 0

    try {
      // Get all pending items ordered by createdAt ASC
      const pendingItems: OutboxItem[] = await dexieDb.outbox
        .where('status')
        .anyOf(['pending', 'failed'])
        .sortBy('createdAt')

      // Filter items that are ready for retry (respecting backoff)
      const readyItems = pendingItems.filter((item) => {
        if (item.status === 'pending') return true
        if (item.status === 'failed') return isReadyForRetry(item)
        return false
      })

      if (readyItems.length === 0) {
        this.emitEvent('sync_complete', undefined, 'No pending items')
        return { synced: 0, failed: 0, conflicts: 0 }
      }

      console.log(`[Sync] Processing ${readyItems.length} outbox items`)

      // Process items sequentially to maintain order
      for (let i = 0; i < readyItems.length; i++) {
        // Check if aborted
        if (this.abortController?.signal.aborted) {
          console.log('[Sync] Push aborted')
          break
        }

        const item = readyItems[i]
        this.emitEvent('sync_progress', item.entity, `Processing ${item.operation}`, {
          completed: i,
          total: readyItems.length,
        })

        const result = await this.processOutboxItem(item)

        if (result === 'synced') {
          synced++
        } else if (result === 'conflict') {
          conflicts++
        } else if (result === 'failed') {
          failed++
        }
      }

      this.lastSyncedAt = new Date()
      this.emitEvent(
        'sync_complete',
        undefined,
        `Synced: ${synced}, Failed: ${failed}, Conflicts: ${conflicts}`,
        { completed: readyItems.length, total: readyItems.length }
      )
    } catch (err) {
      console.error('[Sync] Push error:', err)
      this.emitEvent('sync_error', undefined, String(err))
    } finally {
      this.isSyncing = false
      this.abortController = null
    }

    return { synced, failed, conflicts }
  }

  private async processOutboxItem(
    item: OutboxItem
  ): Promise<'synced' | 'failed' | 'conflict' | 'skipped'> {
    const dexieDb = getDexieDb()
    if (!dexieDb) return 'skipped'

    // Set status to syncing
    item.status = 'syncing'
    item.lastAttemptAt = new Date().toISOString()
    await dexieDb.outbox.put(item)

    try {
      // Try to use the original endpoint/method stored by offline-queue.ts
      // when the mutation was queued while offline. Falls back to entity
      // mapping when not present (e.g., writes from LocalRepository).
      let payloadObj: Record<string, unknown> | null = null
      try {
        payloadObj = typeof item.payload === 'string'
          ? JSON.parse(item.payload)
          : (item.payload as Record<string, unknown>)
      } catch {
        // Payload isn't valid JSON — use as-is
      }

      const originalEndpoint = payloadObj?._endpoint as string | undefined
      const originalMethod = payloadObj?._method as string | undefined

      // Strip _endpoint/_method from payload before sending to server
      let cleanPayload: string
      if (payloadObj && (payloadObj._endpoint || payloadObj._method)) {
        const { _endpoint, _method, _rawBody, ...rest } = payloadObj
        cleanPayload = JSON.stringify(rest)
      } else {
        cleanPayload = typeof item.payload === 'string' ? item.payload : JSON.stringify(item.payload)
      }

      const entityEndpoint = ENTITY_ENDPOINTS[item.entity]
      let url = originalEndpoint || entityEndpoint
      if (!url) {
        console.error(`[Sync] Unknown entity: ${item.entity}`)
        item.status = 'failed'
        item.error = `Unknown entity: ${item.entity}`
        await dexieDb.outbox.put(item)
        this.emitEvent('item_failed', item.entity, item.error)
        return 'failed'
      }

      const method = originalMethod || getMethodForOperation(item.operation)

      // For updates and deletes, append the ID to the URL
      // (but only if the URL doesn't already contain an ID path segment)
      if ((item.operation === 'update' || item.operation === 'delete') && !originalEndpoint) {
        const id = item.serverId || item.localId
        if (id) {
          url = `${entityEndpoint}/${id}`
        } else {
          console.error(`[Sync] No ID for ${item.operation} on ${item.entity}`)
          item.status = 'failed'
          item.error = `No ID available for ${item.operation} operation`
          await dexieDb.outbox.put(item)
          this.emitEvent('item_failed', item.entity, item.error)
          return 'failed'
        }
      }

      const fetchOptions: RequestInit & { contentType?: boolean } = {
        method,
      }

      // Add body for create and update
      if (item.operation === 'create' || item.operation === 'update') {
        fetchOptions.body = cleanPayload
      }

      const signal = this.abortController?.signal
      if (signal) {
        fetchOptions.signal = signal
      }

      const response = await authFetch(url, fetchOptions)

      // Success
      if (response.ok) {
        item.status = 'synced'

        // For creates, store the server-returned ID
        if (item.operation === 'create') {
          try {
            const data = await response.json()
            if (data?.id) {
              item.serverId = String(data.id)
            } else if (data?.data?.id) {
              item.serverId = String(data.data.id)
            }
          } catch {
            // Response wasn't JSON or had no ID, that's okay
          }
        }

        await dexieDb.outbox.put(item)
        this.emitEvent('item_synced', item.entity, `${item.operation} successful`)
        return 'synced'
      }

      // 409 Conflict — attempt automatic resolution before flagging as manual.
      //
      // The server returns its current version of the record in the 409 body.
      // We parse it, build a ConflictInfo, and call resolveConflict() with the
      // entity's default strategy (LWW for most entities, delta-merge for
      // products.quantity / debts.paidAmount / stockMovements.quantity).
      //
      // - If the strategy auto-resolves (LWW / server-wins / client-wins /
      //   delta-merge), we write the merged record to the server via PUT and
      //   update the local Dexie table. The outbox item is marked 'synced'.
      // - If the strategy is 'manual' (none currently), we fall back to the
      //   old behavior: mark the item as 'conflict' for the SyncPanel UI.
      if (response.status === 409) {
        let serverData: Record<string, unknown> = {}
        let serverBodyText = ''
        try {
          serverBodyText = await response.text()
          const parsed = JSON.parse(serverBodyText)
          // Server may return { record: {...} } or { data: {...} } or the record directly
          serverData = (parsed && (parsed.record || parsed.data || parsed)) || {}
        } catch {
          // Body wasn't JSON — can't auto-resolve
        }

        const localData = (payloadObj ?? {}) as Record<string, unknown>
        const recordId = String(serverData.id ?? item.serverId ?? item.localId ?? '')

        const conflictInfo: ConflictInfo = {
          entity: item.entity,
          localId: item.localId ?? recordId,
          serverId: item.serverId ?? (serverData.id ? String(serverData.id) : undefined),
          operation: item.operation,
          localData,
          serverData,
          localUpdatedAt: String(localData.updatedAt ?? new Date().toISOString()),
          serverUpdatedAt: String(serverData.updatedAt ?? new Date().toISOString()),
          conflictingFields: findConflictingFields(localData, serverData),
        }

        const resolution = resolveConflict(conflictInfo)

        if (resolution.strategy !== 'manual' && resolution.resolvedData) {
          // Auto-resolved — push the merged/winning version to the server.
          console.log(
            `[Sync] Conflict auto-resolved for ${item.entity} ${recordId} ` +
            `(strategy=${resolution.strategy}, winner=${resolution.winner}, ` +
            `conflictingFields=[${conflictInfo.conflictingFields.join(',')}])`
          )

          try {
            // Strip internal _baseValues before sending
            const mergedPayload = { ...resolution.resolvedData }
            delete (mergedPayload as Record<string, unknown>)[BASE_VALUES_KEY]
            delete (mergedPayload as Record<string, unknown>)['_endpoint']
            delete (mergedPayload as Record<string, unknown>)['_method']
            delete (mergedPayload as Record<string, unknown>)['_rawBody']

            const entityEndpoint = ENTITY_ENDPOINTS[item.entity]
            const updateUrl = `${entityEndpoint}/${recordId}`
            const updateResp = await authFetch(updateUrl, {
              method: 'PUT',
              body: JSON.stringify(mergedPayload),
              signal: this.abortController?.signal,
            })

            if (updateResp.ok) {
              // Update the local Dexie table with the resolved record
              const tableName = ENTITY_TABLES[item.entity]
              if (tableName) {
                try {
                  // Ensure the merged record has the right id + timestamps
                  const localRecord = {
                    ...resolution.resolvedData,
                    id: recordId,
                    updatedAt: new Date().toISOString(),
                  }
                  delete (localRecord as Record<string, unknown>)[BASE_VALUES_KEY]
                  await dexieDb.table(tableName).put(localRecord)
                } catch (err) {
                  console.warn(`[Sync] Failed to update local table after conflict resolution:`, err)
                }
              }

              item.status = 'synced'
              item.error = undefined
              await dexieDb.outbox.put(item)
              this.emitEvent(
                'item_synced',
                item.entity,
                `Conflict auto-resolved (${resolution.strategy}, ${resolution.winner})`
              )
              return 'synced'
            } else {
              // The re-PUT failed — fall back to flagging as conflict
              const errBody = await updateResp.text().catch(() => '')
              item.status = 'conflict'
              item.error = `Conflict resolution re-PUT failed (${updateResp.status}): ${errBody.slice(0, 200)}`
              await dexieDb.outbox.put(item)
              this.emitEvent('item_conflict', item.entity, item.error)
              return 'conflict'
            }
          } catch (err) {
            item.status = 'conflict'
            item.error = `Conflict resolution error: ${String(err)}`
            await dexieDb.outbox.put(item)
            this.emitEvent('item_conflict', item.entity, item.error)
            return 'conflict'
          }
        }

        // Manual strategy (or no server data to resolve with) — flag for user
        item.status = 'conflict'
        item.error = `Conflict (manual resolution required): ${serverBodyText.slice(0, 200)}`
        await dexieDb.outbox.put(item)
        this.emitEvent('item_conflict', item.entity, item.error)
        return 'conflict'
      }

      // 4xx Client Error (not conflict)
      if (response.status >= 400 && response.status < 500) {
        item.status = 'failed'
        try {
          const body = await response.text()
          item.error = `Client error ${response.status}: ${body}`
        } catch {
          item.error = `Client error: ${response.status}`
        }
        await dexieDb.outbox.put(item)
        this.emitEvent('item_failed', item.entity, item.error)
        return 'failed'
      }

      // 5xx Server Error or network error
      item.retryCount++
      if (item.retryCount > MAX_RETRIES) {
        item.status = 'failed'
        item.error = `Server error after ${MAX_RETRIES} retries: ${response.status}`
        await dexieDb.outbox.put(item)
        this.emitEvent('item_failed', item.entity, item.error)
        return 'failed'
      }

      // Keep as pending for retry with backoff
      item.status = 'pending'
      try {
        const body = await response.text()
        item.error = `Server error ${response.status} (retry ${item.retryCount}/${MAX_RETRIES}): ${body}`
      } catch {
        item.error = `Server error ${response.status} (retry ${item.retryCount}/${MAX_RETRIES})`
      }
      await dexieDb.outbox.put(item)
      this.emitEvent('item_failed', item.entity, item.error)
      return 'failed'
    } catch (err) {
      // Network error
      item.retryCount++
      if (item.retryCount > MAX_RETRIES) {
        item.status = 'failed'
        item.error = `Network error after ${MAX_RETRIES} retries: ${String(err)}`
        await dexieDb.outbox.put(item)
        this.emitEvent('item_failed', item.entity, item.error)
        return 'failed'
      }

      // Keep as pending for retry
      item.status = 'pending'
      item.error = `Network error (retry ${item.retryCount}/${MAX_RETRIES}): ${String(err)}`
      await dexieDb.outbox.put(item)
      this.emitEvent('item_failed', item.entity, item.error)
      return 'failed'
    }
  }

  // ------------------------------------------
  // Pull — Delta sync for a single entity
  // ------------------------------------------

  async pull(
    entity: string,
    orgId: string,
    shopId?: string
  ): Promise<{ pulled: number; deleted: number }> {
    if (typeof window === 'undefined') {
      return { pulled: 0, deleted: 0 }
    }

    const dexieDb = getDexieDb()
    if (!dexieDb) {
      console.log('[Sync] Database not available, skipping pull')
      return { pulled: 0, deleted: 0 }
    }

    const endpoint = ENTITY_ENDPOINTS[entity]
    const tableName = ENTITY_TABLES[entity]

    if (!endpoint || !tableName) {
      console.error(`[Sync] Unknown entity for pull: ${entity}`)
      return { pulled: 0, deleted: 0 }
    }

    // Read lastSyncedAt from syncMeta
    let lastSyncedAt: string | null = null
    try {
      const meta = await dexieDb.syncMeta.get(entity)
      if (meta?.lastSyncedAt) {
        lastSyncedAt = meta.lastSyncedAt
      }
    } catch (err) {
      console.error('[Sync] Failed to read syncMeta:', err)
    }

    this.emitEvent('delta_sync_start', entity, lastSyncedAt ? `Since ${lastSyncedAt}` : 'Full pull')

    try {
      // Build URL with query params
      const params = new URLSearchParams({ orgId })
      if (shopId) {
        params.set('shopId', shopId)
      }
      if (lastSyncedAt) {
        params.set('updatedSince', lastSyncedAt)
      }

      const url = `${endpoint}?${params.toString()}`
      const response = await authFetch(url)

      if (!response.ok) {
        throw new Error(`Pull failed for ${entity}: ${response.status}`)
      }

      const data = await response.json()
      const items: Record<string, unknown>[] = Array.isArray(data)
        ? data
        : Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.items)
            ? data.items
            : []

      let pulled = 0
      let deleted = 0

      const toUpsert: Record<string, unknown>[] = []
      const toDelete: string[] = []

      for (const item of items) {
        const isDeleted = item._deleted === true || item.isActive === false
        const itemId = String(item.id ?? item._id ?? '')

        if (isDeleted) {
          if (itemId) {
            toDelete.push(itemId)
          }
          deleted++
        } else {
          toUpsert.push(item)
          pulled++
        }
      }

      // Upsert items into local Dexie table
      if (toUpsert.length > 0) {
        try {
          await dexieDb.table(tableName).bulkPut(toUpsert)
        } catch (err) {
          console.error(`[Sync] bulkPut failed for ${tableName}:`, err)
          // Try individual puts as fallback
          for (const item of toUpsert) {
            try {
              await dexieDb.table(tableName).put(item)
            } catch {
              // Skip individual failures
            }
          }
        }
      }

      // Delete items marked as deleted
      for (const id of toDelete) {
        try {
          await dexieDb.table(tableName).delete(id)
        } catch {
          // Skip individual delete failures
        }
      }

      // Update syncMeta with current timestamp
      const now = new Date().toISOString()
      await dexieDb.syncMeta.put({
        id: entity,
        lastSyncedAt: now,
        entityCount: 0,
      })

      this.emitEvent(
        'delta_sync_complete',
        entity,
        `Pulled: ${pulled}, Deleted: ${deleted}`
      )

      return { pulled, deleted }
    } catch (err) {
      console.error(`[Sync] Pull error for ${entity}:`, err)
      this.emitEvent('sync_error', entity, String(err))
      return { pulled: 0, deleted: 0 }
    }
  }

  // ------------------------------------------
  // PullAll — Delta sync all entities
  // ------------------------------------------

  async pullAll(
    orgId: string,
    shopId?: string
  ): Promise<Record<string, { pulled: number; deleted: number }>> {
    if (typeof window === 'undefined') {
      return {}
    }

    // Check connectivity
    const connService = await getConnectivityService()
    if (connService && !connService.isOnline) {
      console.log('[Sync] Offline, skipping pullAll')
      return {}
    }

    this.emitEvent('sync_start', undefined, 'Delta sync all entities')

    const results: Record<string, { pulled: number; deleted: number }> = {}
    const total = ALL_ENTITIES.length

    for (let i = 0; i < ALL_ENTITIES.length; i++) {
      const entity = ALL_ENTITIES[i]
      this.emitEvent('sync_progress', entity, `Delta sync ${i + 1}/${total}`, {
        completed: i,
        total,
      })

      results[entity] = await this.pull(entity, orgId, shopId)
    }

    this.lastSyncedAt = new Date()
    this.emitEvent('sync_complete', undefined, 'Delta sync all complete')

    return results
  }

  // ------------------------------------------
  // Bootstrap — Full hydration
  // ------------------------------------------

  async bootstrap(
    orgId: string,
    shopId?: string
  ): Promise<Record<string, { pulled: number }>> {
    if (typeof window === 'undefined') {
      return {}
    }

    // Check connectivity
    const connService = await getConnectivityService()
    if (connService && !connService.isOnline) {
      console.log('[Sync] Offline, skipping bootstrap')
      return {}
    }

    this.emitEvent('sync_start', undefined, 'Full bootstrap')

    const results: Record<string, { pulled: number }> = {}
    const total = ALL_ENTITIES.length

    for (let i = 0; i < ALL_ENTITIES.length; i++) {
      const entity = ALL_ENTITIES[i]
      const endpoint = ENTITY_ENDPOINTS[entity]
      const tableName = ENTITY_TABLES[entity]

      if (!endpoint || !tableName) continue

      this.emitEvent('sync_progress', entity, `Bootstrapping ${i + 1}/${total}`, {
        completed: i,
        total,
      })

      try {
        // Fetch ALL data — no updatedSince filter
        const params = new URLSearchParams({ orgId })
        if (shopId) {
          params.set('shopId', shopId)
        }

        const url = `${endpoint}?${params.toString()}`
        const response = await authFetch(url)

        if (!response.ok) {
          console.error(`[Sync] Bootstrap failed for ${entity}: ${response.status}`)
          results[entity] = { pulled: 0 }
          continue
        }

        const data = await response.json()
        const items: Record<string, unknown>[] = Array.isArray(data)
          ? data
          : Array.isArray(data.data)
            ? data.data
            : Array.isArray(data.items)
              ? data.items
              : []

        // Filter out deleted items for bootstrap
        const activeItems = items.filter(
          (item) => item._deleted !== true && item.isActive !== false
        )

        // Write everything to Dexie tables using bulkPut
        if (activeItems.length > 0) {
          try {
            await db.table(tableName).bulkPut(activeItems)
          } catch (err) {
            console.error(`[Sync] bulkPut failed for ${tableName}:`, err)
            // Fallback: individual puts
            for (const item of activeItems) {
              try {
                await db.table(tableName).put(item)
              } catch {
                // Skip individual failures
              }
            }
          }
        }

        // Set syncMeta with current timestamp
        const now = new Date().toISOString()
        await db.syncMeta.put({
          id: entity,
          lastSyncedAt: now,
          entityCount: 0,
        })

        results[entity] = { pulled: activeItems.length }
        console.log(`[Sync] Bootstrapped ${entity}: ${activeItems.length} items`)
      } catch (err) {
        console.error(`[Sync] Bootstrap error for ${entity}:`, err)
        results[entity] = { pulled: 0 }
      }
    }

    this.lastSyncedAt = new Date()
    this.emitEvent('sync_complete', undefined, 'Bootstrap complete')

    return results
  }

  // ------------------------------------------
  // Auto Sync
  // ------------------------------------------

  /**
   * Starts automatic background synchronization.
   *
   * Two timers run in parallel:
   *  - Push timer (intervalMs, default 5 min): drains the local outbox so
   *    offline mutations reach the server.
   *  - Pull timer (2× intervalMs, default 10 min): delta-syncs all entities
   *    so remote changes made by OTHER devices/users propagate to this
   *    device's IndexedDB automatically. No manual sync button required.
   *
   * The pull timer requires org/shop context so it can call pullAll(). If no
   * context is provided, only push runs (backward-compatible behavior).
   *
   * On "back online" events, BOTH a push (drain outbox) and a pull (fetch
   * remote changes) are triggered so the device is fully up-to-date.
   */
  async startAutoSync(
    intervalMs: number = 5 * 60 * 1000,
    context?: { orgId: string; shopId?: string }
  ): Promise<() => void> {
    if (typeof window === 'undefined') {
      return () => {}
    }

    // Store context for auto-pull (and back-online events)
    if (context) {
      this.syncContext = context
    }

    console.log(
      `[Sync] Starting auto sync with interval ${intervalMs}ms` +
      (context ? ` (push + pull, orgId=${context.orgId})` : ' (push only — no org context)')
    )

    // Clear any existing timers
    this.stopAutoSync()

    // --- Push timer: drain outbox ---
    this.autoSyncTimer = setInterval(async () => {
      const connService = await getConnectivityService()
      const isOnline = connService ? connService.isOnline : navigator.onLine

      if (isOnline) {
        console.log('[Sync] Auto push triggered')
        await this.push()
      } else {
        console.log('[Sync] Offline, skipping auto push')
      }
    }, intervalMs)

    // --- Pull timer: fetch remote changes (only if we have org context) ---
    if (this.syncContext) {
      const pullInterval = intervalMs * 2 // pull half as often as push
      this.pullTimer = setInterval(async () => {
        const connService = await getConnectivityService()
        const isOnline = connService ? connService.isOnline : navigator.onLine

        if (isOnline && this.syncContext) {
          console.log('[Sync] Auto pull triggered — fetching remote changes')
          try {
            await this.pullAll(this.syncContext.orgId, this.syncContext.shopId)
          } catch (err) {
            console.error('[Sync] Auto pull failed:', err)
          }
        } else {
          console.log('[Sync] Offline, skipping auto pull')
        }
      }, pullInterval)
    }

    // Listen for connectivity changes — sync when coming back online
    const connService = await getConnectivityService()
    if (connService) {
      this.connectivityCleanup = connService.subscribe(async (online) => {
        if (online) {
          console.log('[Sync] Back online, triggering push + pull')
          // Small delay to let connection stabilize
          setTimeout(async () => {
            await this.push()
            // Also pull remote changes so this device is current
            if (this.syncContext) {
              try {
                await this.pullAll(this.syncContext.orgId, this.syncContext.shopId)
              } catch (err) {
                console.error('[Sync] Back-online pull failed:', err)
              }
            }
          }, 1000)
        }
      })
    } else {
      // Fallback: listen for browser online events
      const handleOnline = () => {
        console.log('[Sync] Browser online event, triggering push + pull')
        setTimeout(async () => {
          await this.push()
          if (this.syncContext) {
            try {
              await this.pullAll(this.syncContext.orgId, this.syncContext.shopId)
            } catch (err) {
              console.error('[Sync] Browser-online pull failed:', err)
            }
          }
        }, 1000)
      }
      window.addEventListener('online', handleOnline)
      this.connectivityCleanup = () => {
        window.removeEventListener('online', handleOnline)
      }
    }

    // Return cleanup function
    return () => {
      this.stopAutoSync()
    }
  }

  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer)
      this.autoSyncTimer = null
    }
    if (this.pullTimer) {
      clearInterval(this.pullTimer)
      this.pullTimer = null
    }
    if (this.connectivityCleanup) {
      this.connectivityCleanup()
      this.connectivityCleanup = null
    }
    // Note: we intentionally do NOT clear syncContext here so a restart
    // of auto-sync (e.g. after a transient stop) still knows the org.
  }

  // ------------------------------------------
  // Manual Sync
  // ------------------------------------------

  async manualSync(
    orgId: string,
    shopId?: string
  ): Promise<{ pushResult: { synced: number; failed: number; conflicts: number }; pullResult: Record<string, { pulled: number; deleted: number }> }> {
    if (typeof window === 'undefined') {
      return {
        pushResult: { synced: 0, failed: 0, conflicts: 0 },
        pullResult: {},
      }
    }

    console.log('[Sync] Manual sync triggered')

    // Push first, then pull
    const pushResult = await this.push()
    const pullResult = await this.pullAll(orgId, shopId)

    return { pushResult, pullResult }
  }

  // ------------------------------------------
  // Outbox Item Management
  // ------------------------------------------

  /**
   * Add an item to the outbox for syncing.
   * Handles the edge case of offline create then offline delete.
   */
  async addToOutbox(item: Omit<OutboxItem, 'id' | 'createdAt' | 'retryCount' | 'status'>): Promise<OutboxItem> {
    const dexieDb = getDexieDb()
    if (!dexieDb) {
      throw new Error('[Sync] Database not available')
    }

    // Edge case: Offline create then offline delete
    if (item.operation === 'delete' && item.localId) {
      await this.handleCreateDeleteCancellation(item.entity, item.localId, dexieDb)
    }

    const outboxItem: OutboxItem = {
      ...item,
      id: generateId(),
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
    }

    await dexieDb.outbox.add(outboxItem)
    console.log(`[Sync] Added to outbox: ${item.operation} ${item.entity}`)
    this.notifyListeners()

    return outboxItem
  }

  /**
   * Handle the edge case where an item was created offline and then deleted offline.
   * If we find a pending 'create' for the same entity+localId, we cancel both.
   */
  private async handleCreateDeleteCancellation(
    entity: string,
    localId: string,
    dexieDb: NonNullable<ReturnType<typeof getDexieDb>>
  ): Promise<void> {
    try {
      // Find a pending 'create' for the same entity and localId
      const createItems: OutboxItem[] = await dexieDb.outbox
        .where('entity')
        .equals(entity)
        .toArray()

      const matchingCreate = createItems.find(
        (item) =>
          item.operation === 'create' &&
          item.localId === localId &&
          (item.status === 'pending' || item.status === 'syncing')
      )

      if (matchingCreate) {
        // Remove both the create and skip adding the delete
        await dexieDb.outbox.delete(matchingCreate.id)
        console.log(
          `[Sync] Cancelled create+delete for ${entity} localId=${localId}`
        )
      }
    } catch (err) {
      console.error('[Sync] Error checking create-delete cancellation:', err)
    }
  }

  /**
   * Discard a failed or conflicted outbox item.
   */
  async cancelOutboxItem(id: string): Promise<void> {
    const dexieDb = getDexieDb()
    if (!dexieDb) return

    try {
      const item = await dexieDb.outbox.get(id)
      if (item && (item.status === 'failed' || item.status === 'conflict')) {
        await dexieDb.outbox.delete(id)
        console.log(`[Sync] Cancelled outbox item ${id}`)
        this.notifyListeners()
      } else if (item) {
        console.warn(`[Sync] Cannot cancel item ${id} with status ${item.status}`)
      }
    } catch (err) {
      console.error('[Sync] Error cancelling outbox item:', err)
    }
  }

  /**
   * Reset a failed item to pending and retry it immediately.
   */
  async retryOutboxItem(id: string): Promise<void> {
    const dexieDb = getDexieDb()
    if (!dexieDb) return

    try {
      const item = await dexieDb.outbox.get(id)
      if (item && (item.status === 'failed' || item.status === 'conflict')) {
        item.status = 'pending'
        item.retryCount = 0
        item.error = undefined
        item.lastAttemptAt = null
        await dexieDb.outbox.put(item)
        console.log(`[Sync] Reset outbox item ${id} for retry`)
        this.notifyListeners()

        // Trigger a push to process this item
        await this.push()
      } else if (item) {
        console.warn(`[Sync] Cannot retry item ${id} with status ${item.status}`)
      }
    } catch (err) {
      console.error('[Sync] Error retrying outbox item:', err)
    }
  }

  /**
   * Get all outbox items with a given status.
   */
  async getOutboxItems(status?: OutboxItem['status']): Promise<OutboxItem[]> {
    const dexieDb = getDexieDb()
    if (!dexieDb) return []

    try {
      if (status) {
        return dexieDb.outbox.where('status').equals(status).toArray()
      }
      return dexieDb.outbox.toArray()
    } catch (err) {
      console.error('[Sync] Error reading outbox items:', err)
      return []
    }
  }

  /**
   * Clear all synced items from the outbox.
   */
  async clearSyncedItems(): Promise<number> {
    const dexieDb = getDexieDb()
    if (!dexieDb) return 0

    try {
      const syncedItems = await dexieDb.outbox
        .where('status')
        .equals('synced')
        .toArray()

      const ids = syncedItems.map((item) => item.id)
      await dexieDb.outbox.bulkDelete(ids)

      console.log(`[Sync] Cleared ${ids.length} synced items`)
      this.notifyListeners()
      return ids.length
    } catch (err) {
      console.error('[Sync] Error clearing synced items:', err)
      return 0
    }
  }
}

// ============================================
// Singleton
// ============================================

let _syncEngine: SyncEngine | null = null

export function getSyncEngine(): SyncEngine {
  if (typeof window === 'undefined') {
    // Return a no-op engine on the server
    return new SyncEngine()
  }

  if (!_syncEngine) {
    _syncEngine = new SyncEngine()
  }

  return _syncEngine
}

// Lazy singleton — the engine is only instantiated when first accessed in the browser
export const syncEngine: SyncEngine = typeof window !== 'undefined'
  ? getSyncEngine()
  : new SyncEngine()

export { SyncEngine }

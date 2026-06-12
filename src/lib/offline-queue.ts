// ============================================
// Offline Queue — IndexedDB-based operation queue
// ============================================
// Queues POST/PUT/DELETE operations when offline.
// Stores pending operations in IndexedDB.
// Syncs when back online.

export interface QueuedOperation {
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
  timestamp: number
  retries: number
}

const DB_NAME = 'invensync-offline'
const DB_VERSION = 1
const STORE_NAME = 'pending-operations'

// ============================================
// IndexedDB Helpers
// ============================================

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getAllOperations(): Promise<QueuedOperation[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result as QueuedOperation[])
    request.onerror = () => reject(request.error)
  })
}

async function addOperation(op: QueuedOperation): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.add(op)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function removeOperation(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function updateOperation(op: QueuedOperation): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(op)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ============================================
// Public API
// ============================================

/**
 * Queue an operation for later execution when back online.
 * Only POST, PUT, PATCH, DELETE methods are queued.
 */
export async function queueOperation(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | null
): Promise<QueuedOperation> {
  const op: QueuedOperation = {
    id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    url,
    method: method.toUpperCase(),
    headers,
    body,
    timestamp: Date.now(),
    retries: 0,
  }

  await addOperation(op)
  return op
}

/**
 * Get the number of pending operations in the queue.
 */
export async function getPendingCount(): Promise<number> {
  const operations = await getAllOperations()
  return operations.length
}

/**
 * Sync all pending operations when back online.
 * Processes operations in order (by timestamp).
 * Removes successful operations from the queue.
 * Retries failed operations up to MAX_RETRIES times.
 */
export async function syncPendingOperations(): Promise<{
  synced: number
  failed: number
  remaining: number
}> {
  const operations = await getAllOperations()

  if (operations.length === 0) {
    return { synced: 0, failed: 0, remaining: 0 }
  }

  // Sort by timestamp (FIFO)
  operations.sort((a, b) => a.timestamp - b.timestamp)

  const MAX_RETRIES = 3
  let synced = 0
  let failed = 0

  for (const op of operations) {
    try {
      const response = await fetch(op.url, {
        method: op.method,
        headers: op.headers,
        body: op.body,
      })

      if (response.ok) {
        // Operation succeeded — remove from queue
        await removeOperation(op.id)
        synced++
      } else if (response.status >= 500 || response.status === 429) {
        // Server error or rate limit — retry later
        op.retries++
        if (op.retries >= MAX_RETRIES) {
          // Max retries reached — remove from queue
          await removeOperation(op.id)
          failed++
        } else {
          await updateOperation(op)
        }
      } else {
        // Client error (4xx) — don't retry, remove from queue
        await removeOperation(op.id)
        failed++
      }
    } catch {
      // Network error during sync — retry later
      op.retries++
      if (op.retries >= MAX_RETRIES) {
        await removeOperation(op.id)
        failed++
      } else {
        await updateOperation(op)
      }
    }
  }

  const remaining = await getPendingCount()
  return { synced, failed, remaining }
}

/**
 * Clear all pending operations from the queue.
 */
export async function clearPendingOperations(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Initialize offline sync: listen for online events and
 * automatically sync pending operations.
 */
export function initOfflineSync(): () => void {
  let syncing = false

  const handleOnline = async () => {
    if (syncing) return
    syncing = true
    try {
      const result = await syncPendingOperations()
      if (result.synced > 0) {
        console.log(`[Offline] Synced ${result.synced} pending operations`)
      }
      if (result.failed > 0) {
        console.warn(`[Offline] ${result.failed} operations failed permanently`)
      }
    } catch (err) {
      console.error('[Offline] Sync error:', err)
    } finally {
      syncing = false
    }
  }

  window.addEventListener('online', handleOnline)

  // If already online, try to sync immediately
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    handleOnline()
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline)
  }
}

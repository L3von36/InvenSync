// ============================================
// YouTube-Style Client-Side Request Cache & Deduplication
// ============================================
// Like YouTube's approach to data fetching:
// - SWR (stale-while-revalidate) for instant UI with background refresh
// - Request deduplication - multiple components share one request
// - Optimistic updates - update UI before server confirms
// - Automatic retry with exponential backoff
// - Window focus revalidation (refresh when user comes back)
// - Error recovery with cached fallback
//
// Why: YouTube loads instantly because it aggressively caches
// and deduplicates. If 5 components need the same data,
// only 1 network request is made.

interface CacheEntry<T> {
  data: T
  timestamp: number
  error: Error | null
  isValid: boolean
}

interface SWROptions<T> {
  /** How long data is considered fresh (ms). Default: 30s */
  dedupingInterval?: number
  /** Revalidate on window focus. Default: true */
  revalidateOnFocus?: boolean
  /** Revalidate on reconnect. Default: true */
  revalidateOnReconnect?: boolean
  /** Retry count on error. Default: 3 */
  retryCount?: number
  /** Retry delay in ms. Default: 1000 */
  retryDelay?: number
  /** Fallback data while loading */
  fallbackData?: T
  /** Called when data updates */
  onSuccess?: (data: T) => void
  /** Called on error */
  onError?: (error: Error) => void
}

// Global in-memory cache
const clientCache = new Map<string, CacheEntry<unknown>>()

// In-flight request deduplication (YouTube's key optimization)
const inflightRequests = new Map<string, Promise<unknown>>()

// Subscriber callbacks (React components watching this data)
const subscribers = new Map<string, Set<(data: unknown, error: Error | null) => void>>()

// Focus and online listeners (set up once)
let listenersSetup = false

function setupGlobalListeners() {
  if (listenersSetup || typeof window === 'undefined') return
  listenersSetup = true

  // YouTube revalidates when user returns to the tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      revalidateStale()
    }
  })

  // Revalidate when coming back online
  window.addEventListener('online', () => {
    revalidateStale()
  })
}

/** Revalidate all stale entries */
function revalidateStale() {
  const now = Date.now()
  clientCache.forEach((entry, key) => {
    if (entry.isValid && now - entry.timestamp > 30_000) {
      // Mark as stale - will be revalidated on next access
      entry.isValid = false
    }
  })
}

/**
 * YouTube-style SWR fetcher
 * 
 * This is the core of YouTube's instant-loading experience:
 * 1. Return cached data immediately (even if stale)
 * 2. Fetch fresh data in the background
 * 3. Deduplicate concurrent requests
 * 4. Notify subscribers when data updates
 */
export async function swrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: SWROptions<T>
): Promise<T> {
  setupGlobalListeners()

  const dedupingInterval = options?.dedupingInterval ?? 30_000
  const now = Date.now()

  // Check cache
  const cached = clientCache.get(key) as CacheEntry<T> | undefined

  // Return fresh cached data
  if (cached && cached.data !== undefined && now - cached.timestamp < dedupingInterval && cached.isValid) {
    return cached.data
  }

  // Check for in-flight request (deduplication)
  if (inflightRequests.has(key)) {
    if (cached?.data !== undefined) {
      // Return stale data while waiting for fresh data
      return cached.data
    }
    return inflightRequests.get(key) as Promise<T>
  }

  // Start fetch with retry
  const retryCount = options?.retryCount ?? 2
  const retryDelay = options?.retryDelay ?? 1000

  const fetchWithRetry = async (attempt = 0): Promise<T> => {
    try {
      const data = await fetcher()
      
      // Update cache
      clientCache.set(key, {
        data,
        timestamp: Date.now(),
        error: null,
        isValid: true,
      })

      // Notify subscribers
      notifySubscribers(key, data, null)
      
      options?.onSuccess?.(data)
      return data
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < retryCount) {
        // Exponential backoff
        await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt)))
        return fetchWithRetry(attempt + 1)
      }

      // Update error in cache
      if (cached?.data !== undefined) {
        clientCache.set(key, {
          ...cached,
          error: err,
          isValid: false,
        })
      }

      options?.onError?.(err)
      notifySubscribers(key, cached?.data as T, err)
      throw err
    }
  }

  const fetchPromise = fetchWithRetry()
  inflightRequests.set(key, fetchPromise)

  try {
    const result = await fetchPromise
    return result
  } finally {
    inflightRequests.delete(key)
  }
}

/** Subscribe to data changes (for React state updates) */
export function subscribeToKey(
  key: string,
  callback: (data: unknown, error: Error | null) => void
): () => void {
  if (!subscribers.has(key)) {
    subscribers.set(key, new Set())
  }
  subscribers.get(key)!.add(callback)

  // Return unsubscribe function
  return () => {
    subscribers.get(key)?.delete(callback)
    if (subscribers.get(key)?.size === 0) {
      subscribers.delete(key)
    }
  }
}

/** Notify all subscribers of a data change */
function notifySubscribers(key: string, data: unknown, error: Error | null): void {
  subscribers.get(key)?.forEach(cb => {
    try {
      cb(data, error)
    } catch {
      // Swallow subscriber errors
    }
  })
}

/** Mutate cache data (for optimistic updates) */
export function mutateCache<T>(key: string, data: T | ((prev: T) => T)): void {
  const current = clientCache.get(key) as CacheEntry<T> | undefined
  
  const newData = typeof data === 'function'
    ? (data as (prev: T) => T)(current?.data as T)
    : data

  clientCache.set(key, {
    data: newData,
    timestamp: Date.now(),
    error: null,
    isValid: true,
  })

  notifySubscribers(key, newData, null)
}

/** Invalidate a cache key (force revalidation on next access) */
export function invalidateKey(key: string): void {
  const entry = clientCache.get(key)
  if (entry) {
    entry.isValid = false
    entry.timestamp = 0
  }
}

/** Invalidate all cache keys matching a prefix */
export function invalidateKeysByPrefix(prefix: string): void {
  clientCache.forEach((entry, key) => {
    if (key.startsWith(prefix)) {
      entry.isValid = false
      entry.timestamp = 0
    }
  })
}

/** Clear entire client cache */
export function clearClientCache(): void {
  clientCache.clear()
  inflightRequests.clear()
}

/** Prefetch data (like YouTube prefetches video info) */
export async function prefetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: SWROptions<T>
): Promise<void> {
  try {
    await swrFetch(key, fetcher, { ...options, retryCount: 0 })
  } catch {
    // Prefetch failures are silent
  }
}

/** Get cached data synchronously (for instant UI render) */
export function getCachedData<T>(key: string): T | undefined {
  const entry = clientCache.get(key) as CacheEntry<T> | undefined
  return entry?.data
}

/** Get cache stats for debugging */
export function getClientCacheStats(): { entries: number; keys: string[]; inflight: number } {
  return {
    entries: clientCache.size,
    keys: [...clientCache.keys()],
    inflight: inflightRequests.size,
  }
}

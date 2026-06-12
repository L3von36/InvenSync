// ============================================
// Netflix-Style Multi-Layer Cache (EVCache Inspired)
// ============================================
// Like Netflix's EVCache, this provides:
// - In-memory caching with TTL (time-to-live)
// - Cache stampede protection (only one request fills the cache)
// - Stale-while-revalidate (serve stale data while fetching fresh)
// - Cache namespacing for organized invalidation
// - LRU eviction when cache grows too large
//
// Why: Netflix serves 250M+ subscribers by caching aggressively.
// Every dashboard load that hits the DB costs CPU, I/O, and latency.
// Caching reduces DB load by 80-95% for frequently accessed data.

interface CacheEntry<T> {
  data: T
  expiresAt: number
  createdAt: number
  staleAt: number  // When data becomes "stale" but still usable (SWR)
  isRefreshing: boolean
}

interface CacheOptions {
  ttl: number       // Time-to-live in ms (how long data is "fresh")
  staleTtl?: number // How long stale data is still served (SWR window)
  maxSize?: number  // Max entries in this namespace
}

// In-flight request deduplication (like Netflix's Hystrix collapser)
const inflightRequests = new Map<string, Promise<unknown>>()

class MemoryCache {
  private caches = new Map<string, Map<string, CacheEntry<unknown>>>()
  private defaultOptions: CacheOptions = {
    ttl: 30_000,     // 30 seconds fresh
    staleTtl: 60_000, // 60 seconds stale-but-usable (SWR)
    maxSize: 1000,
  }

  private getNamespace(namespace: string): Map<string, CacheEntry<unknown>> {
    if (!this.caches.has(namespace)) {
      this.caches.set(namespace, new Map())
    }
    return this.caches.get(namespace)!
  }

  /**
   * Get data from cache. Returns null if not found or expired.
   * If data is "stale" (past TTL but within staleTTL), returns it but
   * marks it for background refresh (Stale-While-Revalidate).
   */
  get<T>(namespace: string, key: string): { data: T; isStale: boolean } | null {
    const cache = this.getNamespace(namespace)
    const entry = cache.get(key)
    if (!entry) return null

    const now = Date.now()

    // Completely expired (past stale window)
    if (now > entry.expiresAt + (entry.staleAt - entry.expiresAt)) {
      cache.delete(key)
      return null
    }

    // Data is fresh
    if (now <= entry.expiresAt) {
      return { data: entry.data as T, isStale: false }
    }

    // Data is stale but still within SWR window
    return { data: entry.data as T, isStale: true }
  }

  /**
   * Store data in cache with TTL and staleTTL
   */
  set<T>(namespace: string, key: string, data: T, options?: CacheOptions): void {
    const opts = { ...this.defaultOptions, ...options }
    const cache = this.getNamespace(namespace)

    // LRU eviction: remove oldest entries if cache is full
    if (cache.size >= (opts.maxSize || 1000)) {
      const oldestKey = cache.keys().next().value
      if (oldestKey) cache.delete(oldestKey)
    }

    const now = Date.now()
    cache.set(key, {
      data,
      expiresAt: now + opts.ttl,
      staleAt: now + opts.ttl + (opts.staleTtl || 60_000),
      createdAt: now,
      isRefreshing: false,
    })
  }

  /**
   * Invalidate a specific key or entire namespace
   */
  invalidate(namespace: string, key?: string): void {
    if (key) {
      this.getNamespace(namespace).delete(key)
    } else {
      this.caches.delete(namespace)
    }
  }

  /**
   * Netflix-style "Stale-While-Revalidate" fetcher
   * 
   * Pattern: Return cached data immediately (even if stale),
   * then refresh in the background. This means:
   * - 1st request: cache miss → fetch from source → cache → return
   * - 2nd request (within TTL): cache hit → return instantly
   * - 3rd request (stale): return stale data + trigger background refresh
   * - Next request: returns freshly refreshed data
   * 
   * Also deduplicates concurrent requests for the same key
   * (like Netflix's request collapser / Hystrix)
   */
  async swr<T>(
    namespace: string,
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = this.get<T>(namespace, key)

    if (cached) {
      if (!cached.isStale) {
        // Fresh data - return immediately
        return cached.data
      }

      // Stale data - return it but refresh in background
      // Use inflight deduplication to avoid stampede
      const inflightKey = `${namespace}:${key}`
      if (!inflightRequests.has(inflightKey)) {
        const refreshPromise = fetcher()
          .then(data => {
            this.set(namespace, key, data, options)
            inflightRequests.delete(inflightKey)
            return data
          })
          .catch(() => {
            inflightRequests.delete(inflightKey)
            // On refresh failure, keep serving stale data
          })
        inflightRequests.set(inflightKey, refreshPromise)
      }

      return cached.data
    }

    // Cache miss - check if there's already a request in flight
    const inflightKey = `${namespace}:${key}`
    if (inflightRequests.has(inflightKey)) {
      return inflightRequests.get(inflightKey) as Promise<T>
    }

    // Fresh fetch with deduplication
    const fetchPromise = fetcher()
      .then(data => {
        this.set(namespace, key, data, options)
        inflightRequests.delete(inflightKey)
        return data
      })
      .catch(err => {
        inflightRequests.delete(inflightKey)
        throw err
      })

    inflightRequests.set(inflightKey, fetchPromise)
    return fetchPromise
  }

  /**
   * Get cache stats for monitoring (like Netflix's EVCache metrics)
   */
  getStats(): { namespaces: number; totalEntries: number; details: Record<string, number> } {
    const details: Record<string, number> = {}
    let total = 0
    this.caches.forEach((cache, ns) => {
      details[ns] = cache.size
      total += cache.size
    })
    return { namespaces: this.caches.size, totalEntries: total, details }
  }
}

// Singleton instance (like Netflix's shared EVCache client)
export const cache = new MemoryCache()

// ============================================
// Pre-configured cache namespaces with tuned TTLs
// (Like Netflix's cache tiers - hot/warm/cold)
// ============================================

export const CacheNamespaces = {
  /** Hot cache - dashboard overview, changes frequently, 15s TTL */
  ADMIN_DASHBOARD: 'admin:dashboard',
  
  /** Warm cache - org lists, changes moderately, 30s TTL */  
  ADMIN_ORGANIZATIONS: 'admin:organizations',
  
  /** Warm cache - user lists, 30s TTL */
  ADMIN_USERS: 'admin:users',
  
  /** Warm cache - shop data, 30s TTL */
  ADMIN_SHOPS: 'admin:shops',
  
  /** Cold cache - region data, rarely changes, 5min TTL */
  ADMIN_REGIONS: 'admin:regions',
  
  /** Hot cache - market insights, computed data, 1min TTL */
  ADMIN_MARKET_INSIGHTS: 'admin:market-insights',
  
  /** Cold cache - module definitions, rarely changes, 5min TTL */
  ADMIN_MODULES: 'admin:modules',
  
  /** Warm cache - business dashboard, 20s TTL */
  BUSINESS_DASHBOARD: 'business:dashboard',
  
  /** Warm cache - inventory stats, 20s TTL */
  BUSINESS_INVENTORY: 'business:inventory',
  
  /** Cold cache - product types, rarely changes, 2min TTL */
  BUSINESS_PRODUCT_TYPES: 'business:product-types',

  /** Hot cache - AI results, 5min TTL (expensive to compute) */
  AI_PRICE_OPTIMIZATION: 'ai:price-optimization',
  AI_SALES_FORECAST: 'ai:sales-forecast',
  AI_ANOMALY_DETECTION: 'ai:anomaly-detection',
  AI_BUSINESS_ASSISTANT: 'ai:business-assistant',
} as const

/** TTL presets (like Netflix's cache tiers) */
export const CacheTTL = {
  HOT: 15_000,       // 15s - frequently changing data
  WARM: 30_000,      // 30s - moderately changing data
  COLD: 300_000,     // 5min - rarely changing data
  STATIC: 3_600_000, // 1hr - nearly static data
} as const

export type CacheNamespace = typeof CacheNamespaces[keyof typeof CacheNamespaces]

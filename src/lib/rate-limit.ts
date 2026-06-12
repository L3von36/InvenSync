// ============================================
// Google-Style API Rate Limiter
// ============================================
// Like Google's API rate limiting:
// - Token bucket algorithm (same as Google Cloud API quotas)
// - Per-user and per-IP rate limits
// - Different tiers for different endpoint types
// - Sliding window with burst allowance
// - Returns proper 429 responses with Retry-After header
//
// Why: Google processes 8.5B searches/day and protects their
// infrastructure with aggressive rate limiting. Without it,
// a single misbehaving client can take down your entire API.

interface RateLimitBucket {
  tokens: number
  lastRefill: number
  maxTokens: number
  refillRate: number // tokens per millisecond
}

interface RateLimitConfig {
  maxRequests: number    // Maximum requests in the window
  windowMs: number       // Time window in milliseconds
  burstSize?: number     // Allow burst up to this many (defaults to maxRequests)
  keyPrefix?: string     // For namespacing different limiters
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterMs?: number
}

// In-memory token bucket store
// In production (like Google), this would be Redis/Memcached for distributed rate limiting
const buckets = new Map<string, RateLimitBucket>()

// Cleanup old buckets periodically (prevent memory leak)
const CLEANUP_INTERVAL = 60_000 // 1 minute
const BUCKET_MAX_AGE = 3600_000 // 1 hour

let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  
  for (const [key, bucket] of buckets) {
    // If bucket hasn't been used in a long time, remove it
    if (now - bucket.lastRefill > BUCKET_MAX_AGE) {
      buckets.delete(key)
    }
  }
  lastCleanup = now
}

/**
 * Token bucket rate limiter (Google Cloud API style)
 * 
 * How it works:
 * - Each user/IP has a "bucket" of tokens
 * - Each request consumes one token
 * - Tokens refill at a steady rate (e.g., 10 tokens/second)
 * - If the bucket is empty, the request is rejected with 429
 * - Burst: Bucket can hold up to maxTokens, allowing short bursts
 * 
 * This is the same algorithm used by Google Cloud APIs,
 * AWS API Gateway, and Stripe.
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanup()

  const key = `${config.keyPrefix || 'default'}:${identifier}`
  const now = Date.now()
  const maxTokens = config.burstSize || config.maxRequests
  const refillRate = config.maxRequests / config.windowMs // tokens per ms

  let bucket = buckets.get(key)

  if (!bucket) {
    // New bucket - starts full (allows immediate burst, like Google)
    bucket = {
      tokens: maxTokens,
      lastRefill: now,
      maxTokens,
      refillRate,
    }
    buckets.set(key, bucket)
  }

  // Refill tokens based on elapsed time (sliding window)
  const elapsed = now - bucket.lastRefill
  const tokensToAdd = elapsed * bucket.refillRate
  bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd)
  bucket.lastRefill = now

  // Try to consume a token
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    const windowEnd = now + Math.ceil((1 - bucket.tokens) / bucket.refillRate)
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      resetAt: windowEnd,
    }
  }

  // No tokens available - rate limited
  const waitTimeMs = Math.ceil((1 - bucket.tokens) / bucket.refillRate)
  return {
    allowed: false,
    remaining: 0,
    resetAt: now + waitTimeMs,
    retryAfterMs: waitTimeMs,
  }
}

// ============================================
// Pre-configured rate limit tiers
// (Like Google's API quota tiers: Free/Basic/Premium)
// ============================================

export const RateLimitTiers = {
  /** Admin endpoints - strict limits (10 req/min per user) */
  ADMIN: {
    maxRequests: 10,
    windowMs: 60_000,
    keyPrefix: 'admin',
  },
  
  /** Dashboard data - moderate limits (30 req/min per user) */
  DASHBOARD: {
    maxRequests: 30,
    windowMs: 60_000,
    keyPrefix: 'dashboard',
  },
  
  /** List/search endpoints - generous limits (60 req/min per user) */
  LIST: {
    maxRequests: 60,
    windowMs: 60_000,
    keyPrefix: 'list',
  },
  
  /** Mutation endpoints - strict limits (20 req/min per user) */
  MUTATION: {
    maxRequests: 20,
    windowMs: 60_000,
    keyPrefix: 'mutation',
  },
  
  /** Auth endpoints - very strict (5 req/min per IP) */
  AUTH: {
    maxRequests: 5,
    windowMs: 60_000,
    keyPrefix: 'auth',
  },
  
  /** AI endpoints - expensive, very strict (10 req/min per user) */
  AI: {
    maxRequests: 10,
    windowMs: 60_000,
    keyPrefix: 'ai',
  },
} as const

/**
 * Apply rate limit to a Next.js API route handler
 * 
 * Usage:
 * ```ts
 * export async function GET(request: Request) {
 *   const rateLimitResult = applyRateLimit(request, RateLimitTiers.ADMIN)
 *   if (!rateLimitResult.allowed) {
 *     return rateLimitResult.response!
 *   }
 *   // ... your handler logic
 * }
 * ```
 */
export function applyRateLimit(
  request: Request,
  tier: typeof RateLimitTiers[keyof typeof RateLimitTiers],
  userId?: string
): { allowed: boolean; response?: Response; remaining: number } {
  // Get identifier: prefer user ID, fall back to IP
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  const identifier = userId || ip

  const result = checkRateLimit(identifier, tier)

  if (!result.allowed) {
    return {
      allowed: false,
      remaining: 0,
      response: new Response(
        JSON.stringify({
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((result.retryAfterMs || 1000) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((result.retryAfterMs || 1000) / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
          },
        }
      ),
    }
  }

  return {
    allowed: true,
    remaining: result.remaining,
  }
}

/**
 * Create rate limit headers for successful responses
 * (Like Google's X-RateLimit headers)
 */
export function getRateLimitHeaders(remaining: number, resetAt: number): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  }
}

// ============================================
// Rate limit stats (for admin monitoring)
// ============================================

export function getRateLimitStats(): { activeBuckets: number; details: Record<string, number> } {
  const details: Record<string, number> = {}
  for (const [key, bucket] of buckets) {
    const prefix = key.split(':')[0]
    details[prefix] = (details[prefix] || 0) + 1
  }
  return { activeBuckets: buckets.size, details }
}

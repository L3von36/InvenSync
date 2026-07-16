// ============================================
// Distributed rate limiter (Upstash Redis REST)
// ============================================
// The in-memory limiter in rate-limit.ts resets on every serverless cold
// start, so on Vercel it can be bypassed by spraying concurrent requests.
// This limiter counts in Upstash Redis over its REST API, so the count is
// shared across all function instances and regions.
//
// - Edge Runtime compatible (plain fetch, no Node APIs) — safe in middleware.
// - Fixed window via INCR + EXPIRE NX in a single pipeline round-trip.
// - Fails open: if Redis is unreachable or not configured, the request is
//   allowed and the per-instance in-memory limiter remains the backstop.
//
// Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

interface EdgeRateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSec: number
}

export async function checkDistributedRateLimit(
  prefix: string,
  identifier: string,
  maxRequests: number,
  windowSec: number,
): Promise<EdgeRateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    return { allowed: true, remaining: maxRequests, retryAfterSec: 0 }
  }

  const window = Math.floor(Date.now() / (windowSec * 1000))
  const key = `rl:${prefix}:${identifier}:${window}`

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSec), 'NX'],
      ]),
      // Don't let a slow Redis add latency to every login
      signal: AbortSignal.timeout(2000),
    })

    if (!res.ok) {
      return { allowed: true, remaining: maxRequests, retryAfterSec: 0 }
    }

    const results = (await res.json()) as Array<{ result?: number; error?: string }>
    const count = results[0]?.result ?? 0

    if (count > maxRequests) {
      const secondsIntoWindow = Math.floor(Date.now() / 1000) % windowSec
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.max(1, windowSec - secondsIntoWindow),
      }
    }
    return { allowed: true, remaining: maxRequests - count, retryAfterSec: 0 }
  } catch {
    // Redis unreachable — fail open, in-memory limiter still applies in routes
    return { allowed: true, remaining: maxRequests, retryAfterSec: 0 }
  }
}

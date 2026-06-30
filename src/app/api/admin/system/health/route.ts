import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'
import { cache } from '@/lib/cache'
import { getRateLimitStats, applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'
import { getResilienceStats } from '@/lib/resilience'
import { db } from '@/lib/prisma'

// ============================================
// System Health & Performance Monitoring API
// (Like Netflix's Atlas metrics, Google's Cloud Monitoring)
// ============================================

export async function GET(request: Request) {
  // Rate limit admin endpoints
  const rateLimitResult = applyRateLimit(request, RateLimitTiers.ADMIN)
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Database health check
    let dbHealthy = true
    let dbLatencyMs = 0
    try {
      const start = Date.now()
      await db.$queryRaw`SELECT 1`
      dbLatencyMs = Date.now() - start
    } catch {
      dbHealthy = false
    }

    // Get system stats
    const cacheStats = cache.getStats()
    const rateLimitStats = getRateLimitStats()
    const resilienceStats = getResilienceStats()

    // Memory usage (Node.js process)
    const memUsage = process.memoryUsage()

    // Uptime
    const uptimeSeconds = process.uptime()

    return NextResponse.json({
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: Math.round(uptimeSeconds),
        formatted: formatUptime(uptimeSeconds),
      },
      database: {
        status: dbHealthy ? 'connected' : 'error',
        latencyMs: dbLatencyMs,
      },
      cache: {
        ...cacheStats,
        hitRate: 'N/A (in-memory)',
      },
      rateLimit: rateLimitStats,
      resilience: resilienceStats,
      memory: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
        externalMB: Math.round(memUsage.external / 1024 / 1024),
      },
      patterns: {
        applied: [
          'Netflix EVCache: Multi-layer in-memory cache with SWR',
          'Google API: Token bucket rate limiting',
          'Netflix Hystrix: Circuit breaker for DB operations',
          'YouTube: Batch queries to eliminate N+1',
          'Google: HTTP Cache-Control headers',
          'Netflix: Request deduplication (inflight collapsing)',
          'Netflix: Timeout pattern (fail fast)',
          'YouTube: Client-side SWR cache with background refresh',
        ],
        cacheNamespaces: Object.keys(cacheStats.details),
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('System health error:', error)
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to get system health',
    }, { status: 500 })
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

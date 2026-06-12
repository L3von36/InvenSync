// ============================================
// Netflix-Style Circuit Breaker & Resilience
// ============================================
// Like Netflix's Hystrix circuit breaker:
// - Detects when a service/operation is failing
// - Opens the circuit to prevent cascading failures
// - Allows "half-open" state to test if service recovered
// - Exponential backoff with jitter for retries
// - Fallback/degradation strategies
//
// Why: Netflix's microservices architecture relies on circuit
// breakers to prevent one failing service from taking down
// the entire system. Without this, a slow DB query can
// cascade into full system outage.

type CircuitState = 'closed' | 'open' | 'half-open'

interface CircuitBreakerConfig {
  failureThreshold: number  // Failures before opening circuit
  resetTimeoutMs: number    // How long to wait before trying half-open
  halfOpenMaxAttempts: number // Requests to try in half-open state
}

interface CircuitBreakerState {
  state: CircuitState
  failureCount: number
  lastFailureAt: number
  halfOpenAttempts: number
}

const circuits = new Map<string, CircuitBreakerState>()

/**
 * Circuit Breaker - prevents cascading failures
 * 
 * States:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Too many failures, requests are rejected immediately
 * - HALF-OPEN: Testing if the service recovered, allows limited requests
 */
export class CircuitBreaker {
  private key: string
  private config: CircuitBreakerConfig

  constructor(key: string, config?: Partial<CircuitBreakerConfig>) {
    this.key = key
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      resetTimeoutMs: config?.resetTimeoutMs ?? 30_000,
      halfOpenMaxAttempts: config?.halfOpenMaxAttempts ?? 3,
    }
  }

  private getState(): CircuitBreakerState {
    if (!circuits.has(this.key)) {
      circuits.set(this.key, {
        state: 'closed',
        failureCount: 0,
        lastFailureAt: 0,
        halfOpenAttempts: 0,
      })
    }
    return circuits.get(this.key)!
  }

  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    const state = this.getState()
    const now = Date.now()

    switch (state.state) {
      case 'closed':
        // Normal operation
        try {
          const result = await fn()
          state.failureCount = 0
          return result
        } catch (error) {
          state.failureCount++
          state.lastFailureAt = now
          if (state.failureCount >= this.config.failureThreshold) {
            state.state = 'open'
          }
          if (fallback) return fallback()
          throw error
        }

      case 'open':
        // Circuit is open - reject immediately
        if (now - state.lastFailureAt > this.config.resetTimeoutMs) {
          // Transition to half-open
          state.state = 'half-open'
          state.halfOpenAttempts = 0
        } else {
          // Still open - return fallback or error
          if (fallback) return fallback()
          throw new Error(`Circuit breaker is OPEN for ${this.key}. Service temporarily unavailable.`)
        }
        // Fall through to half-open state
      case 'half-open':
        // Allow limited requests to test recovery
        if (state.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
          if (fallback) return fallback()
          throw new Error(`Circuit breaker is HALF-OPEN for ${this.key}. Too many test requests.`)
        }
        state.halfOpenAttempts++
        try {
          const result = await fn()
          // Success! Close the circuit
          state.state = 'closed'
          state.failureCount = 0
          state.halfOpenAttempts = 0
          return result
        } catch (error) {
          // Still failing - go back to open
          state.state = 'open'
          state.lastFailureAt = now
          state.halfOpenAttempts = 0
          if (fallback) return fallback()
          throw error
        }
    }
  }

  reset(): void {
    circuits.delete(this.key)
  }

  getStatus(): { state: CircuitState; failureCount: number } {
    const state = this.getState()
    return { state: state.state, failureCount: state.failureCount }
  }
}

// ============================================
// Retry with Exponential Backoff + Jitter
// (Like Netflix's Ribbon retry and Google's API client libraries)
// ============================================

interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  jitterFactor: number // 0-1, adds randomness to prevent thundering herd
  retryableErrors?: string[] // Error messages that should trigger retry
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,    // Start at 1 second
  maxDelayMs: 10_000,   // Max 10 seconds between retries
  jitterFactor: 0.25,   // 25% randomness
}

/**
 * Retry with exponential backoff and jitter
 * 
 * Pattern used by Netflix (Ribbon), Google (API client libs), and AWS SDKs.
 * 
 * Backoff: delay = base * 2^attempt + jitter
 * Jitter prevents "thundering herd" where all clients retry at the same time
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const opts = { ...defaultRetryConfig, ...config }
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if this error is retryable
      if (opts.retryableErrors && !opts.retryableErrors.some(msg => lastError!.message.includes(msg))) {
        throw lastError
      }

      // Don't wait after the last attempt
      if (attempt < opts.maxRetries) {
        const baseDelay = opts.baseDelayMs * Math.pow(2, attempt)
        const jitter = baseDelay * opts.jitterFactor * Math.random()
        const delay = Math.min(baseDelay + jitter, opts.maxDelayMs)
        await sleep(delay)
      }
    }
  }

  throw lastError!
}

// ============================================
// Bulkhead Pattern (Like Netflix's semaphore isolation)
// ============================================

interface BulkheadConfig {
  maxConcurrent: number  // Max concurrent operations
  maxQueue: number       // Max queued operations
}

const bulkheadCounters = new Map<string, { active: number; queued: number }>()

/**
 * Bulkhead - limits concurrent execution to prevent resource exhaustion
 * Like Netflix's Hystrix bulkhead pattern using semaphore isolation.
 * 
 * Prevents one slow operation from consuming all resources.
 */
export async function withBulkhead<T>(
  key: string,
  fn: () => Promise<T>,
  config: BulkheadConfig = { maxConcurrent: 10, maxQueue: 20 }
): Promise<T> {
  if (!bulkheadCounters.has(key)) {
    bulkheadCounters.set(key, { active: 0, queued: 0 })
  }
  const counter = bulkheadCounters.get(key)!

  // If at capacity, reject immediately
  if (counter.active >= config.maxConcurrent && counter.queued >= config.maxQueue) {
    throw new Error(`Bulkhead capacity exceeded for ${key}. Too many concurrent requests.`)
  }

  // If at max concurrent, queue
  if (counter.active >= config.maxConcurrent) {
    counter.queued++
    // Wait until a slot opens
    while (counter.active >= config.maxConcurrent) {
      await sleep(100)
    }
    counter.queued--
  }

  counter.active++
  try {
    return await fn()
  } finally {
    counter.active--
  }
}

// ============================================
// Timeout Pattern (Like Netflix's Hystrix timeout)
// ============================================

/**
 * Execute with timeout - prevents hanging requests from consuming resources
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  message = 'Operation timed out'
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error(message))
        })
      }),
    ])
    return result
  } finally {
    clearTimeout(timeoutId)
  }
}

// ============================================
// Pre-configured circuit breakers for common operations
// ============================================

export const circuitBreakers = {
  /** Database operations circuit breaker */
  database: new CircuitBreaker('database', {
    failureThreshold: 10,
    resetTimeoutMs: 15_000,
  }),
  
  /** AI API circuit breaker (external service, more tolerant) */
  aiService: new CircuitBreaker('ai-service', {
    failureThreshold: 3,
    resetTimeoutMs: 60_000,
  }),

  /** External API circuit breaker */
  externalApi: new CircuitBreaker('external-api', {
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
  }),
}

// ============================================
// Utility
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================
// Resilience stats (for admin monitoring)
// ============================================

export function getResilienceStats() {
  const circuitStats: Record<string, { state: CircuitState; failureCount: number }> = {}
  circuits.forEach((state, key) => {
    circuitStats[key] = { state: state.state, failureCount: state.failureCount }
  })

  const bulkheadStats: Record<string, { active: number; queued: number }> = {}
  bulkheadCounters.forEach((counter, key) => {
    bulkheadStats[key] = { ...counter }
  })

  return { circuits: circuitStats, bulkheads: bulkheadStats }
}

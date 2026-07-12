import { useSyncExternalStore } from 'react'

// ============================================
// Connectivity Detection — Hook & Service
// ============================================
// Provides real-time network connectivity state
// using navigator.onLine + heartbeat verification.
// The hook uses useSyncExternalStore for hydration safety.
// The service is a singleton for non-React consumers.

// ============================================
// Types
// ============================================

export interface ConnectivityState {
  isOnline: boolean       // current navigator.onLine status
  isConnected: boolean    // verified connectivity (heartbeat check passed)
  lastHeartbeat: Date | null
  isChecking: boolean     // currently running heartbeat
}

const DEFAULT_STATE: ConnectivityState = {
  isOnline: true,
  isConnected: true,
  lastHeartbeat: null,
  isChecking: false,
}

const HEARTBEAT_DEBOUNCE_MS = 10_000

// Stable server snapshot — must be the same reference across calls
const SERVER_SNAPSHOT: ConnectivityState = { ...DEFAULT_STATE }

// ============================================
// ConnectivityService (non-React singleton)
// ============================================

class ConnectivityService {
  private listeners = new Set<(state: ConnectivityState) => void>()
  private state: ConnectivityState = { ...DEFAULT_STATE }
  private lastHeartbeatTime = 0
  private heartbeatInProgress = false
  private monitoringCleanup: (() => void) | null = null
  private started = false

  getState(): ConnectivityState {
    return this.state
  }

  /**
   * True when the browser reports online AND the last heartbeat check passed.
   * Exposed as a plain property for non-React consumers (e.g. the sync engine).
   */
  get isOnline(): boolean {
    return this.state.isOnline && this.state.isConnected
  }

  subscribe(listener: (state: ConnectivityState) => void): () => void {
    this.listeners.add(listener)

    // Auto-start monitoring on first subscriber
    if (!this.started && typeof window !== 'undefined') {
      this.startMonitoring()
    }

    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    const snapshot = { ...this.state }
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }

  private setState(partial: Partial<ConnectivityState>): void {
    this.state = { ...this.state, ...partial }
    this.notify()
  }

  /**
   * Run a heartbeat check (HEAD request to /api/ping).
   * Returns true if the heartbeat succeeded.
   */
  async checkNow(): Promise<boolean> {
    // Prevent concurrent heartbeats
    if (this.heartbeatInProgress) {
      return this.state.isConnected
    }

    this.heartbeatInProgress = true
    this.setState({ isChecking: true })

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch('/api/ping', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const success = response.ok
      const now = new Date()
      this.lastHeartbeatTime = Date.now()

      this.setState({
        isConnected: success,
        lastHeartbeat: now,
        isChecking: false,
      })

      return success
    } catch {
      const now = new Date()
      this.lastHeartbeatTime = Date.now()

      this.setState({
        isConnected: false,
        lastHeartbeat: now,
        isChecking: false,
      })

      return false
    } finally {
      this.heartbeatInProgress = false
    }
  }

  /**
   * Run a debounced heartbeat — skips if the last heartbeat
   * was within HEARTBEAT_DEBOUNCE_MS.
   */
  private async debouncedHeartbeat(): Promise<boolean> {
    const elapsed = Date.now() - this.lastHeartbeatTime
    if (elapsed < HEARTBEAT_DEBOUNCE_MS) {
      return this.state.isConnected
    }
    return this.checkNow()
  }

  /**
   * Handle navigator.onLine going offline.
   */
  private handleOffline = (): void => {
    this.setState({
      isOnline: false,
      isConnected: false,
    })
  }

  /**
   * Handle navigator.onLine coming back online.
   * Runs a heartbeat to verify actual connectivity
   * (some networks lie about onLine).
   */
  private handleOnline = (): void => {
    this.setState({ isOnline: true })
    // Verify with heartbeat — don't debounce on reconnect
    this.lastHeartbeatTime = 0
    this.checkNow()
  }

  /**
   * Start periodic connectivity monitoring.
   * Returns a cleanup function to stop monitoring.
   */
  startMonitoring(intervalMs: number = 30_000): () => void {
    // Prevent double-start
    if (this.started) {
      return this.monitoringCleanup ?? (() => {})
    }

    this.started = true

    // Subscribe to browser online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
    }

    // Periodic heartbeat interval
    const intervalId = typeof setInterval !== 'undefined'
      ? setInterval(() => {
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            this.debouncedHeartbeat()
          }
        }, intervalMs)
      : null

    // Initial check if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.setState({ isOnline: true })
      this.checkNow()
    } else if (typeof navigator !== 'undefined') {
      this.setState({ isOnline: false, isConnected: false })
    }

    const cleanup = () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', this.handleOnline)
        window.removeEventListener('offline', this.handleOffline)
      }
      if (intervalId !== null) {
        clearInterval(intervalId)
      }
      this.monitoringCleanup = null
      this.started = false
    }

    this.monitoringCleanup = cleanup
    return cleanup
  }
}

// Singleton instance
export const connectivityService = new ConnectivityService()

// ============================================
// useConnectivity Hook
// ============================================
// Uses useSyncExternalStore for hydration safety.
// No useState or useEffect — purely external store.

// Module-level snapshot that stays in sync with the service.
// This is safe because the service only mutates it via the
// subscription callback, which fires synchronously from notify().
let currentSnapshot: ConnectivityState = { ...DEFAULT_STATE }

connectivityService.subscribe((state) => {
  currentSnapshot = state
})

function subscribeToConnectivity(callback: () => void): () => void {
  return connectivityService.subscribe(callback)
}

function getConnectivitySnapshot(): ConnectivityState {
  return currentSnapshot
}

function getServerSnapshot(): ConnectivityState {
  return SERVER_SNAPSHOT
}

export function useConnectivity(): ConnectivityState {
  return useSyncExternalStore(
    subscribeToConnectivity,
    getConnectivitySnapshot,
    getServerSnapshot,
  )
}

'use client'

// ============================================
// Auth-aware fetch helper
// ============================================

/**
 * Returns the JWT token from localStorage (client-side only).
 * Centralizes token retrieval so all raw fetch calls use the same logic.
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sb_token')
}

/**
 * Returns fetch headers that include the Authorization Bearer token
 * when a valid JWT is present. Returns empty headers otherwise.
 * 
 * This prevents sending `Authorization: Bearer null` which would
 * cause 401 errors on every request.
 */
function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

export interface RealtimeNotification {
  id: string
  organizationId: string
  type: string
  title: string
  message: string
  metadata: Record<string, unknown>
  createdAt: string
}

type NotificationHandler = (notification: RealtimeNotification) => void

/**
 * RealtimeClient — Notification polling with optional WebSocket on dev
 *
 * Production (Vercel): Uses HTTP polling every 30s to check for new notifications.
 * Vercel's serverless architecture does NOT support persistent WebSocket connections,
 * so we gracefully degrade to polling which works reliably.
 *
 * Development (local): Tries WebSocket via socket.io on port 3003 first,
 * falls back to polling if unavailable.
 */
class RealtimeClient {
  private currentOrgId: string | null = null
  private handlers: Set<NotificationHandler> = new Set()
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private lastPollTimestamp: string | null = null
  private isPolling = false
  private socket: unknown | null = null // Socket.IO client, loaded dynamically
  private isDisabled = false
  private hasLoggedInitialError = false
  private useWebSocket = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 2

  connect(organizationId: string): void {
    if (this.isDisabled && !this.useWebSocket) return

    // If already connected to the same org, skip
    if (this.currentOrgId === organizationId && (this.isPolling || (this.socket as { connected?: boolean })?.connected)) {
      return
    }

    // If connected to a different org, switch
    if (this.currentOrgId && this.currentOrgId !== organizationId) {
      this.leaveOrg(this.currentOrgId)
    }

    this.currentOrgId = organizationId

    // In development, try WebSocket first
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      this.tryWebSocket(organizationId)
    }

    // Always start polling as primary/fallback mechanism
    this.startPolling()
  }

  private async tryWebSocket(_organizationId: string): Promise<void> {
    if (this.socket) return

    try {
      const { io } = await import('socket.io-client')
      const socket = io('/?XTransformPort=3003', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 2000,
        timeout: 5000,
        forceNew: false,
      })

      socket.on('connect', () => {
        console.log('[RealtimeClient] WebSocket connected')
        this.useWebSocket = true
        this.reconnectAttempts = 0
        if (this.currentOrgId) {
          socket.emit('join-org', this.currentOrgId)
        }
      })

      socket.on('disconnect', () => {
        this.useWebSocket = false
      })

      socket.on('connect_error', (error: Error) => {
        if (!this.hasLoggedInitialError) {
          console.info('[RealtimeClient] WebSocket unavailable, using polling fallback')
          this.hasLoggedInitialError = true
        }
        this.reconnectAttempts++
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.useWebSocket = false
          socket.disconnect()
          this.socket = null
        }
      })

      socket.on('notification', (notification: RealtimeNotification) => {
        this.notifyHandlers(notification)
      })

      socket.on('joined-org', () => {
        console.log('[RealtimeClient] Joined org room via WebSocket')
      })

      this.socket = socket
    } catch {
      // socket.io-client not available or failed to load
      this.useWebSocket = false
    }
  }

  /**
   * HTTP Polling — fetches recent notifications from the REST API.
   * This is the primary mechanism on Vercel (serverless) since
   * WebSocket connections cannot persist across serverless invocations.
   */
  private startPolling(): void {
    this.stopPolling()
    this.isPolling = true

    // Initial poll immediately
    this.poll()

    // Then poll every 30 seconds
    this.pollInterval = setInterval(() => {
      this.poll()
    }, 30_000)
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    this.isPolling = false
  }

  private async poll(): Promise<void> {
    if (!this.currentOrgId) return

    // Don't poll if no auth token is available yet.
    // This prevents 401 errors when the component mounts before
    // the auth store has populated localStorage with the JWT.
    const authHeaders = getAuthHeaders()
    if (!authHeaders.Authorization) return

    try {
      const params = new URLSearchParams({ orgId: this.currentOrgId })
      if (this.lastPollTimestamp) {
        params.set('since', this.lastPollTimestamp)
      }

      const response = await fetch(`/api/notifications?${params}`, {
        headers: authHeaders,
      })
      if (!response.ok) return

      const data = await response.json()
      const notifications: RealtimeNotification[] = data.notifications || []

      // Update the timestamp for next poll
      if (notifications.length > 0) {
        this.lastPollTimestamp = notifications[0].createdAt

        // Notify handlers of new notifications
        for (const notification of notifications) {
          this.notifyHandlers(notification)
        }
      }

      // Update timestamp even if no new notifications
      if (!this.lastPollTimestamp) {
        this.lastPollTimestamp = new Date().toISOString()
      }
    } catch {
      // Silently fail — polling will retry
    }
  }

  private notifyHandlers(notification: RealtimeNotification): void {
    this.handlers.forEach((handler) => {
      try {
        handler(notification)
      } catch (err) {
        console.warn('[RealtimeClient] Error in notification handler:', err)
      }
    })
  }

  disconnect(): void {
    this.currentOrgId = null
    this.lastPollTimestamp = null
    this.stopPolling()
    this.handlers.clear()

    if (this.socket) {
      const s = this.socket as { disconnect: () => void }
      s.disconnect()
      this.socket = null
    }
  }

  leaveOrg(organizationId: string): void {
    if (this.socket && (this.socket as { connected?: boolean })?.connected) {
      (this.socket as { emit: (event: string, data: string) => void }).emit('leave-org', organizationId)
    }
    if (this.currentOrgId === organizationId) {
      this.currentOrgId = null
      this.stopPolling()
    }
  }

  onNotification(handler: NotificationHandler): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  isConnected(): boolean {
    return this.isPolling || (this.socket as { connected?: boolean })?.connected === true
  }

  getCurrentOrgId(): string | null {
    return this.currentOrgId
  }
}

// Singleton instance
let instance: RealtimeClient | null = null

export function getRealtimeClient(): RealtimeClient {
  if (!instance) {
    instance = new RealtimeClient()
  }
  return instance
}

export { RealtimeClient }

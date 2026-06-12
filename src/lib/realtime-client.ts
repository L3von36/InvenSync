'use client'

import { io, Socket } from 'socket.io-client'

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

class RealtimeClient {
  private socket: Socket | null = null
  private currentOrgId: string | null = null
  private handlers: Set<NotificationHandler> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private isConnecting = false
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private isDisabled = false
  private hasLoggedInitialError = false

  connect(organizationId: string): void {
    // Don't try to connect if disabled due to previous failures
    if (this.isDisabled) return

    if (this.socket?.connected && this.currentOrgId === organizationId) {
      return
    }

    // If already connected to a different org, leave first
    if (this.socket?.connected && this.currentOrgId && this.currentOrgId !== organizationId) {
      this.socket.emit('leave-org', this.currentOrgId)
    }

    this.currentOrgId = organizationId

    if (!this.socket) {
      this.isConnecting = true
      // Connect to the notification service via the gateway
      this.socket = io('/?XTransformPort=3003', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 5000,
        forceNew: false,
      })

      this.setupEventHandlers()
    }

    // Join the org room
    if (this.socket.connected) {
      this.socket.emit('join-org', organizationId)
    }

    this.startPing()
  }

  private setupEventHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('[RealtimeClient] Connected to notification service')
      this.isConnecting = false
      this.reconnectAttempts = 0

      // Re-join org room after reconnection
      if (this.currentOrgId) {
        this.socket!.emit('join-org', this.currentOrgId)
      }
    })

    this.socket.on('disconnect', (reason) => {
      console.log(`[RealtimeClient] Disconnected: ${reason}`)
      this.stopPing()
    })

    this.socket.on('connect_error', (error) => {
      if (!this.hasLoggedInitialError) {
        console.warn(`[RealtimeClient] Connection error: ${error.message}. Real-time notifications unavailable.`)
        this.hasLoggedInitialError = true
      }
      this.reconnectAttempts++
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn('[RealtimeClient] Max reconnection attempts reached. Disabling real-time notifications.')
        this.isDisabled = true
        this.disconnect()
      }
    })

    this.socket.on('joined-org', (data: { organizationId: string; roomName: string }) => {
      console.log(`[RealtimeClient] Joined org room: ${data.roomName}`)
    })

    this.socket.on('left-org', (data: { organizationId: string; roomName: string }) => {
      console.log(`[RealtimeClient] Left org room: ${data.roomName}`)
    })

    this.socket.on('notification', (notification: RealtimeNotification) => {
      // Notify all registered handlers
      this.handlers.forEach((handler) => {
        try {
          handler(notification)
        } catch (err) {
          console.warn('[RealtimeClient] Error in notification handler:', err)
        }
      })
    })

    this.socket.on('pong', (data: { timestamp: number }) => {
      const latency = Date.now() - data.timestamp
      if (latency > 5000) {
        console.warn(`[RealtimeClient] High latency: ${latency}ms`)
      }
    })
  }

  private startPing(): void {
    this.stopPing()
    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping')
      }
    }, 30000) // Ping every 30 seconds
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  disconnect(): void {
    if (this.currentOrgId && this.socket?.connected) {
      this.socket.emit('leave-org', this.currentOrgId)
    }
    this.currentOrgId = null
    this.stopPing()
    this.handlers.clear()

    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  leaveOrg(organizationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave-org', organizationId)
    }
    if (this.currentOrgId === organizationId) {
      this.currentOrgId = null
    }
  }

  onNotification(handler: NotificationHandler): () => void {
    this.handlers.add(handler)
    // Return unsubscribe function
    return () => {
      this.handlers.delete(handler)
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false
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

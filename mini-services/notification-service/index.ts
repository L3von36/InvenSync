import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

const PORT = 3003
const MAX_BODY_SIZE = 1024 * 1024 // 1MB limit for broadcast requests

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  // Connection error handling
  connectTimeout: 10000,
  pingTimeout: 20000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB max message size
})

// Track connected clients per org
const orgRooms = new Map<string, Set<string>>()

// Helper to validate notification payload
function validateNotificationPayload(data: unknown): {
  organizationId: string
  type: string
  title: string
  message: string
  metadata: Record<string, unknown>
} | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (!d.organizationId || typeof d.organizationId !== 'string') return null
  if (!d.type || typeof d.type !== 'string') return null
  if (!d.title || typeof d.title !== 'string') return null
  if (!d.message || typeof d.message !== 'string') return null
  if (d.metadata && typeof d.metadata !== 'object') return null
  return {
    organizationId: d.organizationId,
    type: d.type,
    title: d.title,
    message: d.message,
    metadata: (d.metadata as Record<string, unknown>) || {},
  }
}

// Helper to safely handle socket events
function safeEventHandler(socket: Socket, event: string, handler: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    try {
      handler(...args)
    } catch (err) {
      console.error(`[NotificationService] Error handling ${event} from ${socket.id}:`, err)
      socket.emit('error', { event, message: 'Internal server error' })
    }
  }
}

io.on('connection', (socket) => {
  console.log(`[NotificationService] Client connected: ${socket.id}`)

  // Client joins an organization room
  socket.on('join-org', safeEventHandler(socket, 'join-org', (args) => {
    const organizationId = args as string
    if (!organizationId || typeof organizationId !== 'string') {
      socket.emit('error', { event: 'join-org', message: 'Invalid organizationId' })
      return
    }
    const roomName = `org:${organizationId}`
    socket.join(roomName)

    if (!orgRooms.has(organizationId)) {
      orgRooms.set(organizationId, new Set())
    }
    orgRooms.get(organizationId)!.add(socket.id)

    console.log(`[NotificationService] Client ${socket.id} joined room: ${roomName}`)
    socket.emit('joined-org', { organizationId, roomName })
  }))

  // Client leaves an organization room
  socket.on('leave-org', safeEventHandler(socket, 'leave-org', (args) => {
    const organizationId = args as string
    if (!organizationId || typeof organizationId !== 'string') {
      return
    }
    const roomName = `org:${organizationId}`
    socket.leave(roomName)

    const clients = orgRooms.get(organizationId)
    if (clients) {
      clients.delete(socket.id)
      if (clients.size === 0) {
        orgRooms.delete(organizationId)
      }
    }

    console.log(`[NotificationService] Client ${socket.id} left room: ${roomName}`)
    socket.emit('left-org', { organizationId, roomName })
  }))

  // Notification event: broadcast to org room
  socket.on('notification', safeEventHandler(socket, 'notification', (args) => {
    const validated = validateNotificationPayload(args)
    if (!validated) {
      socket.emit('error', { event: 'notification', message: 'Invalid notification payload' })
      return
    }

    const { organizationId, type, title, message, metadata } = validated
    const roomName = `org:${organizationId}`
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      organizationId,
      type,
      title,
      message,
      metadata,
      createdAt: new Date().toISOString(),
    }

    // Broadcast to all clients in the org room (including sender)
    io.to(roomName).emit('notification', notification)
    console.log(`[NotificationService] Notification broadcast to ${roomName}: ${title}`)
  }))

  // Ping/Pong heartbeat
  socket.on('ping', safeEventHandler(socket, 'ping', () => {
    socket.emit('pong', { timestamp: Date.now() })
  }))

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[NotificationService] Client disconnected: ${socket.id} (${reason})`)
    // Clean up org rooms
    for (const [orgId, clients] of orgRooms.entries()) {
      if (clients.has(socket.id)) {
        clients.delete(socket.id)
        if (clients.size === 0) {
          orgRooms.delete(orgId)
        }
      }
    }
  })

  // Handle socket errors
  socket.on('error', (err) => {
    console.error(`[NotificationService] Socket error for ${socket.id}:`, err)
  })
})

// REST endpoint for other services to send notifications
// POST /broadcast
const originalListeners = httpServer.listeners('request').slice()
httpServer.removeAllListeners('request')

httpServer.on('request', (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    })
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/broadcast') {
    let body = ''
    let bodySize = 0

    req.on('data', (chunk: Buffer) => {
      bodySize += chunk.length
      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(JSON.stringify({ error: 'Request body too large' }))
        req.destroy()
        return
      }
      body += chunk.toString()
    })

    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        const validated = validateNotificationPayload(data)

        if (!validated) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
          res.end(JSON.stringify({ error: 'Missing required fields: organizationId, type, title, message' }))
          return
        }

        const { organizationId, type, title, message, metadata } = validated
        const roomName = `org:${organizationId}`
        const notification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          organizationId,
          type,
          title,
          message,
          metadata,
          createdAt: new Date().toISOString(),
        }

        io.to(roomName).emit('notification', notification)
        console.log(`[NotificationService] REST broadcast to ${roomName}: ${title}`)

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(JSON.stringify({ success: true, notification }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(JSON.stringify({ error: 'Invalid JSON body' }))
      }
    })

    req.on('error', (err) => {
      console.error('[NotificationService] Request error:', err)
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(JSON.stringify({ error: 'Internal server error' }))
      }
    })
    return
  }

  // Health check endpoint
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({
      status: 'ok',
      service: 'notification-service',
      port: PORT,
      connectedClients: io.sockets.sockets.size,
      activeOrgs: orgRooms.size,
      uptime: process.uptime(),
    }))
    return
  }

  // Pass through to socket.io
  for (const listener of originalListeners) {
    listener.call(httpServer, req, res)
  }
})

// Process-level error handlers
process.on('uncaughtException', (err) => {
  console.error('[NotificationService] Uncaught exception:', err)
  // Don't crash — log and continue
})

process.on('unhandledRejection', (reason) => {
  console.error('[NotificationService] Unhandled rejection:', reason)
  // Don't crash — log and continue
})

// Graceful shutdown
function gracefulShutdown(signal: string) {
  console.log(`[NotificationService] Received ${signal}, shutting down gracefully...`)

  // Close all socket connections
  io.disconnectSockets(true)

  httpServer.close(() => {
    console.log('[NotificationService] Server closed')
    process.exit(0)
  })

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('[NotificationService] Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

httpServer.listen(PORT, () => {
  console.log(`[NotificationService] Server running on port ${PORT}`)
  console.log(`[NotificationService] WebSocket endpoint: ws://localhost:${PORT}`)
  console.log(`[NotificationService] REST broadcast: http://localhost:${PORT}/broadcast`)
  console.log(`[NotificationService] Health check: http://localhost:${PORT}/health`)
})

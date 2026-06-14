// ============================================
// Notification Broadcast Helper
// ============================================
// Creates a notification in the database AND pushes it
// via WebSocket in real-time. This is the single source
// of truth for "fire a notification" from any backend code.
//
// Usage:
//   import { broadcastNotification } from '@/lib/notification-broadcast'
//   await broadcastNotification({
//     organizationId: '...',
//     type: 'new_sale',
//     title: 'New Sale!',
//     message: 'Sale #INV-001 completed',
//     actionUrl: '/sales',
//   })

export interface BroadcastNotificationParams {
  organizationId: string
  shopId?: string | null
  userId?: string | null  // null = all org members
  type: string
  title: string
  message: string
  actionUrl?: string | null
  metadata?: Record<string, unknown> | null
  // If true, skip DB insert and only push via WebSocket (ephemeral)
  ephemeral?: boolean
}

// ---------------------------------------------------------------------------
// 1. broadcastNotification — DB + WebSocket
// ---------------------------------------------------------------------------

export async function broadcastNotification(params: BroadcastNotificationParams): Promise<{
  id: string
  persisted: boolean
}> {
  const {
    organizationId,
    shopId = null,
    userId = null,
    type,
    title,
    message,
    actionUrl = null,
    metadata = null,
    ephemeral = false,
  } = params

  let notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 1. Persist to database (unless ephemeral)
  if (!ephemeral) {
    try {
      const { db } = await import('@/lib/db')
      const record = await db.notification.create({
        data: {
          organizationId,
          shopId,
          userId,
          type,
          title,
          message,
          actionUrl,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      })
      notificationId = record.id
    } catch (err) {
      console.error('[broadcastNotification] DB insert failed:', err)
      // Continue — still push via WebSocket even if DB fails
    }
  }

  // 2. Push via WebSocket
  try {
    await pushToWebSocket({
      id: notificationId,
      organizationId,
      type,
      title,
      message,
      actionUrl,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[broadcastNotification] WebSocket push failed:', err)
    // Non-fatal — notification is persisted in DB, will be fetched on next poll
  }

  return { id: notificationId, persisted: !ephemeral }
}

// ---------------------------------------------------------------------------
// 2. broadcastNotificationToMany — multiple orgs at once
// ---------------------------------------------------------------------------

export async function broadcastNotificationToMany(
  orgIds: string[],
  params: Omit<BroadcastNotificationParams, 'organizationId'>
): Promise<void> {
  await Promise.all(
    orgIds.map(orgId =>
      broadcastNotification({ ...params, organizationId: orgId })
    )
  )
}

// ---------------------------------------------------------------------------
// 3. WebSocket push helper
// ---------------------------------------------------------------------------

interface WebSocketNotification {
  id: string
  organizationId: string
  type: string
  title: string
  message: string
  actionUrl?: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

async function pushToWebSocket(notification: WebSocketNotification): Promise<void> {
  const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000) // 3s timeout

  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: notification.organizationId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        metadata: {
          ...notification.metadata,
          id: notification.id,
          actionUrl: notification.actionUrl,
          createdAt: notification.createdAt,
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Broadcast endpoint returned ${response.status}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// 4. Notification type constants for consistency
// ---------------------------------------------------------------------------

export const NotificationTypes = {
  // Module lifecycle
  MODULE_EXPIRY: 'module_expiry',
  MODULE_EXPIRED: 'module_expired',

  // Stock & inventory
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
  STOCK_TRANSFER: 'stock_transfer',
  STOCK_RECEIVED: 'stock_received',

  // Sales
  NEW_SALE: 'new_sale',
  LARGE_SALE: 'large_sale',
  SALE_RETURN: 'sale_return',

  // Debts & payments
  DEBT_REMINDER: 'debt_reminder',
  DEBT_OVERDUE: 'debt_overdue',
  DEBT_PAYMENT: 'debt_payment',

  // Expenses
  LARGE_EXPENSE: 'large_expense',
  EXPENSE_APPROVED: 'expense_approved',

  // Customers
  NEW_CUSTOMER: 'new_customer',
  CREDIT_LIMIT: 'credit_limit',

  // System
  DAILY_SUMMARY: 'daily_summary',
  SYSTEM: 'system',
  SECURITY_ALERT: 'security_alert',
} as const

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes]

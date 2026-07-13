'use client'

import { create } from 'zustand'

export interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  actionUrl: string | null
  metadata: string | null
  createdAt: string
}

interface NotificationState {
  notifications: NotificationItem[]
  unreadCount: number
  isLoading: boolean

  fetchNotifications: (orgId: string, shopId?: string) => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: (orgId: string) => Promise<void>
  /** Clear all notification state — called on logout so the next user
   *  never sees the previous user's notifications. */
  reset: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async (orgId: string, shopId?: string) => {
    set({ isLoading: true })
    try {
      const { api } = await import('@/lib/api-client')
      const data = await api.getNotifications(orgId, { limit: 30, shopId })
      set({
        notifications: data.notifications,
        unreadCount: data.unreadCount,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      const { api } = await import('@/lib/api-client')
      await api.markNotificationRead(notificationId)
      set(state => ({
        notifications: state.notifications.map(n =>
          n.id === notificationId ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }))
    } catch {
      // Silently fail
    }
  },

  markAllAsRead: async (orgId: string) => {
    try {
      const { api } = await import('@/lib/api-client')
      await api.markAllNotificationsRead(orgId)
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0,
      }))
    } catch {
      // Silently fail
    }
  },

  reset: () => {
    set({ notifications: [], unreadCount: 0, isLoading: false })
  },
}))

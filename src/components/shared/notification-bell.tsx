'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useNotificationStore } from '@/lib/stores/notification-store'
import { useAppStore, type Page } from '@/lib/stores/app-store'
import { getRealtimeClient, type RealtimeNotification } from '@/lib/realtime-client'
import { playNotificationSound } from '@/lib/notification-sound'
import { toast } from 'sonner'

function actionUrlToPage(url: string): Page | null {
  const mapping: Record<string, Page> = {
    '/modules': 'modules',
    '/inventory': 'inventory',
    '/sales': 'sales',
    '/customers': 'customers',
    '/debts': 'debts',
    '/reports': 'reports',
    '/settings': 'settings',
    '/dashboard': 'dashboard',
  }
  return mapping[url] || null
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function getTypeDotColor(type: string): string {
  switch (type) {
    case 'module_expiry':
      return 'bg-amber-500'
    case 'module_expired':
      return 'bg-red-500'
    case 'low_stock':
      return 'bg-orange-500'
    case 'debt_reminder':
      return 'bg-yellow-500'
    case 'new_sale':
      return 'bg-emerald-500'
    case 'daily_summary':
      return 'bg-blue-500'
    case 'system':
      return 'bg-blue-500'
    default:
      return 'bg-muted-foreground'
  }
}

export function NotificationBell() {
  const { currentOrg, currentShop } = useAuthStore()
  const { notifications, unreadCount, isLoading, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore()
  const { setPage } = useAppStore()
  const [realtimeUnread, setRealtimeUnread] = useState(0)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const lastNotifIdRef = useRef<string | null>(null)

  // Connect to WebSocket when org changes
  useEffect(() => {
    if (!currentOrg?.id) return

    const client = getRealtimeClient()
    client.connect(currentOrg.id)

    // Register notification handler
    const unsubscribe = client.onNotification((notification: RealtimeNotification) => {
      // Avoid duplicate toasts for the same notification
      if (notification.id === lastNotifIdRef.current) return
      lastNotifIdRef.current = notification.id

      // Play notification sound
      playNotificationSound()

      // Show toast
      toast(notification.title, {
        description: notification.message,
        duration: 5000,
      })

      // Increment realtime unread counter
      setRealtimeUnread((prev) => prev + 1)

      // Refresh notification list from server
      fetchNotifications(currentOrg.id, currentShop?.id).then(() => {
        // Reset realtime counter after fetch since server count is now accurate
        setRealtimeUnread(0)
      })
    })

    unsubscribeRef.current = unsubscribe

    return () => {
      unsubscribe()
      client.leaveOrg(currentOrg.id)
    }
  }, [currentOrg?.id, currentShop?.id, fetchNotifications])

  // Reset realtime unread when the dropdown opens and notifications are refreshed
  const handleOpen = (open: boolean) => {
    if (open && currentOrg) {
      fetchNotifications(currentOrg.id, currentShop?.id)
      setRealtimeUnread(0)
    }
  }

  const totalUnread = unreadCount + realtimeUnread

  const handleNotificationClick = (notification: {
    id: string
    isRead: boolean
    actionUrl: string | null
  }) => {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }
    if (notification.actionUrl) {
      const page = actionUrlToPage(notification.actionUrl)
      if (page) {
        setPage(page)
      }
    }
  }

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (currentOrg) {
      markAllAsRead(currentOrg.id)
      setRealtimeUnread(0)
    }
  }

  return (
    <DropdownMenu onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 relative" aria-label={`Notifications${totalUnread > 0 ? `, ${totalUnread} unread` : ''}`}>
          <Bell className="size-4" aria-hidden="true" />
          {totalUnread > 0 && (
            <Badge
              className="absolute -top-1 -right-1 size-4 min-w-4 p-0 flex items-center justify-center text-[10px] font-semibold bg-red-500 text-white border-0 hover:bg-red-500"
              aria-hidden="true"
            >
              {totalUnread > 9 ? '9+' : totalUnread}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          {totalUnread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0 px-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
            >
              <Check className="size-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Bell className="size-8 mb-2 opacity-40" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer ${
                  !notification.isRead ? 'bg-muted/50' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                {/* Type dot */}
                <span className={`mt-1.5 size-2 rounded-full shrink-0 ${getTypeDotColor(notification.type)}`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <p className={`text-sm leading-tight ${!notification.isRead ? 'font-medium' : 'text-foreground'}`}>
                      {notification.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                      {timeAgo(notification.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                    {notification.message}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

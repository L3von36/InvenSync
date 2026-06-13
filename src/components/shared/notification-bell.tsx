'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import {
  Bell,
  Check,
  Package,
  ShoppingCart,
  CreditCard,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Shield,
  Settings,
  FileText,
  Truck,
  Users,
  Zap,
  Filter,
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useNotificationStore, type NotificationItem } from '@/lib/stores/notification-store'
import { useAppStore, type Page } from '@/lib/stores/app-store'
import { getRealtimeClient, type RealtimeNotification } from '@/lib/realtime-client'
import { playNotificationSound } from '@/lib/notification-sound'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ============================================
// Notification category system
// ============================================

type NotificationCategory = 'all' | 'stock' | 'sales' | 'finance' | 'system'

const CATEGORY_CONFIG: Record<NotificationCategory, { label: string; icon: React.ElementType }> = {
  all: { label: 'All', icon: Bell },
  stock: { label: 'Stock', icon: Package },
  sales: { label: 'Sales', icon: ShoppingCart },
  finance: { label: 'Finance', icon: CreditCard },
  system: { label: 'System', icon: Settings },
}

function getNotificationCategory(type: string): NotificationCategory {
  switch (type) {
    case 'low_stock':
    case 'out_of_stock':
    case 'stock_transfer':
    case 'stock_received':
      return 'stock'
    case 'new_sale':
    case 'large_sale':
    case 'sale_return':
      return 'sales'
    case 'debt_reminder':
    case 'debt_overdue':
    case 'debt_payment':
    case 'large_expense':
    case 'expense_approved':
    case 'credit_limit':
      return 'finance'
    case 'module_expiry':
    case 'module_expired':
    case 'daily_summary':
    case 'system':
    case 'security_alert':
      return 'system'
    default:
      return 'system'
  }
}

// ============================================
// Icon + color mapping per notification type
// ============================================

interface TypeStyle {
  icon: React.ElementType
  bgColor: string
  iconColor: string
  dotColor: string
}

const TYPE_STYLES: Record<string, TypeStyle> = {
  // Stock
  low_stock: { icon: AlertTriangle, bgColor: 'bg-orange-100 dark:bg-orange-950/50', iconColor: 'text-orange-600 dark:text-orange-400', dotColor: 'bg-orange-500' },
  out_of_stock: { icon: Package, bgColor: 'bg-red-100 dark:bg-red-950/50', iconColor: 'text-red-600 dark:text-red-400', dotColor: 'bg-red-500' },
  stock_transfer: { icon: Truck, bgColor: 'bg-blue-100 dark:bg-blue-950/50', iconColor: 'text-blue-600 dark:text-blue-400', dotColor: 'bg-blue-500' },
  stock_received: { icon: Package, bgColor: 'bg-emerald-100 dark:bg-emerald-950/50', iconColor: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500' },
  // Sales
  new_sale: { icon: ShoppingCart, bgColor: 'bg-emerald-100 dark:bg-emerald-950/50', iconColor: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500' },
  large_sale: { icon: TrendingUp, bgColor: 'bg-emerald-100 dark:bg-emerald-950/50', iconColor: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500' },
  sale_return: { icon: ShoppingCart, bgColor: 'bg-amber-100 dark:bg-amber-950/50', iconColor: 'text-amber-600 dark:text-amber-400', dotColor: 'bg-amber-500' },
  // Finance
  debt_reminder: { icon: CreditCard, bgColor: 'bg-yellow-100 dark:bg-yellow-950/50', iconColor: 'text-yellow-600 dark:text-yellow-400', dotColor: 'bg-yellow-500' },
  debt_overdue: { icon: AlertCircle, bgColor: 'bg-red-100 dark:bg-red-950/50', iconColor: 'text-red-600 dark:text-red-400', dotColor: 'bg-red-500' },
  debt_payment: { icon: DollarSign, bgColor: 'bg-emerald-100 dark:bg-emerald-950/50', iconColor: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500' },
  large_expense: { icon: DollarSign, bgColor: 'bg-amber-100 dark:bg-amber-950/50', iconColor: 'text-amber-600 dark:text-amber-400', dotColor: 'bg-amber-500' },
  expense_approved: { icon: Check, bgColor: 'bg-emerald-100 dark:bg-emerald-950/50', iconColor: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500' },
  credit_limit: { icon: CreditCard, bgColor: 'bg-amber-100 dark:bg-amber-950/50', iconColor: 'text-amber-600 dark:text-amber-400', dotColor: 'bg-amber-500' },
  // System
  module_expiry: { icon: AlertTriangle, bgColor: 'bg-amber-100 dark:bg-amber-950/50', iconColor: 'text-amber-600 dark:text-amber-400', dotColor: 'bg-amber-500' },
  module_expired: { icon: AlertCircle, bgColor: 'bg-red-100 dark:bg-red-950/50', iconColor: 'text-red-600 dark:text-red-400', dotColor: 'bg-red-500' },
  daily_summary: { icon: FileText, bgColor: 'bg-blue-100 dark:bg-blue-950/50', iconColor: 'text-blue-600 dark:text-blue-400', dotColor: 'bg-blue-500' },
  system: { icon: Settings, bgColor: 'bg-blue-100 dark:bg-blue-950/50', iconColor: 'text-blue-600 dark:text-blue-400', dotColor: 'bg-blue-500' },
  security_alert: { icon: Shield, bgColor: 'bg-red-100 dark:bg-red-950/50', iconColor: 'text-red-600 dark:text-red-400', dotColor: 'bg-red-500' },
}

const DEFAULT_STYLE: TypeStyle = {
  icon: Zap,
  bgColor: 'bg-muted',
  iconColor: 'text-muted-foreground',
  dotColor: 'bg-muted-foreground',
}

function getTypeStyle(type: string): TypeStyle {
  return TYPE_STYLES[type] || DEFAULT_STYLE
}

// ============================================
// Helpers
// ============================================

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
    '/expenses': 'expenses',
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

// ============================================
// Individual Notification Item
// ============================================

function NotificationItem({
  notification,
  onClick,
}: {
  notification: NotificationItem
  onClick: (n: NotificationItem) => void
}) {
  const style = getTypeStyle(notification.type)
  const Icon = style.icon

  return (
    <button
      className={cn(
        'flex items-start gap-3 w-full px-3 py-3 text-left transition-colors hover:bg-accent/50',
        !notification.isRead && 'bg-primary/5'
      )}
      onClick={() => onClick(notification)}
    >
      {/* Icon */}
      <div className={cn('flex items-center justify-center size-8 rounded-full shrink-0', style.bgColor)}>
        <Icon className={cn('size-4', style.iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            'text-sm leading-tight',
            !notification.isRead ? 'font-semibold' : 'font-medium text-foreground/80'
          )}>
            {notification.title}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {!notification.isRead && (
              <span className={cn('size-2 rounded-full', style.dotColor)} />
            )}
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {timeAgo(notification.createdAt)}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
          {notification.message}
        </p>
      </div>
    </button>
  )
}

// ============================================
// Main Notification Bell Component
// ============================================

export function NotificationBell() {
  const { currentOrg, currentShop } = useAuthStore()
  const { notifications, unreadCount, isLoading, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore()
  const { setPage } = useAppStore()
  const [realtimeUnread, setRealtimeUnread] = useState(0)
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all')
  const [isOpen, setIsOpen] = useState(false)
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

      // Determine toast style based on notification type
      const category = getNotificationCategory(notification.type)
      const style = getTypeStyle(notification.type)

      // Show styled toast with icon
      toast(notification.title, {
        description: notification.message,
        duration: 5000,
        icon: <style.icon className={cn('size-4', style.iconColor)} />,
      })

      // Increment realtime unread counter
      setRealtimeUnread((prev) => prev + 1)

      // Refresh notification list from server
      fetchNotifications(currentOrg.id, currentShop?.id).then(() => {
        setRealtimeUnread(0)
      })
    })

    unsubscribeRef.current = unsubscribe

    return () => {
      unsubscribe()
      client.leaveOrg(currentOrg.id)
    }
  }, [currentOrg?.id, currentShop?.id, fetchNotifications])

  const totalUnread = unreadCount + realtimeUnread

  // Filter notifications by active category
  const filteredNotifications = useMemo(() => {
    if (activeCategory === 'all') return notifications
    return notifications.filter(n => getNotificationCategory(n.type) === activeCategory)
  }, [notifications, activeCategory])

  // Count per category
  const categoryCounts = useMemo(() => {
    const counts: Record<NotificationCategory, number> = { all: 0, stock: 0, sales: 0, finance: 0, system: 0 }
    for (const n of notifications) {
      if (!n.isRead) {
        counts.all++
        const cat = getNotificationCategory(n.type)
        counts[cat]++
      }
    }
    return counts
  }, [notifications])

  const handleOpen = useCallback((open: boolean) => {
    setIsOpen(open)
    if (open && currentOrg) {
      fetchNotifications(currentOrg.id, currentShop?.id)
      setRealtimeUnread(0)
    }
  }, [currentOrg, currentShop, fetchNotifications])

  const handleNotificationClick = useCallback((notification: NotificationItem) => {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }
    if (notification.actionUrl) {
      const page = actionUrlToPage(notification.actionUrl)
      if (page) {
        setPage(page)
        setIsOpen(false)
      }
    }
  }, [markAsRead, setPage])

  const handleMarkAllRead = useCallback(() => {
    if (currentOrg) {
      markAllAsRead(currentOrg.id)
      setRealtimeUnread(0)
    }
  }, [currentOrg, markAllAsRead])

  return (
    <Popover open={isOpen} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 relative"
          aria-label={`Notifications${totalUnread > 0 ? `, ${totalUnread} unread` : ''}`}
        >
          <Bell className={cn('size-4 transition-transform', isOpen && 'scale-110')} aria-hidden="true" />
          {totalUnread > 0 && (
            <Badge
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white border-2 border-background hover:bg-red-500 animate-in fade-in zoom-in duration-200"
              aria-hidden="true"
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 shadow-lg" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {totalUnread > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                {totalUnread} new
              </Badge>
            )}
          </div>
          {totalUnread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
            >
              <Check className="size-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="px-3 pt-2 pb-1">
          <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as NotificationCategory)}>
            <TabsList className="h-8 w-full p-0.5 bg-muted/50">
              {(Object.entries(CATEGORY_CONFIG) as [NotificationCategory, typeof CATEGORY_CONFIG[NotificationCategory]][]).map(([key, { label }]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="h-7 text-[11px] px-2 gap-1 data-[state=active]:bg-background"
                >
                  {label}
                  {key !== 'all' && categoryCounts[key] > 0 && (
                    <span className="size-3.5 rounded-full bg-primary text-primary-foreground text-[8px] flex items-center justify-center font-bold leading-none">
                      {categoryCounts[key] > 9 ? '9' : categoryCounts[key]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Notification List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
            Loading...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="size-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {activeCategory === 'all' ? 'No notifications yet' : `No ${CATEGORY_CONFIG[activeCategory].label.toLowerCase()} notifications`}
            </p>
            <p className="text-xs mt-1 text-muted-foreground/70">
              {activeCategory === 'all' ? "We'll notify you when something happens" : 'Try a different category'}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="divide-y divide-border/50">
              {filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2 text-center">
              <p className="text-[10px] text-muted-foreground">
                Real-time updates via WebSocket • {notifications.length} total
              </p>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

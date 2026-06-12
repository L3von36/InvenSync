'use client'

import { useEffect } from 'react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAppStore, pageTitles, type Page } from '@/lib/stores/app-store'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useNotificationStore } from '@/lib/stores/notification-store'
import { NotificationBell } from '@/components/shared/notification-bell'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

// ============================================
// Theme Toggle
// ============================================
function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-10"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}

const pageBreadcrumbs: Record<Page, string[]> = {
  'dashboard': ['Home'],
  'products': ['Home', 'Products'],
  'product-types': ['Home', 'Product Types'],
  'inventory': ['Home', 'Inventory'],
  'sales': ['Home', 'Sales'],
  'customers': ['Home', 'Customers'],
  'suppliers': ['Home', 'Suppliers'],
  'debts': ['Home', 'Debts & Credits'],
  'reports': ['Home', 'Reports'],
  'ai-inventory': ['Home', 'AI', 'Inventory'],
  'ai-assistant': ['Home', 'AI', 'Assistant'],
  'settings': ['Home', 'Settings'],
  'services': ['Home', 'Services'],
  'branches': ['Home', 'Branches'],
  'admin-dashboard': ['Home', 'Admin', 'Dashboard'],
  'admin-organizations': ['Home', 'Admin', 'Organizations'],
  'admin-users': ['Home', 'Admin', 'Users'],
  'admin-modules': ['Home', 'Admin', 'Modules & Pricing'],
  'admin-sales-team': ['Home', 'Admin', 'Sales Team'],
  'admin-regions': ['Home', 'Admin', 'Regions & Cities'],
  'admin-notifications': ['Home', 'Admin', 'Notifications'],
  'setup': ['Home', 'Setup'],
  'sales-rep-dashboard': ['Home', 'My Dashboard'],
  'modules': ['Home', 'My Modules'],
  'profit-loss': ['Home', 'Reports', 'Profit & Loss'],
  'audit-log': ['Home', 'Admin', 'Audit Log'],
  'expenses': ['Home', 'Expenses'],
  'stock-transfers': ['Home', 'Stock Transfers'],
  'purchase-orders': ['Home', 'Purchase Orders'],
  'loyalty': ['Home', 'Customers', 'Loyalty'],
  'credit-limits': ['Home', 'Customers', 'Credit Limits'],
  'scheduled-reports': ['Home', 'Reports', 'Scheduled Reports'],
  'smart-search': ['Home', 'AI', 'Smart Search'],
  'price-optimization': ['Home', 'AI', 'Price Optimization'],
  'sales-forecast': ['Home', 'AI', 'Sales Forecast'],
  'anomaly-detection': ['Home', 'AI', 'Anomaly Detection'],
}

export function AppHeader() {
  const { currentPage } = useAppStore()
  const { user, logout, currentOrg, currentShop } = useAuthStore()
  const { fetchNotifications } = useNotificationStore()

  // Auto-fetch notifications and trigger expiry check
  useEffect(() => {
    if (!currentOrg) return
    fetchNotifications(currentOrg.id, currentShop?.id)
    // Trigger expiry check on mount
    fetch('/api/cron/check-expiries', { method: 'GET' }).catch(() => {})
    const interval = setInterval(() => {
      fetchNotifications(currentOrg.id, currentShop?.id)
    }, 60000)
    return () => clearInterval(interval)
  }, [currentOrg, currentShop, fetchNotifications])

  const title = pageTitles[currentPage]
  const breadcrumbs = pageBreadcrumbs[currentPage] || ['Home']

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4" role="banner">
      {/* Mobile menu + Sidebar trigger */}
      <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      {/* Breadcrumb */}
      <Breadcrumb className="hidden sm:flex">
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <BreadcrumbItem key={index}>
              {index === breadcrumbs.length - 1 ? (
                <BreadcrumbPage className="font-medium">{title}</BreadcrumbPage>
              ) : (
                <span className="text-muted-foreground">{crumb}</span>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Mobile page title */}
      <span className="text-sm font-medium sm:hidden">{title}</span>

      <div className="ml-auto flex items-center gap-2">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell */}
        <NotificationBell />

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative size-10 rounded-full" aria-label="User menu">
              <Avatar className="size-9">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="end">
            <div className="px-2 py-1.5 text-sm font-medium">{user?.name}</div>
            <div className="px-2 pb-2 text-xs text-muted-foreground">{user?.email}</div>
            <Separator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive mt-1" aria-label="Log out of your account">
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

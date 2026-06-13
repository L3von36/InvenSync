'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LayoutDashboard,
  Tags,
  Package,
  Warehouse,
  ShoppingCart,
  Users,
  Truck,
  CreditCard,
  BarChart3,
  ScanSearch,
  Bot,
  Settings,
  Building2,
  LogOut,
  ChevronDown,
  Wrench,
  Shield,
  X,
  Store,
  MapPin,
  Puzzle,
  Cog,
  UsersRound,
  Megaphone,
  Bell,
  UserCog,
  Office,
  Globe2,
  GitBranch,
  Sun,
  Moon,
  TrendingUp,
  ScrollText,
  Receipt,
  ArrowLeftRight,
  ClipboardList,
  Award,
  Search,
  CalendarClock,
  FileDown,
  DollarSign,
  ShieldAlert,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useAppStore, type Page } from '@/lib/stores/app-store'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { CurrencySwitcher } from '@/components/shared/currency-switcher'

// ============================================
// Module key mapping for nav items
// ============================================
const MODULE_KEY_MAP: Record<string, string> = {
  'products': 'inventory',
  'product-types': 'inventory',
  'inventory': 'inventory',
  'sales': 'sales',
  'customers': 'customers',
  'suppliers': 'suppliers',
  'debts': 'debts',
  'reports': 'reports',
  'services': 'services',
  'ai-inventory': 'ai-inventory',
  'ai-assistant': 'ai-assistant',
  'price-optimization': 'ai-inventory',
  'sales-forecast': 'ai-inventory',
  'profit-loss': 'reports',
  'expenses': 'expenses',
  'stock-transfers': 'inventory',
  'purchase-orders': 'inventory',
  'loyalty': 'customers',
  'credit-limits': 'debts',
  'smart-search': 'reports',
  'anomaly-detection': 'ai-inventory',
}

const mainNavItems: Array<{
  title: string
  page: Page
  icon: React.ElementType
  businessTypes?: string[]
  roles?: ('owner' | 'manager' | 'employee')[]
  moduleKey?: string
}> = [
  { title: 'Dashboard', page: 'dashboard', icon: LayoutDashboard },
  { title: 'Product Types', page: 'product-types', icon: Tags, businessTypes: ['retail', 'mixed'], roles: ['owner', 'manager'], moduleKey: 'inventory' },
  { title: 'Products', page: 'products', icon: Package, businessTypes: ['retail', 'mixed'], moduleKey: 'inventory' },
  { title: 'Inventory', page: 'inventory', icon: Warehouse, businessTypes: ['retail', 'mixed'], roles: ['owner', 'manager'], moduleKey: 'inventory' },
  { title: 'Services', page: 'services', icon: Wrench, businessTypes: ['service', 'mixed'], moduleKey: 'services' },
  { title: 'Sales', page: 'sales', icon: ShoppingCart, moduleKey: 'sales' },
  { title: 'Customers', page: 'customers', icon: Users, moduleKey: 'customers' },
  { title: 'Suppliers', page: 'suppliers', icon: Truck, roles: ['owner', 'manager'], moduleKey: 'suppliers' },
  { title: 'Debts & Credits', page: 'debts', icon: CreditCard, roles: ['owner', 'manager'], moduleKey: 'debts' },
  { title: 'Profit & Loss', page: 'profit-loss', icon: TrendingUp, roles: ['owner', 'manager'], moduleKey: 'reports' },
  { title: 'Expenses', page: 'expenses', icon: Receipt, roles: ['owner', 'manager'], moduleKey: 'expenses' },
  { title: 'Reports', page: 'reports', icon: BarChart3, roles: ['owner', 'manager'], moduleKey: 'reports' },
  { title: 'Branches', page: 'branches', icon: GitBranch, roles: ['owner', 'manager'], moduleKey: 'multi-shop' },
  { title: 'Stock Transfers', page: 'stock-transfers', icon: ArrowLeftRight, roles: ['owner', 'manager'], moduleKey: 'inventory' },
  { title: 'Purchase Orders', page: 'purchase-orders', icon: ClipboardList, roles: ['owner', 'manager'], moduleKey: 'inventory' },
  { title: 'Customer Loyalty', page: 'loyalty', icon: Award, moduleKey: 'customers' },
  { title: 'Credit Limits', page: 'credit-limits', icon: CreditCard, roles: ['owner', 'manager'], moduleKey: 'debts' },
]

const aiNavItems: Array<{
  title: string
  page: Page
  icon: React.ElementType
  roles?: ('owner' | 'manager' | 'employee')[]
  moduleKey?: string
}> = [
  { title: 'Smart Search', page: 'smart-search', icon: Search },
  { title: 'AI Inventory', page: 'ai-inventory', icon: ScanSearch, roles: ['owner', 'manager'], moduleKey: 'ai-inventory' },
  { title: 'AI Assistant', page: 'ai-assistant', icon: Bot, moduleKey: 'ai-assistant' },
  { title: 'Anomaly Detection', page: 'anomaly-detection', icon: ShieldAlert, roles: ['owner', 'manager'], moduleKey: 'ai-inventory' },
  { title: 'Price Optimization', page: 'price-optimization', icon: DollarSign, roles: ['owner', 'manager'], moduleKey: 'ai-inventory' },
  { title: 'Sales Forecast', page: 'sales-forecast', icon: TrendingUp, roles: ['owner', 'manager'], moduleKey: 'ai-inventory' },
]

export function AppSidebar() {
  const { user, organizations, currentOrg, currentOrgRole, setCurrentOrg, logout, shops, currentShop, setCurrentShop, activeModules } = useAuthStore()
  const { currentPage, setPage } = useAppStore()

  const isAdmin = user?.role === 'admin'
  const businessType = currentOrg?.businessType

  // Whether to show shop selector: only for business users with multi-shop OR >1 shop
  // Admin users should NEVER see a shop selector — they manage the platform, not individual shops
  const showShopSelector = !isAdmin && (shops.length > 1 || (activeModules.length > 0 && activeModules.includes('multi-shop')))

  // Check if a module is accessible
  // Graceful degradation: if activeModules is empty (not loaded yet), show all items
  const isModuleActive = (moduleKey?: string): boolean => {
    if (!moduleKey) return true // Dashboard and items without moduleKey always shown
    if (activeModules.length === 0) return true // Graceful degradation: if modules not loaded yet, show all
    return activeModules.includes(moduleKey)
  }

  // Admin users only see admin-specific nav items — hide all business-level nav
  // Business users see filtered items based on module, business type, and role
  const filteredNavItems = isAdmin
    ? []
    : mainNavItems.filter(item => {
        // Module gate
        if (!isModuleActive(item.moduleKey)) return false
        // Business type filter
        if (item.businessTypes && businessType && !item.businessTypes.includes(businessType)) return false
        // Role filter
        if (item.roles && currentOrgRole && !item.roles.includes(currentOrgRole)) return false
        return true
      })

  const filteredAiItems = isAdmin
    ? []
    : aiNavItems.filter(item => {
        if (!isModuleActive(item.moduleKey)) return false
        if (item.roles && currentOrgRole && !item.roles.includes(currentOrgRole)) return false
        return true
      })

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  return (
    <Sidebar collapsible="icon" aria-label="Main navigation">
      <SidebarHeader>
        {/* Logo */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="hover:bg-sidebar-accent">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Store className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">InvenSync</span>
                <span className="truncate text-xs text-muted-foreground">Inventory Management</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Organization & Shop Selectors */}
        {!isAdmin && organizations.length > 0 && (
          <>
            <SidebarSeparator />
            <div className="px-2 py-1 space-y-1">
              {/* If multiple orgs, show org selector */}
              {organizations.length > 1 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent transition-colors">
                      <Building2 className="size-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate text-left text-sidebar-foreground">
                        {currentOrg?.name || 'Select Org'}
                      </span>
                      <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" align="start" className="w-56">
                    {organizations.map((org) => (
                      <DropdownMenuItem
                        key={org.id}
                        onClick={() => setCurrentOrg(org)}
                        className={org.id === currentOrg?.id ? 'bg-accent' : ''}
                      >
                        <Building2 className="size-4 mr-2" />
                        <span className="truncate">{org.name}</span>
                        {org.id === currentOrg?.id && (
                          <span className="ml-auto text-xs text-primary">Active</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                /* Single org — just show org name as a label */
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <Building2 className="size-3.5 shrink-0" />
                  <span className="truncate">{currentOrg?.name}</span>
                </div>
              )}

              {/* Shop/Branch Selector — only shown when multi-shop is active */}
              {showShopSelector && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent transition-colors">
                      <MapPin className="size-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate text-left text-sidebar-foreground">
                        {currentShop?.name || 'Select Branch'}
                      </span>
                      <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" align="start" className="w-56">
                    {shops.filter(s => s.isActive).map((shop) => (
                      <DropdownMenuItem
                        key={shop.id}
                        onClick={() => setCurrentShop(shop)}
                        className={shop.id === currentShop?.id ? 'bg-accent' : ''}
                      >
                        <MapPin className="size-4 mr-2" />
                        <span className="truncate">{shop.name}</span>
                        {shop.city && (
                          <span className="ml-auto text-xs text-muted-foreground truncate max-w-16">{shop.city}</span>
                        )}
                        {shop.id === currentShop?.id && (
                          <span className="ml-1 text-xs text-primary">Active</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation — only for business users */}
        {!isAdmin && filteredNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredNavItems.map((item) => (
                  <SidebarMenuItem key={item.page}>
                    <SidebarMenuButton
                      isActive={currentPage === item.page}
                      onClick={() => setPage(item.page)}
                      tooltip={item.title}
                      aria-current={currentPage === item.page ? 'page' : undefined}
                    >
                      <item.icon className="size-4" aria-hidden="true" />
                      <span>{item.title}</span>
                      {item.moduleKey && activeModules.length > 0 && !activeModules.includes(item.moduleKey) && (
                        <Badge variant="outline" className="ml-auto text-[11px] px-1.5 py-0 text-amber-600 border-amber-300">Trial</Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* AI Features — only for business users */}
        {!isAdmin && filteredAiItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>AI Features</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAiItems.map((item) => (
                  <SidebarMenuItem key={item.page}>
                    <SidebarMenuButton
                      isActive={currentPage === item.page}
                      onClick={() => setPage(item.page)}
                      tooltip={item.title}
                      aria-current={currentPage === item.page ? 'page' : undefined}
                    >
                      <item.icon className="size-4" aria-hidden="true" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Modules - For org owners/managers */}
        {!isAdmin && currentOrgRole && (
          <SidebarGroup>
            <SidebarGroupLabel>Subscription</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentPage === 'modules'}
                    onClick={() => setPage('modules')}
                    tooltip="My Modules"
                  >
                    <Puzzle className="size-4" />
                    <span>My Modules</span>
                    {activeModules.length > 0 && (
                      <Badge variant="secondary" className="ml-auto text-[11px] px-1.5 py-0">
                        {activeModules.length}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Admin */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin Panel</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentPage === 'admin-dashboard'}
                    onClick={() => setPage('admin-dashboard')}
                    tooltip="Dashboard"
                  >
                    <Shield className="size-4" />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentPage === 'admin-organizations'}
                    onClick={() => setPage('admin-organizations')}
                    tooltip="Organizations"
                  >
                    <Building2 className="size-4" />
                    <span>Organizations</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentPage === 'admin-users'}
                    onClick={() => setPage('admin-users')}
                    tooltip="Users"
                  >
                    <UserCog className="size-4" />
                    <span>Users</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentPage === 'admin-modules'}
                    onClick={() => setPage('admin-modules')}
                    tooltip="Modules & Pricing"
                  >
                    <Cog className="size-4" />
                    <span>Modules & Pricing</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentPage === 'admin-sales-team'}
                    onClick={() => setPage('admin-sales-team')}
                    tooltip="Sales Team"
                  >
                    <Megaphone className="size-4" />
                    <span>Sales Team</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentPage === 'admin-regions'}
                    onClick={() => setPage('admin-regions')}
                    tooltip="Regions & Cities"
                  >
                    <Globe2 className="size-4" />
                    <span>Regions & Cities</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentPage === 'audit-log'}
                    onClick={() => setPage('audit-log')}
                    tooltip="Audit Log"
                  >
                    <ScrollText className="size-4" />
                    <span>Audit Log</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentPage === 'scheduled-reports'}
                    onClick={() => setPage('scheduled-reports')}
                    tooltip="Scheduled Reports"
                  >
                    <CalendarClock className="size-4" />
                    <span>Scheduled Reports</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentPage === 'admin-notifications'}
                    onClick={() => setPage('admin-notifications')}
                    tooltip="Notifications"
                  >
                    <Bell className="size-4" />
                    <span>Notifications</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Sales Rep */}
        {user?.role === 'sales_rep' && (
          <SidebarGroup>
            <SidebarGroupLabel>Sales</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentPage === 'sales-rep-dashboard'}
                    onClick={() => setPage('sales-rep-dashboard')}
                    tooltip="My Dashboard"
                  >
                    <UsersRound className="size-4" />
                    <span>My Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {/* Settings — business users only (admin should not see business settings) */}
          {!isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentPage === 'settings'}
                onClick={() => setPage('settings')}
                tooltip="Settings"
              >
                <Settings className="size-4" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarSeparator />
          {/* Language & Currency Switchers */}
          <SidebarMenuItem>
            <div className="flex flex-col gap-1">
              <LanguageSwitcher />
              <CurrencySwitcher />
            </div>
          </SidebarMenuItem>
          <SidebarSeparator />
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user?.name || 'User'}</span>
                    <span className="truncate text-xs text-muted-foreground">{user?.email || ''}</span>
                  </div>
                  <ChevronDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                side="top"
                align="start"
                sideOffset={4}
              >
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive" aria-label="Log out of your account">
                  <LogOut className="size-4 mr-2" aria-hidden="true" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

// ============================================
// Mobile Bottom Navigation
// ============================================
export function MobileBottomNav() {
  const { currentPage, setPage } = useAppStore()
  const { user, currentOrg, currentOrgRole, activeModules } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const [showMore, setShowMore] = useState(false)
  const morePanelRef = useRef<HTMLDivElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)

  const isService = currentOrg?.businessType === 'service'
  const isMixed = currentOrg?.businessType === 'mixed'
  const isManager = currentOrgRole === 'owner' || currentOrgRole === 'manager'
  const isAdmin = user?.role === 'admin'

  // Check if a module is accessible
  const isModuleActive = (moduleKey?: string): boolean => {
    if (!moduleKey) return true
    if (activeModules.length === 0) return true // Graceful degradation
    return activeModules.includes(moduleKey)
  }

  const mainTabs: Array<{ page: Page; icon: React.ElementType; label: string }> = isAdmin
    ? [
        { page: 'admin-dashboard', icon: Shield, label: 'Dashboard' },
        { page: 'admin-regions', icon: Globe2, label: 'Regions' },
        { page: 'admin-organizations', icon: Building2, label: 'Orgs' },
      ]
    : [
        { page: 'dashboard', icon: LayoutDashboard, label: 'Home' },
        ...(isService && !isMixed && isModuleActive('services')
          ? [{ page: 'services' as Page, icon: Wrench, label: 'Services' }]
          : isModuleActive('inventory')
            ? [{ page: 'products' as Page, icon: Package, label: 'Products' }]
            : []),
        ...(isModuleActive('sales') ? [{ page: 'sales' as Page, icon: ShoppingCart, label: 'Sales' }] : []),
      ]

  const moreItems: Array<{ page: Page; icon: React.ElementType; label: string }> = isAdmin
    ? [
        { page: 'admin-users' as Page, icon: UserCog, label: 'Users' },
        { page: 'admin-modules' as Page, icon: Cog, label: 'Modules' },
        { page: 'admin-sales-team' as Page, icon: Megaphone, label: 'Sales Team' },
        { page: 'admin-notifications' as Page, icon: Bell, label: 'Notify' },
      ]
    : [
        ...(isManager ? [{ page: 'branches' as Page, icon: GitBranch, label: 'Branches' }] : []),
        ...(isMixed && isModuleActive('services') ? [{ page: 'services' as Page, icon: Wrench, label: 'Services' }] : []),
        ...(isManager && isModuleActive('inventory') ? [{ page: 'inventory' as Page, icon: Warehouse, label: 'Inventory' }] : []),
        ...(isModuleActive('customers') ? [{ page: 'customers' as Page, icon: Users, label: 'Customers' }] : []),
        ...(isManager && isModuleActive('debts') ? [{ page: 'debts' as Page, icon: CreditCard, label: 'Debts' }] : []),
        ...(isManager && isModuleActive('reports') ? [{ page: 'reports' as Page, icon: BarChart3, label: 'Reports' }] : []),
        ...(isModuleActive('ai-assistant') ? [{ page: 'ai-assistant' as Page, icon: Bot, label: 'AI Chat' }] : []),
        { page: 'modules' as Page, icon: Puzzle, label: 'Modules' },
        { page: 'settings' as Page, icon: Settings, label: 'Settings' },
      ]

  const isMoreActive = !['dashboard', 'products', 'sales', 'services', 'admin-dashboard', 'admin-regions', 'admin-organizations'].includes(currentPage)

  // Focus trap for "More" panel (accessibility)
  const handleMoreKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowMore(false)
      moreButtonRef.current?.focus()
    }
  }, [])

  // Focus the more panel when it opens
  useEffect(() => {
    if (showMore && morePanelRef.current) {
      const firstButton = morePanelRef.current.querySelector<HTMLElement>('button')
      firstButton?.focus()
    }
  }, [showMore])

  return (
    <>
      {/* More Menu Overlay — ARIA dialog for accessibility */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => { setShowMore(false); moreButtonRef.current?.focus() }}
          onKeyDown={handleMoreKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label="More navigation options"
        >
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
          <div
            ref={morePanelRef}
            className="absolute bottom-14 left-0 right-0 bg-background border-t rounded-t-2xl shadow-2xl p-4 max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 id="more-panel-title" className="font-semibold text-sm">More Options</h3>
              <button
                onClick={() => { setShowMore(false); moreButtonRef.current?.focus() }}
                className="text-muted-foreground p-2 min-w-11 min-h-11 flex items-center justify-center"
                aria-label="Close more options"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3" role="list">
              {moreItems.map(item => (
                <button
                  key={item.page}
                  onClick={() => { setPage(item.page); setShowMore(false) }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors min-h-11 ${
                    currentPage === item.page
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                  role="listitem"
                  aria-label={item.label}
                  aria-current={currentPage === item.page ? 'page' : undefined}
                >
                  <item.icon className="size-5" aria-hidden="true" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              ))}
              {/* Theme toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors hover:bg-muted text-muted-foreground min-h-11"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                {theme === 'dark' ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
                <span className="text-xs font-medium">{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80" aria-label="Mobile navigation">
        <div className="flex items-center justify-around h-14 pb-[env(safe-area-inset-bottom)]">
          {mainTabs.map(tab => (
            <button
              key={tab.page}
              onClick={() => setPage(tab.page)}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full transition-colors min-h-11 ${
                currentPage === tab.page
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
              aria-label={tab.label}
              aria-current={currentPage === tab.page ? 'page' : undefined}
            >
              <tab.icon className="size-5" aria-hidden="true" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
          <button
            ref={moreButtonRef}
            onClick={() => setShowMore(true)}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full transition-colors min-h-11 ${
              isMoreActive
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
            aria-label="More options"
            aria-expanded={showMore}
            aria-haspopup="dialog"
          >
            <BarChart3 className="size-5" aria-hidden="true" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}

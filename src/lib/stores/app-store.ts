'use client'

import { create } from 'zustand'

export type Page =
  | 'dashboard'
  | 'products'
  | 'product-types'
  | 'inventory'
  | 'sales'
  | 'customers'
  | 'debts'
  | 'reports'
  | 'ai-inventory'
  | 'ai-assistant'
  | 'settings'
  | 'suppliers'
  | 'services'
  | 'branches'
  | 'admin-dashboard'
  | 'admin-organizations'
  | 'admin-users'
  | 'admin-modules'
  | 'admin-sales-team'
  | 'admin-notifications'
  | 'admin-regions'
  | 'sales-rep-dashboard'
  | 'modules'
  | 'setup'
  | 'profit-loss'
  | 'audit-log'
  | 'expenses'
  | 'stock-transfers'
  | 'purchase-orders'
  | 'loyalty'
  | 'credit-limits'
  | 'scheduled-reports'
  | 'smart-search'
  | 'price-optimization'
  | 'sales-forecast'
  | 'anomaly-detection'
  | 'sync-offline'
  | 'tax'

interface AppState {
  currentPage: Page
  sidebarOpen: boolean
  pageParams: Record<string, unknown>
  isNavigating: boolean
  previousPage: Page | null

  setPage: (page: Page, params?: Record<string, unknown>) => void
  /** Reset navigation to the default page — called on logout so the next
   *  session never starts on the previous user's page. */
  resetNavigation: () => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setNavigating: (navigating: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  sidebarOpen: true,
  pageParams: {},
  isNavigating: false,
  previousPage: null,

  setPage: (page: Page, params?: Record<string, unknown>) => {
    set((state) => ({
      previousPage: state.currentPage,
      currentPage: page,
      pageParams: params || {},
      isNavigating: true,
    }))
  },

  resetNavigation: () => {
    set({
      currentPage: 'dashboard',
      pageParams: {},
      previousPage: null,
      isNavigating: false,
    })
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }))
  },

  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open })
  },

  setNavigating: (navigating: boolean) => {
    set({ isNavigating: navigating })
  },
}))

// Page title mapping
export const pageTitles: Record<Page, string> = {
  'dashboard': 'Dashboard',
  'products': 'Products',
  'product-types': 'Product Types',
  'inventory': 'Inventory',
  'sales': 'Sales',
  'customers': 'Customers',
  'debts': 'Debts & Credits',
  'reports': 'Reports',
  'ai-inventory': 'AI Inventory',
  'ai-assistant': 'AI Assistant',
  'settings': 'Settings',
  'suppliers': 'Suppliers',
  'services': 'Services',
  'branches': 'Branches',
  'admin-dashboard': 'Admin Dashboard',
  'admin-organizations': 'Organizations',
  'admin-users': 'Users',
  'admin-modules': 'Modules & Pricing',
  'admin-sales-team': 'Sales Team',
  'admin-notifications': 'Notifications',
  'admin-regions': 'Regions & Cities',
  'sales-rep-dashboard': 'My Dashboard',
  'modules': 'My Modules',
  'setup': 'Supabase Setup',
  'profit-loss': 'Profit & Loss',
  'audit-log': 'Audit Log',
  'expenses': 'Expenses',
  'stock-transfers': 'Stock Transfers',
  'purchase-orders': 'Purchase Orders',
  'loyalty': 'Customer Loyalty',
  'credit-limits': 'Credit Limits',
  'scheduled-reports': 'Scheduled Reports',
  'smart-search': 'Smart Search',
  'price-optimization': 'Price Optimization',
  'sales-forecast': 'Sales Forecast',
  'anomaly-detection': 'Anomaly Detection',
  'sync-offline': 'Sync & Offline',
  'tax': 'Tax Assistant',
}

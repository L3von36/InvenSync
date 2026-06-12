'use client'

import { useEffect, useRef, Suspense, lazy } from 'react'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useAppStore, type Page, pageTitles } from '@/lib/stores/app-store'
import { AppSidebar, MobileBottomNav } from '@/components/app/layout/sidebar'
import { AppHeader } from '@/components/app/layout/header'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { GlobalErrorBoundary } from '@/components/shared/error-boundary'
import { ModuleGuard } from '@/components/shared/module-guard'
import { NavigationProgressBar, PageTransitionSkeleton } from '@/components/shared/loading'
import { CurrencyProvider } from '@/lib/currency-context'

// Lazy-load all page components
const DashboardPage = lazy(() => import('@/components/app/dashboard/dashboard-page').then(m => ({ default: m.DashboardPage })))
const InventoryPage = lazy(() => import('@/components/app/inventory/inventory-page').then(m => ({ default: m.InventoryPage })))
const SalesPage = lazy(() => import('@/components/app/sales/sales-page').then(m => ({ default: m.SalesPage })))
const ProductTypesPage = lazy(() => import('@/components/app/products/product-types-page').then(m => ({ default: m.ProductTypesPage })))
const ProductsPage = lazy(() => import('@/components/app/products/products-page').then(m => ({ default: m.ProductsPage })))
const DebtsPage = lazy(() => import('@/components/app/debts/debts-page').then(m => ({ default: m.DebtsPage })))
const ReportsPage = lazy(() => import('@/components/app/reports/reports-page').then(m => ({ default: m.ReportsPage })))
const SettingsPage = lazy(() => import('@/components/app/settings/settings-page').then(m => ({ default: m.SettingsPage })))
const CustomersPage = lazy(() => import('@/components/app/customers/customers-page').then(m => ({ default: m.CustomersPage })))
const SuppliersPage = lazy(() => import('@/components/app/suppliers/suppliers-page').then(m => ({ default: m.SuppliersPage })))
const AIInventoryPage = lazy(() => import('@/components/app/ai/ai-inventory-page').then(m => ({ default: m.AIInventoryPage })))
const AIAssistantPage = lazy(() => import('@/components/app/ai/ai-assistant-page').then(m => ({ default: m.AIAssistantPage })))
const ServicesPage = lazy(() => import('@/components/app/services/services-page').then(m => ({ default: m.ServicesPage })))
const BranchesPage = lazy(() => import('@/components/app/branches/branches-page').then(m => ({ default: m.BranchesPage })))
const AdminDashboardPage = lazy(() => import('@/components/app/admin/admin-dashboard-page').then(m => ({ default: m.AdminDashboardPage })))
const AdminOrganizationsPage = lazy(() => import('@/components/app/admin/admin-organizations-page').then(m => ({ default: m.AdminOrganizationsPage })))
const AdminUsersPage = lazy(() => import('@/components/app/admin/admin-users-page').then(m => ({ default: m.AdminUsersPage })))
const AdminModulesPage = lazy(() => import('@/components/app/admin/admin-modules-page').then(m => ({ default: m.AdminModulesPage })))
const AdminSalesTeamPage = lazy(() => import('@/components/app/admin/admin-sales-team-page').then(m => ({ default: m.AdminSalesTeamPage })))
const AdminNotificationsPage = lazy(() => import('@/components/app/admin/admin-notifications-page').then(m => ({ default: m.AdminNotificationsPage })))
const AdminRegionsPage = lazy(() => import('@/components/app/admin/admin-regions-page').then(m => ({ default: m.AdminRegionsPage })))
const SalesRepDashboardPage = lazy(() => import('@/components/app/sales-rep/sales-rep-dashboard-page').then(m => ({ default: m.SalesRepDashboardPage })))
const ModulesPage = lazy(() => import('@/components/app/modules/modules-page').then(m => ({ default: m.ModulesPage })))
const ProfitLossPage = lazy(() => import('@/components/app/analytics/profit-loss-page').then(m => ({ default: m.ProfitLossPage })))
const AuditLogPage = lazy(() => import('@/components/app/admin/admin-audit-log-page').then(m => ({ default: m.AuditLogPage })))
const ExpensesPage = lazy(() => import('@/components/app/expenses/expenses-page').then(m => ({ default: m.ExpensesPage })))
const StockTransfersPage = lazy(() => import('@/components/app/inventory/stock-transfers-page').then(m => ({ default: m.StockTransfersPage })))
const PurchaseOrdersPage = lazy(() => import('@/components/app/inventory/purchase-orders-page').then(m => ({ default: m.PurchaseOrdersPage })))
const LoyaltyPage = lazy(() => import('@/components/app/customers/loyalty-page').then(m => ({ default: m.LoyaltyPage })))
const CreditLimitsPage = lazy(() => import('@/components/app/customers/credit-limits-page').then(m => ({ default: m.CreditLimitsPage })))
const ScheduledReportsPage = lazy(() => import('@/components/app/reports/scheduled-reports-page').then(m => ({ default: m.ScheduledReportsPage })))
const SmartSearchPage = lazy(() => import('@/components/app/ai/smart-search-page').then(m => ({ default: m.SmartSearchPage })))
const PriceOptimizationPage = lazy(() => import('@/components/app/ai/price-optimization-page').then(m => ({ default: m.PriceOptimizationPage })))
const SalesForecastPage = lazy(() => import('@/components/app/ai/sales-forecast-page').then(m => ({ default: m.SalesForecastPage })))
const AnomalyDetectionPage = lazy(() => import('@/components/app/ai/anomaly-detection-page').then(m => ({ default: m.AnomalyDetectionPage })))

// ============================================
// Page Router
// ============================================
function PageContent() {
  const currentPage = useAppStore((s) => s.currentPage)
  const isNavigating = useAppStore((s) => s.isNavigating)
  const setNavigating = useAppStore((s) => s.setNavigating)
  const mainRef = useRef<HTMLElement>(null)

  // Safety timeout: auto-reset isNavigating after 2s to prevent stuck skeleton
  useEffect(() => {
    if (!isNavigating) return
    const timer = setTimeout(() => {
      setNavigating(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [isNavigating, setNavigating])

  // Screen reader announcement on page change + focus management
  useEffect(() => {
    // Announce page change to screen readers
    const title = pageTitles[currentPage] || 'Page'
    const liveRegion = document.getElementById('page-announcement')
    if (liveRegion) {
      liveRegion.textContent = `Navigated to ${title}`
    }
    // Move focus to main content area for keyboard users
    if (mainRef.current) {
      mainRef.current.focus({ preventScroll: true })
    }
  }, [currentPage])

  if (isNavigating) {
    return <PageTransitionSkeleton />
  }

  return (
    <main
      id="main-content"
      ref={mainRef}
      className="page-enter"
      key={currentPage}
      tabIndex={-1}
      role="main"
      aria-label={pageTitles[currentPage] || 'Main content'}
    >
      <Suspense fallback={<PageTransitionSkeleton />}>
        <PageRenderer page={currentPage} />
      </Suspense>
    </main>
  )
}

function PageRenderer({ page }: { page: Page }) {
  switch (page) {
    case 'dashboard':
      return <DashboardPage />
    case 'products':
      return <ModuleGuard moduleKey="inventory" moduleName="Products"><ProductsPage /></ModuleGuard>
    case 'product-types':
      return <ModuleGuard moduleKey="inventory" moduleName="Product Types"><ProductTypesPage /></ModuleGuard>
    case 'inventory':
      return <ModuleGuard moduleKey="inventory" moduleName="Inventory"><InventoryPage /></ModuleGuard>
    case 'sales':
      return <ModuleGuard moduleKey="sales" moduleName="Sales"><SalesPage /></ModuleGuard>
    case 'customers':
      return <ModuleGuard moduleKey="customers" moduleName="Customers"><CustomersPage /></ModuleGuard>
    case 'suppliers':
      return <ModuleGuard moduleKey="suppliers" moduleName="Suppliers"><SuppliersPage /></ModuleGuard>
    case 'debts':
      return <ModuleGuard moduleKey="debts" moduleName="Debts & Credits"><DebtsPage /></ModuleGuard>
    case 'reports':
      return <ModuleGuard moduleKey="reports" moduleName="Reports"><ReportsPage /></ModuleGuard>
    case 'ai-inventory':
      return <ModuleGuard moduleKey="ai-inventory" moduleName="AI Inventory"><AIInventoryPage /></ModuleGuard>
    case 'ai-assistant':
      return <ModuleGuard moduleKey="ai-assistant" moduleName="AI Assistant"><AIAssistantPage /></ModuleGuard>
    case 'settings':
      return <SettingsPage />
    case 'services':
      return <ModuleGuard moduleKey="services" moduleName="Services"><ServicesPage /></ModuleGuard>
    case 'branches':
      return <BranchesPage />
    case 'admin-dashboard':
      return <AdminDashboardPage />
    case 'admin-organizations':
      return <AdminOrganizationsPage />
    case 'admin-users':
      return <AdminUsersPage />
    case 'admin-modules':
      return <AdminModulesPage />
    case 'admin-sales-team':
      return <AdminSalesTeamPage />
    case 'admin-notifications':
      return <AdminNotificationsPage />
    case 'admin-regions':
      return <AdminRegionsPage />
    case 'sales-rep-dashboard':
      return <SalesRepDashboardPage />
    case 'modules':
      return <ModulesPage />
    case 'profit-loss':
      return <ProfitLossPage />
    case 'audit-log':
      return <AuditLogPage />
    case 'expenses':
      return <ExpensesPage />
    case 'stock-transfers':
      return <StockTransfersPage />
    case 'purchase-orders':
      return <PurchaseOrdersPage />
    case 'loyalty':
      return <LoyaltyPage />
    case 'credit-limits':
      return <CreditLimitsPage />
    case 'scheduled-reports':
      return <ScheduledReportsPage />
    case 'smart-search':
      return <SmartSearchPage />
    case 'price-optimization':
      return <ModuleGuard moduleKey="ai-inventory" moduleName="Price Optimization"><PriceOptimizationPage /></ModuleGuard>
    case 'sales-forecast':
      return <ModuleGuard moduleKey="ai-inventory" moduleName="Sales Forecast"><SalesForecastPage /></ModuleGuard>
    case 'anomaly-detection':
      return <ModuleGuard moduleKey="ai-inventory" moduleName="Anomaly Detection"><AnomalyDetectionPage /></ModuleGuard>
    default:
      return <DashboardPage />
  }
}

// ============================================
// App Shell (authenticated layout)
// ============================================
export default function AppShell() {
  const { user, currentOrg } = useAuthStore()
  const { currentPage, setPage } = useAppStore()

  // Redirect based on user role only once when the shell mounts
  useEffect(() => {
    if (user?.role === 'sales_rep' && currentPage === 'dashboard') {
      setPage('sales-rep-dashboard')
    } else if (user?.role === 'admin' && currentPage === 'dashboard') {
      setPage('admin-dashboard')
    }
    // Only run when user.role changes
  }, [user?.role, currentPage, setPage])

  return (
    <GlobalErrorBoundary>
      <CurrencyProvider baseCurrency={currentOrg?.currency || 'ETB'}>
        <NavigationProgressBar />
        {/* Skip-to-content link for keyboard users (WCAG 2.4.1) */}
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        {/* Screen reader live region for page change announcements */}
        <div id="page-announcement" role="status" aria-live="polite" className="sr-only" />
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <AppHeader />
            <div className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-auto">
              <GlobalErrorBoundary>
                <PageContent />
              </GlobalErrorBoundary>
            </div>
          </SidebarInset>
          <MobileBottomNav />
        </SidebarProvider>
      </CurrencyProvider>
    </GlobalErrorBoundary>
  )
}

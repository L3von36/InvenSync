'use client'

import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  TrendingUp,
  TrendingDown,
  Package,
  Warehouse as WarehouseIcon,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  Loader2,
  RefreshCw,
  ChevronRight,
  ShoppingCart,
  Users,
  Search,
  Plus,
  ArrowUpDown,
  Store,
  UserPlus,
  Phone,
  DollarSign,
  BarChart3,
  Box,
  AlertCircle,
  CheckCircle2,
  Clock,
  Calendar,
  Receipt,
  PiggyBank,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from '@/components/ui/recharts-exports'
import { api, type DashboardData, type InventoryStats, type Sale, type Product, type Debt, type Customer } from '@/lib/api-client'
import { getNetworkErrorMessage } from '@/lib/validation'
import { db } from '@/lib/db'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useAppStore } from '@/lib/stores/app-store'
import { SyncPanel } from '@/components/app/dashboard/sync-panel'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

// ============================================
// Extended Types
// ============================================

interface DashboardComparison {
  revenueChange: number
  expenseChange: number
  netProfitChange: number
  salesCountChange: number
  prevRevenue: number
  prevExpenses: number
  prevNetProfit: number
  prevSalesCount: number
}

interface DashboardPeriod {
  from: string
  to: string
  prevFrom: string
  prevTo: string
}

interface DashboardAnomaly {
  id: string
  type: 'out_of_stock' | 'critical_low' | 'large_expense'
  message: string
  severity: 'high' | 'medium' | 'low'
}

interface EnhancedDashboardData extends Omit<DashboardData, 'comparison' | 'period' | 'anomalies'> {
  comparison?: DashboardComparison
  period?: DashboardPeriod
  anomalies?: DashboardAnomaly[]
}

// ============================================
// Helpers
// ============================================

import { formatETB, formatNumber, formatDate, formatDateShort, formatTime } from '@/lib/format'

// ============================================
// Date Range Helpers
// ============================================

type DateRangePreset = 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'custom'

function getDateRange(preset: DateRangePreset): { from: string; to: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (preset) {
    case 'today':
      return { from: today.toISOString().split('T')[0], to: today.toISOString().split('T')[0] }
    case 'this_week': {
      const dayOfWeek = now.getDay()
      const weekStart = new Date(today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000)
      return { from: weekStart.toISOString().split('T')[0], to: today.toISOString().split('T')[0] }
    }
    case 'this_month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: monthStart.toISOString().split('T')[0], to: today.toISOString().split('T')[0] }
    }
    case 'this_quarter': {
      const quarter = Math.floor(now.getMonth() / 3)
      const quarterStart = new Date(now.getFullYear(), quarter * 3, 1)
      return { from: quarterStart.toISOString().split('T')[0], to: today.toISOString().split('T')[0] }
    }
    default:
      return { from: today.toISOString().split('T')[0], to: today.toISOString().split('T')[0] }
  }
}

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  this_quarter: 'This Quarter',
  custom: 'Custom Range',
}

// ============================================
// Chart configs
// ============================================

const revenueChartConfig = {
  revenue: {
    label: 'Revenue',
    color: '#ea580c',
  },
} satisfies ChartConfig

const topProductsChartConfig = {
  revenue: {
    label: 'Revenue',
    color: '#ea580c',
  },
} satisfies ChartConfig

const shopComparisonChartConfig = {
  revenue: {
    label: 'Revenue',
    color: '#ea580c',
  },
  products: {
    label: 'Products',
    color: '#0284c7',
  },
} satisfies ChartConfig

// ============================================
// Shared Components
// ============================================

interface StatCardProps {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  iconBgClass: string
  iconTextClass: string
  comparisonBadge?: React.ReactNode
}

const StatCard = memo(function StatCard({ title, value, subtitle, icon, iconBgClass, iconTextClass, comparisonBadge }: StatCardProps) {
  return (
    <Card className="gap-2 sm:gap-4">
      <CardHeader className="flex flex-row items-center justify-between pb-0 space-y-0">
        <CardDescription className="text-xs text-muted-foreground font-medium pr-1 line-clamp-1">{title}</CardDescription>
        <div className={`flex items-center justify-center size-7 sm:size-10 rounded-lg ${iconBgClass} shrink-0`}>
          <div className={`${iconTextClass} [&_svg]:size-3.5 sm:[&_svg]:size-5`}>{icon}</div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xl sm:text-2xl font-bold tracking-tight leading-tight whitespace-nowrap">{value}</div>
        <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
          <p className="text-xs text-muted-foreground line-clamp-1">{subtitle}</p>
          {comparisonBadge}
        </div>
      </CardContent>
    </Card>
  )
})

function StatCardSkeleton() {
  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row items-center justify-between pb-0">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-10 rounded-lg" />
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-8 w-36 mb-1" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  )
}

const ComparisonBadge = memo(function ComparisonBadge({ value, label }: { value: number; label?: string }) {
  if (value === 0) return null

  const isPositive = value > 0
  const isNegative = value < 0

  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 h-4 shrink-0 font-medium ${
        isPositive
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
          : isNegative
          ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
          : ''
      }`}
    >
      {isPositive ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
    </Badge>
  )
})

const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
          Completed
        </Badge>
      )
    case 'pending':
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
          Pending
        </Badge>
      )
    case 'cancelled':
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
          Cancelled
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
})

interface QuickActionCardProps {
  icon: React.ReactNode
  label: string
  iconBgClass: string
  iconTextClass: string
  onClick: () => void
  prominent?: boolean
}

function QuickActionCard({ icon, label, iconBgClass, iconTextClass, onClick, prominent }: QuickActionCardProps) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${prominent ? 'border-primary/30 bg-primary/5' : ''}`}
      onClick={onClick}
    >
      <CardContent className={`flex flex-col items-center justify-center gap-3 ${prominent ? 'py-10' : 'py-8'}`}>
        <div className={`flex items-center justify-center size-12 rounded-xl ${iconBgClass}`}>
          <div className={iconTextClass}>{icon}</div>
        </div>
        <span className={`font-medium text-sm ${prominent ? 'text-primary' : ''}`}>{label}</span>
      </CardContent>
    </Card>
  )
}

function DashboardHeader({ title, subtitle, isRefreshing, onRefresh, dateRangePicker, isOfflineData }: {
  title: string
  subtitle: string
  isRefreshing: boolean
  onRefresh: () => void
  dateRangePicker?: React.ReactNode
  isOfflineData?: boolean
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
          {isOfflineData && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
              Viewing cached data
            </div>
          )}
        </div>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {dateRangePicker}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`size-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  )
}

const RecentSalesList = memo(function RecentSalesList({ sales, onItemClick }: { sales: Sale[]; onItemClick?: (sale: Sale) => void }) {
  const { setPage } = useAppStore()
  const handleClick = (sale: Sale) => {
    if (onItemClick) {
      onItemClick(sale)
    } else {
      setPage('sales', { saleId: sale.id })
    }
  }

  if (sales.length === 0) {
    return (
      <EmptyState
        title="No sales recorded today"
        message="Start recording sales to see your data here."
        icon={<ShoppingCart className="size-7 text-muted-foreground" />}
        action={{ label: 'Record Sale', onClick: () => setPage('sales') }}
      />
    )
  }

  return (
    <div className="space-y-3">
      {sales.slice(0, 8).map((sale) => (
        <div
          key={sale.id}
          className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors rounded px-2 -mx-2"
          onClick={() => handleClick(sale)}
        >
          <div>
            <p className="text-sm font-medium">{sale.invoiceNumber}</p>
            <p className="text-xs text-muted-foreground">
              {sale.customer?.name || 'Walk-in'} · {formatDate(sale.saleDate)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{formatETB(sale.total)}</p>
            <StatusBadge status={sale.status} />
          </div>
        </div>
      ))}
    </div>
  )
})

// ============================================
// Date Range Picker
// ============================================

function DateRangePicker({
  selectedPreset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}: {
  selectedPreset: DateRangePreset
  onPresetChange: (preset: DateRangePreset) => void
  customFrom: string
  customTo: string
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <Calendar className="size-3.5" />
          {PRESET_LABELS[selectedPreset]}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="end">
        <div className="space-y-2">
          <p className="text-sm font-medium">Date Range</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(PRESET_LABELS) as DateRangePreset[]).map((preset) => (
              <Button
                key={preset}
                variant={selectedPreset === preset ? 'default' : 'outline'}
                size="sm"
                className="text-xs justify-start"
                onClick={() => {
                  if (preset !== 'custom') {
                    onPresetChange(preset)
                    setOpen(false)
                  } else {
                    onPresetChange(preset)
                  }
                }}
              >
                {PRESET_LABELS[preset]}
              </Button>
            ))}
          </div>
          {selectedPreset === 'custom' && (
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => onCustomFromChange(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => onCustomToChange(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                className="w-full text-xs"
                disabled={!customFrom || !customTo}
                onClick={() => setOpen(false)}
              >
                Apply
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ============================================
// Anomaly Alert Widget
// ============================================

const AnomalyAlertWidget = memo(function AnomalyAlertWidget({ anomalies }: { anomalies: DashboardAnomaly[] }) {
  const { setPage } = useAppStore()

  if (anomalies.length === 0) return null

  const highSeverity = anomalies.filter((a) => a.severity === 'high')
  const otherAnomalies = anomalies.filter((a) => a.severity !== 'high')

  return (
    <Card className="border-red-200 dark:border-red-900/50">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-8 rounded-lg bg-red-100 dark:bg-red-900/30">
            <Zap className="size-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <CardTitle className="text-sm">Anomaly Alerts</CardTitle>
            <CardDescription>
              {anomalies.length} alert{anomalies.length !== 1 ? 's' : ''} detected
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-1.5">
          {highSeverity.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {highSeverity.length} Critical
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
          {anomalies.map((anomaly) => (
            <div
              key={anomaly.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex items-center justify-center size-7 rounded-full shrink-0 ${
                    anomaly.severity === 'high'
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : anomaly.severity === 'medium'
                      ? 'bg-amber-100 dark:bg-amber-900/30'
                      : 'bg-sky-100 dark:bg-sky-900/30'
                  }`}
                >
                  {anomaly.severity === 'high' ? (
                    <AlertCircle
                      className={`size-3.5 ${
                        anomaly.severity === 'high'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    />
                  ) : (
                    <AlertTriangle
                      className={`size-3.5 ${
                        anomaly.severity === 'medium'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-sky-600 dark:text-sky-400'
                      }`}
                    />
                  )}
                </div>
                <p className="text-sm truncate">{anomaly.message}</p>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] shrink-0 ml-2 ${
                  anomaly.severity === 'high'
                    ? 'text-red-600 border-red-200 dark:text-red-400 dark:border-red-800'
                    : anomaly.severity === 'medium'
                    ? 'text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800'
                    : 'text-sky-600 border-sky-200 dark:text-sky-400 dark:border-sky-800'
                }`}
              >
                {anomaly.severity === 'high' ? 'Critical' : anomaly.severity === 'medium' ? 'Warning' : 'Info'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})

// ============================================
// LOADING / ERROR States
// ============================================

function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// DashboardError replaced by shared ErrorState component

// ============================================
// OWNER DASHBOARD — Multi-shop overview
// ============================================

interface ShopData {
  id: string
  name: string
  address?: string | null
  city?: string | null
  phone?: string | null
  isActive: boolean
  members: Array<{ id: string; userId: string; role: string; user: { id: string; name: string; email: string; avatarUrl?: string | null } }>
  _count: { products: number; sales: number }
}

function OwnerDashboard({
  dashboardData,
  inventoryData,
  revenueChartData,
  isRefreshing,
  onRefresh,
  dateRangePreset,
  onDateRangePresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  isOfflineData,
}: {
  dashboardData: EnhancedDashboardData
  inventoryData: InventoryStats | null
  revenueChartData: Array<{ date: string; revenue: number }>
  isRefreshing: boolean
  onRefresh: () => void
  dateRangePreset: DateRangePreset
  onDateRangePresetChange: (preset: DateRangePreset) => void
  customFrom: string
  customTo: string
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
  isOfflineData?: boolean
}) {
  const { currentOrg, currentShop } = useAuthStore()
  const { setPage } = useAppStore()
  const isMobile = useIsMobile()
  const [shops, setShops] = useState<ShopData[]>([])
  const [shopsLoading, setShopsLoading] = useState(true)

  useEffect(() => {
    if (!currentOrg) return
    api.getShops(currentOrg.id)
      .then(data => setShops(data.shops as unknown as ShopData[]))
      .catch(() => {
        setShops([])
      })
      .finally(() => setShopsLoading(false))
  }, [currentOrg])

  const { stats, recentSales, topProducts, comparison, anomalies } = dashboardData
  const lowStockProducts = inventoryData?.lowStockProducts || []
  const hasMultipleShops = shops.length > 1

  const topProductsChartData = [...topProducts]
    .slice(0, 5)
    .reverse()
    .map((p) => ({
      name: p.name.length > (isMobile ? 10 : 18) ? p.name.slice(0, isMobile ? 10 : 18) + '...' : p.name,
      revenue: p.totalRevenue,
    }))

  // Build shop comparison data
  const shopComparisonData = useMemo(() => {
    if (!hasMultipleShops) return []
    return shops.map(shop => ({
      name: shop.name.length > 12 ? shop.name.slice(0, 12) + '...' : shop.name,
      products: shop._count.products,
      members: shop.members.length,
    }))
  }, [shops, hasMultipleShops])

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Owner Dashboard"
        subtitle={hasMultipleShops ? `Overview across ${shops.length} shops` : 'Overview of your business performance and inventory'}
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
        isOfflineData={isOfflineData}
        dateRangePicker={
          <DateRangePicker
            selectedPreset={dateRangePreset}
            onPresetChange={onDateRangePresetChange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={onCustomFromChange}
            onCustomToChange={onCustomToChange}
          />
        }
      />

      {/* Anomaly Alerts */}
      {anomalies && anomalies.length > 0 && (
        <AnomalyAlertWidget anomalies={anomalies} />
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
        <StatCard
          title="Period Revenue"
          value={formatETB(stats.periodRevenue ?? stats.monthRevenue)}
          subtitle={`Today: ${formatETB(stats.todayRevenue)}`}
          icon={<TrendingUp className="size-5" />}
          iconBgClass="bg-brand-50 dark:bg-brand-900/20"
          iconTextClass="text-primary"
          comparisonBadge={comparison ? <ComparisonBadge value={comparison.revenueChange} /> : undefined}
        />
        <StatCard
          title="Total Products"
          value={formatNumber(stats.totalProducts)}
          subtitle={`${stats.outOfStockCount} out of stock`}
          icon={<Package className="size-5" />}
          iconBgClass="bg-sky-100 dark:bg-sky-900/30"
          iconTextClass="text-sky-600 dark:text-sky-400"
        />
        <StatCard
          title="Expenses"
          value={formatETB(stats.periodExpenses ?? 0)}
          subtitle="Period expenses"
          icon={<Receipt className="size-5" />}
          iconBgClass="bg-rose-100 dark:bg-rose-900/30"
          iconTextClass="text-rose-600 dark:text-rose-400"
          comparisonBadge={comparison ? <ComparisonBadge value={comparison.expenseChange} /> : undefined}
        />
        <StatCard
          title="Net Profit"
          value={formatETB(stats.periodNetProfit ?? 0)}
          subtitle={stats.periodNetProfit !== undefined && stats.periodNetProfit >= 0 ? 'Profitable' : 'Loss'}
          icon={<PiggyBank className="size-5" />}
          iconBgClass="bg-emerald-100 dark:bg-emerald-900/30"
          iconTextClass="text-emerald-600 dark:text-emerald-400"
          comparisonBadge={comparison ? <ComparisonBadge value={comparison.netProfitChange} /> : undefined}
        />
        <StatCard
          title="Active Shops"
          value={hasMultipleShops ? formatNumber(shops.filter(s => s.isActive).length) : '1'}
          subtitle={hasMultipleShops ? `${shops.length} total shops` : 'Single shop'}
          icon={<Store className="size-5" />}
          iconBgClass="bg-amber-100 dark:bg-amber-900/30"
          iconTextClass="text-amber-600 dark:text-amber-400"
        />
        <StatCard
          title="Customer Debts"
          value={formatETB(stats.totalCustomerDebt)}
          subtitle={stats.totalCustomerDebt > 0 ? 'Outstanding balance' : 'No outstanding debts'}
          icon={<CreditCard className="size-5" />}
          iconBgClass="bg-red-100 dark:bg-red-900/30"
          iconTextClass="text-red-600 dark:text-red-400"
        />
      </div>

      {/* Multi-shop comparison if applicable */}
      {hasMultipleShops && !shopsLoading && shopComparisonData.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm">Shop Comparison</CardTitle>
            <CardDescription>Product count per shop</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={shopComparisonChartConfig} className="h-[280px] w-full">
              <BarChart
                data={shopComparisonData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={12}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={12}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="products"
                  fill="#0284c7"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-shop cards if multiple shops */}
      {hasMultipleShops && !shopsLoading && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Your Shops</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shops.map(shop => (
              <Card key={shop.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{shop.name}</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {shop._count.products} products
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {shop.city || shop.address || 'No address'} · {shop.members.length} staff
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="size-3" />
                      {shop._count.products} products
                    </span>
                    <span className="flex items-center gap-1">
                      <ShoppingCart className="size-3" />
                      {shop._count.sales} sales
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 min-w-0">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm">Revenue Trend</CardTitle>
            <CardDescription>Daily revenue for the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig} className="h-[220px] sm:h-[300px] w-full">
              <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: isMobile ? -10 : 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ea580c" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" fontSize={isMobile ? 10 : 12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={isMobile ? 10 : 12}
                  width={isMobile ? 35 : 50}
                  tickFormatter={(value: number) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()}
                />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatETB(Number(value))} />} />
                <Area type="monotone" dataKey="revenue" stroke="#ea580c" fill="url(#fillRevenue)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Products by Revenue</CardTitle>
            <CardDescription>Best performing products in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {topProductsChartData.length > 0 ? (
              <ChartContainer config={topProductsChartConfig} className="h-[220px] sm:h-[300px] w-full">
                <BarChart data={topProductsChartData} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={isMobile ? 10 : 12}
                    tickFormatter={(value: number) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()}
                  />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={isMobile ? 60 : 120} fontSize={isMobile ? 9 : 12} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatETB(Number(value))} />} />
                  <Bar dataKey="revenue" fill="#ea580c" radius={[0, 4, 4, 0]} maxBarSize={32} />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyState
                title="No sales data yet"
                message="Start recording sales to see your top products."
                icon={<Package className="size-7 text-muted-foreground" />}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm">Recent Sales</CardTitle>
            <CardDescription>All shops aggregated — latest transactions</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPage('sales')} className="text-primary hover:text-primary/80 shrink-0">
            View All
            <ChevronRight className="size-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentSales.length > 0 ? (
            <>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSales.map((sale) => (
                      <TableRow key={sale.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setPage('sales', { saleId: sale.id })}>
                        <TableCell className="font-medium font-mono text-sm">{sale.invoiceNumber}</TableCell>
                        <TableCell>{sale.customer?.name || <span className="text-muted-foreground italic">Walk-in</span>}</TableCell>
                        <TableCell className="text-muted-foreground">{sale.items?.length || 0} item{(sale.items?.length || 0) !== 1 ? 's' : ''}</TableCell>
                        <TableCell className="font-semibold">{formatETB(sale.total)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(sale.saleDate)}</TableCell>
                        <TableCell><StatusBadge status={sale.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden space-y-3">
                {recentSales.map((sale) => (
                  <Card key={sale.id} className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setPage('sales', { saleId: sale.id })}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{sale.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">{sale.customer?.name || 'Walk-in'} · {sale.items?.length || 0} item{(sale.items?.length || 0) !== 1 ? 's' : ''}</p>
                      </div>
                      <StatusBadge status={sale.status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{formatDate(sale.saleDate)}</span>
                      <span className="font-bold text-sm">{formatETB(sale.total)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="No sales recorded yet"
              message="Start recording sales to see your data here."
              icon={<CreditCard className="size-7 text-muted-foreground" />}
              action={{ label: 'Record Sale', onClick: () => setPage('sales') }}
            />
          )}
        </CardContent>
      </Card>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-900/50">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <AlertTriangle className="size-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-sm">Low Stock Alert</CardTitle>
                <CardDescription>{lowStockProducts.length} product{lowStockProducts.length !== 1 ? 's' : ''} below threshold</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPage('inventory')} className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/20 shrink-0">
              View Inventory
              <ArrowRight className="size-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto custom-scrollbar">
              {lowStockProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50/50 dark:border-orange-900/30 dark:bg-orange-900/10">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">Threshold: {product.lowStockThreshold}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{product.quantity}</span>
                    <span className="text-xs text-muted-foreground">left</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================
// MANAGER DASHBOARD — Full analytics
// ============================================

function ManagerDashboard({
  dashboardData,
  inventoryData,
  revenueChartData,
  isRefreshing,
  onRefresh,
  dateRangePreset,
  onDateRangePresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  isOfflineData,
}: {
  dashboardData: EnhancedDashboardData
  inventoryData: InventoryStats | null
  revenueChartData: Array<{ date: string; revenue: number }>
  isRefreshing: boolean
  onRefresh: () => void
  dateRangePreset: DateRangePreset
  onDateRangePresetChange: (preset: DateRangePreset) => void
  customFrom: string
  customTo: string
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
  isOfflineData?: boolean
}) {
  const { setPage } = useAppStore()
  const isMobile = useIsMobile()
  const { stats, recentSales, topProducts, comparison, anomalies } = dashboardData
  const lowStockProducts = inventoryData?.lowStockProducts || []

  const topProductsChartData = [...topProducts]
    .slice(0, 5)
    .reverse()
    .map((p) => ({
      name: p.name.length > (isMobile ? 10 : 18) ? p.name.slice(0, isMobile ? 10 : 18) + '...' : p.name,
      revenue: p.totalRevenue,
    }))

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Dashboard"
        subtitle="Overview of your business performance and inventory"
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
        isOfflineData={isOfflineData}
        dateRangePicker={
          <DateRangePicker
            selectedPreset={dateRangePreset}
            onPresetChange={onDateRangePresetChange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={onCustomFromChange}
            onCustomToChange={onCustomToChange}
          />
        }
      />

      {/* Anomaly Alerts */}
      {anomalies && anomalies.length > 0 && (
        <AnomalyAlertWidget anomalies={anomalies} />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
        <StatCard
          title="Period Revenue"
          value={formatETB(stats.periodRevenue ?? stats.monthRevenue)}
          subtitle={`Today: ${formatETB(stats.todayRevenue)}`}
          icon={<TrendingUp className="size-5" />}
          iconBgClass="bg-brand-50 dark:bg-brand-900/20"
          iconTextClass="text-primary"
          comparisonBadge={comparison ? <ComparisonBadge value={comparison.revenueChange} /> : undefined}
        />
        <StatCard
          title="Total Products"
          value={formatNumber(stats.totalProducts)}
          subtitle={`${stats.outOfStockCount} out of stock`}
          icon={<Package className="size-5" />}
          iconBgClass="bg-sky-100 dark:bg-sky-900/30"
          iconTextClass="text-sky-600 dark:text-sky-400"
        />
        <StatCard
          title="Inventory Value"
          value={formatETB(stats.totalStockRetailValue)}
          subtitle={`Cost: ${formatETB(stats.totalStockCostValue)}`}
          icon={<WarehouseIcon className="size-5" />}
          iconBgClass="bg-amber-100 dark:bg-amber-900/30"
          iconTextClass="text-amber-600 dark:text-amber-400"
        />
        <StatCard
          title="Expenses"
          value={formatETB(stats.periodExpenses ?? 0)}
          subtitle="Period expenses"
          icon={<Receipt className="size-5" />}
          iconBgClass="bg-rose-100 dark:bg-rose-900/30"
          iconTextClass="text-rose-600 dark:text-rose-400"
          comparisonBadge={comparison ? <ComparisonBadge value={comparison.expenseChange} /> : undefined}
        />
        <StatCard
          title="Net Profit"
          value={formatETB(stats.periodNetProfit ?? 0)}
          subtitle={stats.periodNetProfit !== undefined && stats.periodNetProfit >= 0 ? 'Profitable' : 'Loss'}
          icon={<PiggyBank className="size-5" />}
          iconBgClass="bg-emerald-100 dark:bg-emerald-900/30"
          iconTextClass="text-emerald-600 dark:text-emerald-400"
          comparisonBadge={comparison ? <ComparisonBadge value={comparison.netProfitChange} /> : undefined}
        />
        <StatCard
          title="Customer Debts"
          value={formatETB(stats.totalCustomerDebt)}
          subtitle={stats.totalCustomerDebt > 0 ? 'Outstanding balance' : 'No outstanding debts'}
          icon={<CreditCard className="size-5" />}
          iconBgClass="bg-red-100 dark:bg-red-900/30"
          iconTextClass="text-red-600 dark:text-red-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 min-w-0">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm">Revenue Trend</CardTitle>
            <CardDescription>Daily revenue for the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig} className="h-[220px] sm:h-[300px] w-full">
              <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: isMobile ? -10 : 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillRevenueMgr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ea580c" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" fontSize={isMobile ? 10 : 12} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={isMobile ? 10 : 12} width={isMobile ? 35 : 50} tickFormatter={(value: number) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatETB(Number(value))} />} />
                <Area type="monotone" dataKey="revenue" stroke="#ea580c" fill="url(#fillRevenueMgr)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm">Top Products by Revenue</CardTitle>
            <CardDescription>Best performing products in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {topProductsChartData.length > 0 ? (
              <ChartContainer config={topProductsChartConfig} className="h-[220px] sm:h-[300px] w-full">
                <BarChart data={topProductsChartData} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} fontSize={isMobile ? 10 : 12} tickFormatter={(value: number) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={isMobile ? 60 : 120} fontSize={isMobile ? 9 : 12} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatETB(Number(value))} />} />
                  <Bar dataKey="revenue" fill="#ea580c" radius={[0, 4, 4, 0]} maxBarSize={32} />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyState
                title="No sales data yet"
                message="Start recording sales to see your top products."
                icon={<Package className="size-7 text-muted-foreground" />}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm">Recent Sales</CardTitle>
            <CardDescription>Latest transactions from your store</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPage('sales')} className="text-primary hover:text-primary/80 shrink-0">
            View All
            <ChevronRight className="size-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentSales.length > 0 ? (
            <>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSales.map((sale) => (
                      <TableRow key={sale.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setPage('sales', { saleId: sale.id })}>
                        <TableCell className="font-medium font-mono text-sm">{sale.invoiceNumber}</TableCell>
                        <TableCell>{sale.customer?.name || <span className="text-muted-foreground italic">Walk-in</span>}</TableCell>
                        <TableCell className="text-muted-foreground">{sale.items?.length || 0} item{(sale.items?.length || 0) !== 1 ? 's' : ''}</TableCell>
                        <TableCell className="font-semibold">{formatETB(sale.total)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(sale.saleDate)}</TableCell>
                        <TableCell><StatusBadge status={sale.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden space-y-3">
                {recentSales.map((sale) => (
                  <Card key={sale.id} className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setPage('sales', { saleId: sale.id })}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{sale.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">{sale.customer?.name || 'Walk-in'} · {sale.items?.length || 0} item{(sale.items?.length || 0) !== 1 ? 's' : ''}</p>
                      </div>
                      <StatusBadge status={sale.status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{formatDate(sale.saleDate)}</span>
                      <span className="font-bold text-sm">{formatETB(sale.total)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="No sales recorded yet"
              message="Start recording sales to see your data here."
              icon={<CreditCard className="size-7 text-muted-foreground" />}
              action={{ label: 'Record Sale', onClick: () => setPage('sales') }}
            />
          )}
        </CardContent>
      </Card>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-900/50">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <AlertTriangle className="size-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-sm">Low Stock Alert</CardTitle>
                <CardDescription>{lowStockProducts.length} product{lowStockProducts.length !== 1 ? 's' : ''} below threshold</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPage('inventory')} className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/20 shrink-0">
              View Inventory
              <ArrowRight className="size-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto custom-scrollbar">
              {lowStockProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50/50 dark:border-orange-900/30 dark:bg-orange-900/10">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">Threshold: {product.lowStockThreshold}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{product.quantity}</span>
                    <span className="text-xs text-muted-foreground">left</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================
// CASHIER DASHBOARD — Sales-focused
// ============================================

function CashierDashboard({
  dashboardData,
  isRefreshing,
  onRefresh,
  isOfflineData,
}: {
  dashboardData: EnhancedDashboardData
  isRefreshing: boolean
  onRefresh: () => void
  isOfflineData?: boolean
}) {
  const { setPage } = useAppStore()
  const { stats, recentSales } = dashboardData
  const isMobile = useIsMobile()
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const { currentOrg, currentShop } = useAuthStore()

  // Use server-provided today stats (accurate even when recentSales is capped at 10)
  const todaySalesCount = stats.todaySalesCount
  const todayRevenue = stats.todayRevenue
  const avgTransaction = todaySalesCount > 0 ? todayRevenue / todaySalesCount : 0

  // Product search
  useEffect(() => {
    if (!productSearch.trim() || !currentOrg) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const data = await api.getProducts(currentOrg.id, { search: productSearch, limit: 8, shopId: currentShop?.id })
        setSearchResults(data.products)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch, currentOrg, currentShop])

  return (
    <div className="space-y-6">
      <DashboardHeader title="Cashier Dashboard" subtitle="Record sales and manage transactions" isRefreshing={isRefreshing} onRefresh={onRefresh} isOfflineData={isOfflineData} />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickActionCard
          icon={<ShoppingCart className="size-6" />}
          label="Record Sale"
          iconBgClass="bg-primary/10"
          iconTextClass="text-primary"
          onClick={() => setPage('sales')}
          prominent
        />
        <QuickActionCard
          icon={<Search className="size-6" />}
          label="Search Product"
          iconBgClass="bg-sky-100 dark:bg-sky-900/30"
          iconTextClass="text-sky-600 dark:text-sky-400"
          onClick={() => document.getElementById('cashier-product-search')?.focus()}
        />
        <QuickActionCard
          icon={<Users className="size-6" />}
          label="Find Customer"
          iconBgClass="bg-emerald-100 dark:bg-emerald-900/30"
          iconTextClass="text-emerald-600 dark:text-emerald-400"
          onClick={() => setPage('customers')}
        />
      </div>

      {/* Quick Product Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Quick Product Search</CardTitle>
          <CardDescription>Find products by name, SKU, or category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="cashier-product-search"
              placeholder="Search products..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {isSearching && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isSearching && searchResults.length > 0 && (
            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {searchResults.map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.sku && <span className="font-mono">{product.sku} · </span>}
                      {product.productType?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 ml-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatETB(product.sellingPrice)}</p>
                      <p className={`text-xs ${product.quantity <= 0 ? 'text-red-500' : product.quantity <= product.lowStockThreshold ? 'text-amber-500' : 'text-muted-foreground'}`}>
                        {product.quantity} in stock
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isSearching && productSearch.trim() && searchResults.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">No products found</div>
          )}
        </CardContent>
      </Card>

      {/* Today's Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <StatCard
          title="Today's Sales"
          value={formatNumber(todaySalesCount)}
          subtitle="transactions"
          icon={<ShoppingCart className="size-5" />}
          iconBgClass="bg-brand-50 dark:bg-brand-900/20"
          iconTextClass="text-primary"
        />
        <StatCard
          title="Today's Revenue"
          value={formatETB(todayRevenue)}
          subtitle={`${recentSales.length} total recent`}
          icon={<DollarSign className="size-5" />}
          iconBgClass="bg-emerald-100 dark:bg-emerald-900/30"
          iconTextClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          title="Avg. Transaction"
          value={formatETB(avgTransaction)}
          subtitle="per sale today"
          icon={<BarChart3 className="size-5" />}
          iconBgClass="bg-sky-100 dark:bg-sky-900/30"
          iconTextClass="text-sky-600 dark:text-sky-400"
        />
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">Recent Sales</CardTitle>
            <CardDescription>Today&apos;s latest transactions</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPage('sales')} className="text-primary hover:text-primary/80">
            View All
            <ChevronRight className="size-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <RecentSalesList sales={recentSales} />
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// WAREHOUSE DASHBOARD — Inventory-focused
// ============================================

function WarehouseDashboard({
  dashboardData,
  inventoryData,
  isRefreshing,
  onRefresh,
  isOfflineData,
}: {
  dashboardData: EnhancedDashboardData
  inventoryData: InventoryStats | null
  isRefreshing: boolean
  onRefresh: () => void
  isOfflineData?: boolean
}) {
  const { setPage } = useAppStore()
  const { currentOrg, currentShop } = useAuthStore()
  const { stats } = dashboardData
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const overview = inventoryData?.overview
  const lowStockProducts = inventoryData?.lowStockProducts || []
  const recentMovements = inventoryData?.recentMovements || []

  // Product search
  useEffect(() => {
    if (!productSearch.trim() || !currentOrg) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const data = await api.getProducts(currentOrg.id, { search: productSearch, limit: 8, shopId: currentShop?.id })
        setSearchResults(data.products)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch, currentOrg, currentShop])

  return (
    <div className="space-y-6">
      <DashboardHeader title="Warehouse Dashboard" subtitle="Manage inventory and stock levels" isRefreshing={isRefreshing} onRefresh={onRefresh} isOfflineData={isOfflineData} />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickActionCard
          icon={<Plus className="size-6" />}
          label="Add Stock"
          iconBgClass="bg-primary/10"
          iconTextClass="text-primary"
          onClick={() => setPage('inventory')}
          prominent
        />
        <QuickActionCard
          icon={<Search className="size-6" />}
          label="Check Product"
          iconBgClass="bg-sky-100 dark:bg-sky-900/30"
          iconTextClass="text-sky-600 dark:text-sky-400"
          onClick={() => document.getElementById('warehouse-product-search')?.focus()}
        />
        <QuickActionCard
          icon={<ArrowUpDown className="size-6" />}
          label="Stock Movement"
          iconBgClass="bg-amber-100 dark:bg-amber-900/30"
          iconTextClass="text-amber-600 dark:text-amber-400"
          onClick={() => setPage('inventory')}
        />
      </div>

      {/* Product Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Product Search</CardTitle>
          <CardDescription>Find products by name, SKU, or category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="warehouse-product-search"
              placeholder="Search products..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {isSearching && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isSearching && searchResults.length > 0 && (
            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {searchResults.map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.sku && <span className="font-mono">{product.sku} · </span>}
                      Cost: {formatETB(product.costPrice)} · Sell: {formatETB(product.sellingPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 ml-3 shrink-0">
                    <div className="text-right">
                      <p className={`text-sm font-bold ${product.quantity <= 0 ? 'text-red-600 dark:text-red-400' : product.quantity <= product.lowStockThreshold ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {product.quantity}
                      </p>
                      <p className="text-xs text-muted-foreground">qty</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isSearching && productSearch.trim() && searchResults.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">No products found</div>
          )}
        </CardContent>
      </Card>

      {/* Stock Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          title="Total Products"
          value={formatNumber(overview?.totalProducts || stats.totalProducts)}
          subtitle={`${overview?.outOfStock || stats.outOfStockCount} out of stock`}
          icon={<Package className="size-5" />}
          iconBgClass="bg-sky-100 dark:bg-sky-900/30"
          iconTextClass="text-sky-600 dark:text-sky-400"
        />
        <StatCard
          title="Out of Stock"
          value={formatNumber(overview?.outOfStock || stats.outOfStockCount)}
          subtitle="need restocking"
          icon={<AlertCircle className="size-5" />}
          iconBgClass="bg-red-100 dark:bg-red-900/30"
          iconTextClass="text-red-600 dark:text-red-400"
        />
        <StatCard
          title="Low Stock"
          value={formatNumber(overview?.lowStock || stats.lowStockCount)}
          subtitle="below threshold"
          icon={<AlertTriangle className="size-5" />}
          iconBgClass="bg-amber-100 dark:bg-amber-900/30"
          iconTextClass="text-amber-600 dark:text-amber-400"
        />
        <StatCard
          title="Inventory Value"
          value={formatETB(overview?.totalRetailValue || stats.totalStockRetailValue)}
          subtitle={`Cost: ${formatETB(overview?.totalCostValue || stats.totalStockCostValue)}`}
          icon={<WarehouseIcon className="size-5" />}
          iconBgClass="bg-brand-50 dark:bg-brand-900/20"
          iconTextClass="text-primary"
        />
      </div>

      {/* Low Stock Alerts — Prominent */}
      {lowStockProducts.length > 0 && (
        <Card className="border-red-200 dark:border-red-900/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle className="text-sm">Low Stock Alerts</CardTitle>
                <CardDescription>{lowStockProducts.length} product{lowStockProducts.length !== 1 ? 's' : ''} need attention</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {lowStockProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.productType.name} · Threshold: {product.lowStockThreshold}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <Badge variant="destructive" className="text-xs font-bold">
                      {product.quantity} left
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Stock Movements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">Recent Stock Movements</CardTitle>
            <CardDescription>Latest inventory changes</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPage('inventory')} className="text-primary hover:text-primary/80">
            View All
            <ChevronRight className="size-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentMovements.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
              {recentMovements.slice(0, 10).map((movement) => {
                const typeIcon = movement.type === 'in'
                  ? <ArrowUpDown className="size-4 text-emerald-600 dark:text-emerald-400" />
                  : movement.type === 'out'
                  ? <ArrowUpDown className="size-4 text-red-600 dark:text-red-400 rotate-180" />
                  : <ArrowUpDown className="size-4 text-amber-600 dark:text-amber-400" />
                const typeLabel = movement.type === 'in' ? 'Stock In' : movement.type === 'out' ? 'Stock Out' : 'Adjustment'
                const qtyColor = movement.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : movement.type === 'out' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'

                return (
                  <div key={movement.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center size-8 rounded-lg bg-muted">
                        {typeIcon}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{movement.product?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {typeLabel} · {formatDate(movement.createdAt)} {formatTime(movement.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${qtyColor}`}>
                        {movement.type === 'in' ? '+' : movement.type === 'out' ? '-' : '~'}{movement.quantity}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {movement.previousStock} → {movement.newStock}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Box className="size-10 mb-2 opacity-50" />
              <p className="text-sm">No stock movements yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// SALES DASHBOARD — Sales + Customer Relationships
// ============================================

function SalesDashboard({
  dashboardData,
  isRefreshing,
  onRefresh,
  isOfflineData,
}: {
  dashboardData: EnhancedDashboardData
  isRefreshing: boolean
  onRefresh: () => void
  isOfflineData?: boolean
}) {
  const { setPage } = useAppStore()
  const { currentOrg, currentShop } = useAuthStore()
  const { stats, recentSales } = dashboardData
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([])
  const [outstandingDebts, setOutstandingDebts] = useState<Debt[]>([])

  // Fetch customers and debts
  useEffect(() => {
    if (!currentOrg) return
    Promise.all([
      api.getCustomers(currentOrg.id, { limit: 5, shopId: currentShop?.id }).catch(() => ({ customers: [] })),
      api.getDebts(currentOrg.id, { status: 'pending', limit: 5, shopId: currentShop?.id }).catch(() => ({ debts: [], summary: { totalCustomerDebt: 0, totalSupplierDebt: 0, totalOutstanding: 0 } })),
    ]).then(([customersData, debtsData]) => {
      setRecentCustomers(customersData.customers)
      setOutstandingDebts(debtsData.debts)
    })
  }, [currentOrg, currentShop])

  // Today's sales (use server-provided stats for accuracy)
  const todaySalesCount = stats.todaySalesCount
  const todayRevenue = stats.todayRevenue

  return (
    <div className="space-y-6">
      <DashboardHeader title="Sales Dashboard" subtitle="Track sales and manage customer relationships" isRefreshing={isRefreshing} onRefresh={onRefresh} isOfflineData={isOfflineData} />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickActionCard
          icon={<ShoppingCart className="size-6" />}
          label="Record Sale"
          iconBgClass="bg-primary/10"
          iconTextClass="text-primary"
          onClick={() => setPage('sales')}
          prominent
        />
        <QuickActionCard
          icon={<UserPlus className="size-6" />}
          label="New Customer"
          iconBgClass="bg-emerald-100 dark:bg-emerald-900/30"
          iconTextClass="text-emerald-600 dark:text-emerald-400"
          onClick={() => setPage('customers')}
        />
        <QuickActionCard
          icon={<Phone className="size-6" />}
          label="Follow Up Debt"
          iconBgClass="bg-red-100 dark:bg-red-900/30"
          iconTextClass="text-red-600 dark:text-red-400"
          onClick={() => setPage('debts')}
        />
      </div>

      {/* Sales Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          title="Today's Sales"
          value={formatNumber(todaySalesCount)}
          subtitle="transactions today"
          icon={<ShoppingCart className="size-5" />}
          iconBgClass="bg-brand-50 dark:bg-brand-900/20"
          iconTextClass="text-primary"
        />
        <StatCard
          title="Today's Revenue"
          value={formatETB(todayRevenue)}
          subtitle="total today"
          icon={<DollarSign className="size-5" />}
          iconBgClass="bg-emerald-100 dark:bg-emerald-900/30"
          iconTextClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          title="Month Revenue"
          value={formatETB(stats.monthRevenue)}
          subtitle="this month"
          icon={<TrendingUp className="size-5" />}
          iconBgClass="bg-sky-100 dark:bg-sky-900/30"
          iconTextClass="text-sky-600 dark:text-sky-400"
        />
        <StatCard
          title="Customer Debts"
          value={formatETB(stats.totalCustomerDebt)}
          subtitle="outstanding"
          icon={<CreditCard className="size-5" />}
          iconBgClass="bg-red-100 dark:bg-red-900/30"
          iconTextClass="text-red-600 dark:text-red-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Outstanding Debts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">Outstanding Debts</CardTitle>
              <CardDescription>Follow up on pending payments</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPage('debts')} className="text-primary hover:text-primary/80">
              View All
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {outstandingDebts.length > 0 ? (
              <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
                {outstandingDebts.map((debt) => {
                  const remaining = debt.amount - debt.paidAmount
                  return (
                    <div key={debt.id} className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors rounded px-2 -mx-2" onClick={() => setPage('debts')}>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center size-8 rounded-lg bg-red-100 dark:bg-red-900/30">
                          <CreditCard className="size-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{debt.customer?.name || debt.supplier?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">
                            {debt.dueDate ? `Due: ${formatDateShort(debt.dueDate)}` : 'No due date'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">{formatETB(remaining)}</p>
                        <p className="text-xs text-muted-foreground">of {formatETB(debt.amount)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="size-8 mb-2 text-emerald-500" />
                <p className="text-sm">All debts are settled!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Customers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">Recent Customers</CardTitle>
              <CardDescription>Latest customer activity</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPage('customers')} className="text-primary hover:text-primary/80">
              View All
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentCustomers.length > 0 ? (
              <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
                {recentCustomers.map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors rounded px-2 -mx-2" onClick={() => setPage('customers')}>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center size-8 rounded-full bg-muted text-muted-foreground font-semibold text-sm">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {customer.phone || customer.email || 'No contact info'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {customer._count?.sales || 0} sale{(customer._count?.sales || 0) !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {customer._count?.debts || 0} debt{(customer._count?.debts || 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No customers yet"
                message="Add your first customer to start tracking."
                icon={<Users className="size-7 text-muted-foreground" />}
                action={{ label: 'Add Customer', onClick: () => setPage('customers') }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">Recent Sales</CardTitle>
            <CardDescription>Your latest transactions</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPage('sales')} className="text-primary hover:text-primary/80">
            View All
            <ChevronRight className="size-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <RecentSalesList sales={recentSales} />
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// MAIN Dashboard Page
// ============================================

export function DashboardPage() {
  const { currentOrg, currentOrgRole, shopRole, currentShop } = useAuthStore()
  const { setPage } = useAppStore()

  const [dashboardData, setDashboardData] = useState<EnhancedDashboardData | null>(null)
  const [inventoryData, setInventoryData] = useState<InventoryStats | null>(null)
  const [revenueChartData, setRevenueChartData] = useState<Array<{ date: string; revenue: number }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isOfflineData, setIsOfflineData] = useState(false)

  // Date range state
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const fetchDashboardData = useCallback(async () => {
    if (!currentOrg) return

    try {
      setIsRefreshing(true)
      setError(null)

      // Determine date range
      const range = dateRangePreset === 'custom' && customFrom && customTo
        ? { from: customFrom, to: customTo }
        : getDateRange(dateRangePreset)

      // Use allSettled to handle partial data loads gracefully
      const results = await Promise.allSettled([
        api.getDashboard(currentOrg.id, currentShop?.id, range.from, range.to),
        api.getInventory(currentOrg.id, currentShop?.id),
        api.getReports(currentOrg.id, {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          period: 'daily',
          shopId: currentShop?.id,
        }),
      ])

      // Process dashboard data (critical - if this fails, fall back to local DB)
      if (results[0].status === 'fulfilled') {
        setDashboardData(results[0].value as EnhancedDashboardData)
        setIsOfflineData(false)
      } else {
        // API call failed — try computing dashboard data from local IndexedDB
        try {
          const shopId = currentShop?.id

          const localProducts = await db.products
            .where('organizationId').equals(currentOrg.id)
            .filter(p => !shopId || p.shopId === shopId || !p.shopId)
            .toArray()

          const localSales = await db.sales
            .where('organizationId').equals(currentOrg.id)
            .filter(s => !shopId || s.shopId === shopId || !s.shopId)
            .toArray()

          const localDebts = await db.debts
            .where('organizationId').equals(currentOrg.id)
            .filter(d => !shopId || d.shopId === shopId || !d.shopId)
            .toArray()

          const localExpenses = await db.expenses
            .where('organizationId').equals(currentOrg.id)
            .filter(e => !shopId || e.shopId === shopId || !e.shopId)
            .toArray()

          // Compute dashboard data from local records
          const now = new Date()
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

          const todaySales = localSales.filter(s => s.saleDate >= todayStart && s.status === 'completed')
          const monthSales = localSales.filter(s => s.saleDate >= monthStart && s.status === 'completed')

          const outOfStock = localProducts.filter(p => p.quantity <= 0)
          const lowStock = localProducts.filter(p => p.quantity > 0 && p.quantity <= p.lowStockThreshold)

          const totalStockCostValue = localProducts.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0)
          const totalStockRetailValue = localProducts.reduce((sum, p) => sum + (p.sellingPrice * p.quantity), 0)

          const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0)
          const monthRevenue = monthSales.reduce((sum, s) => sum + s.total, 0)

          const totalCustomerDebt = localDebts
            .filter(d => d.type === 'customer_debt' && d.status !== 'paid')
            .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)

          const periodExpenses = localExpenses
            .filter(e => e.date >= monthStart)
            .reduce((sum, e) => sum + e.amount, 0)

          const fallbackDashboardData: EnhancedDashboardData = {
            stats: {
              totalProducts: localProducts.length,
              outOfStockCount: outOfStock.length,
              lowStockCount: lowStock.length,
              totalStockCostValue,
              totalStockRetailValue,
              todayRevenue,
              todaySalesCount: todaySales.length,
              monthRevenue,
              totalCustomerDebt,
              periodRevenue: monthRevenue,
              periodExpenses,
              periodCogs: 0, // Can't compute easily from local data
              periodNetProfit: monthRevenue - periodExpenses,
              periodSalesCount: monthSales.length,
            },
            comparison: {
              revenueChange: 0, expenseChange: 0, netProfitChange: 0, salesCountChange: 0,
              prevRevenue: 0, prevExpenses: 0, prevNetProfit: 0, prevSalesCount: 0,
            },
            period: {
              from: range.from,
              to: range.to,
              prevFrom: '', prevTo: '',
            },
            anomalies: [
              ...outOfStock.slice(0, 3).map(p => ({
                id: p.id, type: 'out_of_stock' as const, message: `${p.name} is out of stock`, severity: 'high' as const,
              })),
              ...lowStock.slice(0, 3).map(p => ({
                id: p.id, type: 'low_stock' as const, message: `${p.name} is low on stock (${p.quantity} left)`, severity: 'medium' as const,
              })),
            ],
            recentSales: localSales
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 10)
              .map(s => ({
                id: s.id, organizationId: s.organizationId, customerId: s.customerId,
                invoiceNumber: s.invoiceNumber, status: s.status, paymentMethod: s.paymentMethod,
                subtotal: s.subtotal, discount: s.discount, tax: s.tax, total: s.total,
                amountPaid: s.amountPaid, notes: s.notes, saleDate: s.saleDate,
                createdAt: s.createdAt, updatedAt: s.updatedAt,
                customer: null, items: undefined,
              })),
            topProducts: [], // Would need saleItems to compute
            salesTrend: [], // Would need daily aggregation
          }

          setDashboardData(fallbackDashboardData)
          setIsOfflineData(true)
          setError(null)

          // Also set inventory data from local products
          setInventoryData({
            overview: {
              totalProducts: localProducts.length,
              outOfStock: outOfStock.length,
              lowStock: lowStock.length,
              totalCostValue: totalStockCostValue,
              totalRetailValue: totalStockRetailValue,
            },
            lowStockProducts: lowStock.slice(0, 10).map(p => ({
              id: p.id, name: p.name, quantity: p.quantity,
              lowStockThreshold: p.lowStockThreshold, costPrice: p.costPrice,
              sellingPrice: p.sellingPrice, productType: { id: p.productTypeId, name: '—' },
            })),
            recentMovements: [],
          })
          setRevenueChartData([])
          return
        } catch {
          // Local DB also failed — show error
          setError(getNetworkErrorMessage(results[0].reason))
          return
        }
      }

      // Process inventory data (non-critical - show dashboard without it)
      if (results[1].status === 'fulfilled') {
        setInventoryData(results[1].value)
      } else {
        setInventoryData(null)
      }

      // Process reports data (non-critical - show empty chart)
      if (results[2].status === 'fulfilled') {
        const reports = results[2].value
        const salesByDate = (reports as { salesByPeriod?: Array<{ period: string; revenue: number }> }).salesByPeriod || []
        const salesMap = new Map(salesByDate.map((s) => [s.period, s.revenue]))
        const chartData: Array<{ date: string; revenue: number }> = []
        for (let i = 29; i >= 0; i--) {
          const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
          const dateKey = d.toISOString().split('T')[0]
          chartData.push({
            date: formatDateShort(dateKey),
            revenue: salesMap.get(dateKey) || 0,
          })
        }
        setRevenueChartData(chartData)
      } else {
        setRevenueChartData([])
      }
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [currentOrg, currentShop, dateRangePreset, customFrom, customTo])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // Determine which dashboard to show
  const dashboardType = useMemo(() => {
    if (currentOrgRole === 'owner') return 'owner'
    if (currentOrgRole === 'manager') return 'manager'
    if (currentOrgRole === 'employee') {
      // Use shop role for employees
      if (shopRole === 'warehouse') return 'warehouse'
      if (shopRole === 'sales') return 'sales'
      if (shopRole === 'manager') return 'manager' // shop-level manager
      // Default: cashier (includes 'cashier' and null)
      return 'cashier'
    }
    // Fallback
    return 'cashier'
  }, [currentOrgRole, shopRole])

  // Loading State
  if (isLoading) {
    return <DashboardLoading />
  }

  // Error State
  if (error) {
    return <ErrorState title="Failed to load dashboard" message={error} onRetry={fetchDashboardData} />
  }

  if (!dashboardData) return null

  // Shared props for dashboards that use date range
  const dateRangeProps = {
    dateRangePreset,
    onDateRangePresetChange: setDateRangePreset,
    customFrom,
    customTo,
    onCustomFromChange: setCustomFrom,
    onCustomToChange: setCustomTo,
  }

  // Render the Sync & Offline panel at the bottom of the dashboard
  const syncPanel = <SyncPanel defaultOpen={false} />

  // Render appropriate dashboard based on role
  switch (dashboardType) {
    case 'owner':
      return (
        <>
          <OwnerDashboard
            dashboardData={dashboardData}
            inventoryData={inventoryData}
            revenueChartData={revenueChartData}
            isRefreshing={isRefreshing}
            onRefresh={fetchDashboardData}
            isOfflineData={isOfflineData}
            {...dateRangeProps}
          />
          {syncPanel}
        </>
      )
    case 'manager':
      return (
        <>
          <ManagerDashboard
            dashboardData={dashboardData}
            inventoryData={inventoryData}
            revenueChartData={revenueChartData}
            isRefreshing={isRefreshing}
            onRefresh={fetchDashboardData}
            isOfflineData={isOfflineData}
            {...dateRangeProps}
          />
          {syncPanel}
        </>
      )
    case 'cashier':
      return (
        <>
          <CashierDashboard
            dashboardData={dashboardData}
            isRefreshing={isRefreshing}
            onRefresh={fetchDashboardData}
            isOfflineData={isOfflineData}
          />
          {syncPanel}
        </>
      )
    case 'warehouse':
      return (
        <>
          <WarehouseDashboard
            dashboardData={dashboardData}
            inventoryData={inventoryData}
            isRefreshing={isRefreshing}
            onRefresh={fetchDashboardData}
            isOfflineData={isOfflineData}
          />
          {syncPanel}
        </>
      )
    case 'sales':
      return (
        <>
          <SalesDashboard
            dashboardData={dashboardData}
            isRefreshing={isRefreshing}
            onRefresh={fetchDashboardData}
            isOfflineData={isOfflineData}
          />
          {syncPanel}
        </>
      )
    default:
      return (
        <>
          <CashierDashboard
            dashboardData={dashboardData}
            isRefreshing={isRefreshing}
            onRefresh={fetchDashboardData}
            isOfflineData={isOfflineData}
          />
          {syncPanel}
        </>
      )
  }
}

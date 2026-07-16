'use client'

import { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import {
  Building2, Users, DollarSign, Package, MapPin, Search,
  TrendingUp, ShoppingCart, AlertTriangle,
  BarChart3, Globe2, Store, Flame, ChevronRight,
  Activity, Database, Zap, Clock, Server, CheckCircle2,
  AlertCircle, Megaphone, RefreshCw, ShieldCheck,
  ArrowDownUp, ArrowUpRight, ArrowDownRight,
  LayoutDashboard, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  api,
  type AdminDashboardData,
  type ShopData,
  type MarketInsightsData,
  type SystemHealthData,
  type RegionData,
  type Pagination,
} from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useAppStore } from '@/lib/stores/app-store'
import { getNetworkErrorMessage } from '@/lib/validation'
import {
  formatETB,
  CHART_COLORS,
  formatDateWithTime,
} from '@/lib/admin-utils'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import {
  PageHeader,
  StatCard,
  StatCardSkeleton,
  SectionCard,
  FilterChips,
} from '@/components/shared/design-system'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { swrFetch, invalidateKey } from '@/lib/client-cache'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from '@/components/ui/recharts-exports'

// ============================================
// Lazy-loaded Map Component
// ============================================
const LazyShopsMap = lazy(() =>
  import('./shops-map-component').then(mod => ({ default: mod.ShopsMapComponent }))
)

function MapSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-[23rem] md:h-[34rem] w-full rounded-lg" />
      <div className="flex gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  )
}

// ============================================
// Comparison Badge Helper (design-system compliant)
// ============================================
function ComparisonBadge({ value, label }: { value: number; label: string }) {
  if (value === 0) return null
  const isUp = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[0.769rem] font-medium px-1.5 py-0.5 rounded-full ${
      isUp
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        : 'bg-red-500/10 text-red-600 dark:text-red-400'
    }`}>
      {isUp ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ============================================
// Overview Tab
// ============================================
function OverviewTab({ data }: { data: AdminDashboardData }) {
  const isMobile = useIsMobile()

  const revenueSparkline = data.revenueByMonth?.map(d => d.revenue) || []
  const totalSubs = Object.values(data.activeSubscriptions).reduce<number>((a, b) => a + (b as number), 0)

  // Business type pie data
  const businessTypeData = Object.entries(data.organizationsByBusinessType || {}).map(
    ([type, count]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '),
      count,
    })
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ===== Row 1: Primary KPIs (2-up mobile, 4-up desktop) ===== */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {/* THE brand card — the single most important metric on this screen */}
        <StatCard
          title="This Month Revenue"
          value={formatETB(data.thisMonthRevenue)}
          icon={<DollarSign />}
          tone="brand"
          subtitle="Platform-wide"
          sparkline={revenueSparkline}
          comparisonBadge={<ComparisonBadge value={data.revenueChange} label="vs last month" />}
        />
        {/* Net profit — conditional tone: success when positive, danger when negative */}
        <StatCard
          title="Net Profit"
          value={formatETB(data.thisMonthNetProfit)}
          icon={<TrendingUp />}
          tone={data.thisMonthNetProfit >= 0 ? 'success' : 'danger'}
          subtitle={`Expenses: ${formatETB(data.thisMonthExpenses)}`}
          comparisonBadge={<ComparisonBadge value={data.revenueChange} label="trend" />}
        />
        {/* Sales count — neutral, informational */}
        <StatCard
          title="Sales This Month"
          value={data.thisMonthSalesCount.toLocaleString()}
          icon={<ShoppingCart />}
          tone="neutral"
          subtitle={`${data.lastMonthSalesCount.toLocaleString()} last month`}
          comparisonBadge={<ComparisonBadge value={data.salesCountChange} label="vs last month" />}
        />
        {/* Pending debt — conditional: danger if > 0, neutral otherwise */}
        <StatCard
          title="Outstanding Debts"
          value={formatETB(data.totalCustomerDebt)}
          icon={<AlertCircle />}
          tone={data.totalCustomerDebt > 0 ? 'warning' : 'neutral'}
          subtitle={`${data.orgsWithPendingDebt} orgs with debt`}
        />
      </div>

      {/* ===== Row 2: Platform counts (all neutral, distinguished by icon) ===== */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatCard
          title="Organizations"
          value={data.totalOrganizations.toLocaleString()}
          icon={<Building2 />}
          tone="neutral"
          subtitle={`${data.newShopsThisMonth} new this month`}
          comparisonBadge={data.newShopsThisMonth > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[0.769rem] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="size-3" />
              +{data.newShopsThisMonth}
            </span>
          ) : undefined}
        />
        <StatCard
          title="Total Users"
          value={data.totalUsers.toLocaleString()}
          icon={<Users />}
          tone="neutral"
        />
        <StatCard
          title="Active Shops"
          value={data.totalShops.toLocaleString()}
          icon={<Store />}
          tone="neutral"
        />
        <StatCard
          title="Products Tracked"
          value={data.totalProducts.toLocaleString()}
          icon={<Package />}
          tone="neutral"
        />
        {/* Daily active orgs — conditional tone */}
        <StatCard
          title="Active Orgs Today"
          value={data.activeOrgsToday.toLocaleString()}
          icon={<Flame />}
          tone={data.activeOrgsToday > 0 ? 'success' : 'neutral'}
          subtitle={`${data.activeOrgsThisWeek} this week`}
        />
      </div>

      {/* ===== Row 3: Revenue Trend + Sales Volume (dual chart) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Revenue Trend — Area Chart */}
        <SectionCard
          title="Revenue Trend"
          description="Last 6 months"
        >
          {data.revenueByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.revenueByMonth}>
                <defs>
                  <linearGradient id="adminRevGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ea580c" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#ea580c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: '0.769rem' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: '0.769rem' }} tickLine={false} axisLine={false} width={60} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatETB(value)} contentStyle={{ fontSize: '0.846rem', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                <Area type="monotone" dataKey="revenue" stroke="#ea580c" fill="url(#adminRevGradient)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">No revenue data yet</p>
            </div>
          )}
        </SectionCard>

        {/* Sales Volume — Bar Chart */}
        <SectionCard
          title="Sales Volume"
          description="Transactions per month"
        >
          {data.salesByMonth && data.salesByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.salesByMonth}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: '0.769rem' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: '0.769rem' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: '0.846rem', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} name="Sales" barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">No sales data yet</p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ===== Row 4: Subscription + Sales Team ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Active Subscriptions */}
        <SectionCard
          title="Active Subscriptions"
          description={`${totalSubs} active across all plans`}
        >
          {Object.keys(data.activeSubscriptions).length > 0 ? (
            <div className="space-y-3">
              {(Object.entries(data.activeSubscriptions) as [string, number][])
                .sort(([, a], [, b]) => b - a)
                .map(([plan, count]) => {
                  const pct = totalSubs > 0 ? (count / totalSubs) * 100 : 0
                  return (
                    <div key={plan} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{plan}</span>
                        <span className="tabular-nums text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No subscriptions yet</p>
          )}
        </SectionCard>

        {/* Sales Team */}
        {data.salesTeam && data.salesTeam.activeReps > 0 ? (
          <SectionCard
            title="Sales Team"
            description={`${data.salesTeam.activeReps} active reps`}
            action={
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 text-muted-foreground"
                onClick={() => useAppStore.getState().setPage('admin-sales-team')}
              >
                View all <ChevronRight className="size-3" />
              </Button>
            }
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">Active Reps</p>
                  <p className="text-base font-semibold tabular-nums">{data.salesTeam.activeReps}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">This Month</p>
                  <p className="text-base font-semibold tabular-nums">{data.salesTeam.registrationsThisMonth}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {data.salesTeam.totalRegistrationsByReps} total registrations via sales team
              </p>
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Sales Team" description="No active sales reps">
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">No sales team activity yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5 text-xs"
                onClick={() => useAppStore.getState().setPage('admin-sales-team')}
              >
                <Flame className="size-3.5" /> Manage Sales Team
              </Button>
            </div>
          </SectionCard>
        )}
      </div>

      {/* ===== Row 5: Top Shops + Business Type Distribution ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Organizations by Revenue */}
        {data.topShopsByRevenue.length > 0 && (
          <SectionCard
            title="Top Organizations by Revenue"
            description="Highest performing businesses"
          >
            <ResponsiveContainer width="100%" height={Math.max(180, data.topShopsByRevenue.length * 36)}>
              <BarChart data={data.topShopsByRevenue} layout="vertical" margin={{ left: isMobile ? 10 : 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: '0.769rem' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: '0.769rem' }} width={isMobile ? 80 : 140} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => formatETB(value)} contentStyle={{ fontSize: '0.846rem', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="totalRevenue" fill="#ea580c" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        )}

        {/* Business Type Distribution */}
        <SectionCard title="Business Types" description="Organization distribution">
          {businessTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={businessTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={isMobile ? 40 : 55}
                  outerRadius={isMobile ? 65 : 85}
                  paddingAngle={3}
                  dataKey="count"
                  label={isMobile
                    ? ({ count }: { count: number }) => count
                    : ({ type, count }: { type: string; count: number }) => `${type} (${count})`
                  }
                  labelLine={false}
                >
                  {businessTypeData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: '0.846rem', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">No data</p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ===== Quick Actions (all neutral — color is for state, not links) ===== */}
      <SectionCard title="Quick Actions" description="Jump to common admin tasks">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: 'Organizations', icon: Building2, page: 'admin-organizations' as const },
            { label: 'Users', icon: Users, page: 'admin-users' as const },
            { label: 'Modules & Pricing', icon: Package, page: 'admin-modules' as const },
            { label: 'Sales Team', icon: Flame, page: 'admin-sales-team' as const },
            { label: 'Regions', icon: Globe2, page: 'admin-regions' as const },
            { label: 'Announcements', icon: Megaphone, page: 'admin-notifications' as const },
          ].map(action => (
            <button
              key={action.label}
              onClick={() => useAppStore.getState().setPage(action.page)}
              className="flex items-center gap-2.5 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors text-left group"
            >
              <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <action.icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">{action.label}</span>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

// ============================================
// Shops Map Tab
// ============================================
function ShopsMapTab({ shops: initialShops }: { shops: ShopData[] }) {
  const [shops, setShops] = useState<ShopData[]>(initialShops)
  const [shopSearch, setShopSearch] = useState('')
  const [shopTypeFilter, setShopTypeFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  const fetchShops = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getAdminShops({
        search: shopSearch || undefined,
        businessType: shopTypeFilter !== 'all' ? shopTypeFilter : undefined,
        limit: 100,
      })
      setShops(data.shops || [])
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
      setShops(initialShops)
    } finally {
      setLoading(false)
    }
  }, [shopSearch, shopTypeFilter, initialShops])

  useEffect(() => {
    const timer = setTimeout(() => fetchShops(), 300)
    return () => clearTimeout(timer)
  }, [fetchShops])

  // Compute summary stats from real shop data
  const totalRevenue = shops.reduce((sum, s) => sum + s.totalRevenue, 0)
  const cities = [...new Set(shops.map(s => s.city).filter(Boolean) as string[])]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary KPIs from real shop data */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          title="Total Shops"
          value={shops.length.toLocaleString()}
          icon={<Store />}
          tone="neutral"
          subtitle="All registered"
        />
        <StatCard
          title="Combined Revenue"
          value={formatETB(totalRevenue)}
          icon={<DollarSign />}
          tone="brand"
          subtitle="Across all shops"
        />
        <StatCard
          title="Avg Revenue"
          value={formatETB(shops.length > 0 ? Math.round(totalRevenue / shops.length) : 0)}
          icon={<TrendingUp />}
          tone="neutral"
          subtitle="Per organization"
        />
        <StatCard
          title="Cities"
          value={cities.length.toLocaleString()}
          icon={<MapPin />}
          tone="neutral"
          subtitle="Geographic spread"
        />
      </div>

      {/* Map */}
      <SectionCard
        title="Shops Map"
        description="Geographic distribution of all registered organizations"
      >
        <Suspense fallback={<MapSkeleton />}>
          <LazyShopsMap shops={shops} />
        </Suspense>
      </SectionCard>

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search shops by name or city..."
            value={shopSearch}
            onChange={(e) => setShopSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={shopTypeFilter} onValueChange={setShopTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="retail">Retail</SelectItem>
            <SelectItem value="service">Service</SelectItem>
            <SelectItem value="mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Shops list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        ) : shops.length === 0 ? (
          <EmptyState title="No shops found" message="Try adjusting your search or filter" />
        ) : (
          shops.map(shop => (
            <Card key={shop.id} className="p-3 hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Store className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm truncate">{shop.name}</h4>
                    <Badge variant="outline" className="text-[0.769rem] py-0 capitalize shrink-0">{shop.businessType.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {shop.city && <span className="flex items-center gap-1"><MapPin className="size-3" />{shop.city}</span>}
                    <span>Revenue: <strong className="text-foreground tabular-nums">{formatETB(shop.totalRevenue)}</strong></span>
                    <span>Shops: {shop.shopCount || 0}</span>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs capitalize shrink-0">{shop.subscriptionPlan}</Badge>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

// ============================================
// Market Intelligence Tab
// ============================================
function MarketIntelligenceTab({ regionId }: { regionId?: string | null }) {
  const { setPage } = useAppStore()
  const isMobile = useIsMobile()
  const [insights, setInsights] = useState<MarketInsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInsights = useCallback(async () => {
    setError(null)
    try {
      const data = await api.getAdminMarketInsights(regionId || undefined)
      setInsights(data)
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [regionId])

  useEffect(() => { fetchInsights() }, [fetchInsights])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (!insights) {
    return error
      ? <ErrorState title="Failed to load market insights" message={error} onRetry={() => { setLoading(true); fetchInsights() }} />
      : <EmptyState title="No market data" message="Market intelligence data will appear as organizations use the platform." />
  }

  // Compute summary KPIs from real insights data
  const totalFastMovingRevenue = insights.fastMovingProducts.reduce((sum, p) => sum + p.revenue, 0)
  const totalLowStock = insights.lowStockProducts.filter(p => p.quantity === 0).length
  const totalCriticalLow = insights.lowStockProducts.filter(p => p.quantity > 0 && p.quantity <= 5).length

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary KPIs from real intelligence data */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          title="Supply Opportunities"
          value={insights.supplyOpportunities.length.toString()}
          icon={<Package />}
          tone="neutral"
          subtitle="Product types needed"
        />
        <StatCard
          title="Out of Stock"
          value={totalLowStock.toString()}
          icon={<AlertTriangle />}
          tone={totalLowStock > 0 ? 'danger' : 'success'}
          subtitle={`${totalCriticalLow} critically low`}
        />
        <StatCard
          title="Top Products Revenue"
          value={formatETB(totalFastMovingRevenue)}
          icon={<TrendingUp />}
          tone="neutral"
          subtitle={`${insights.fastMovingProducts.length} products tracked`}
        />
        <StatCard
          title="Cities Covered"
          value={insights.topCities.length.toString()}
          icon={<MapPin />}
          tone="neutral"
          subtitle="Active markets"
        />
      </div>

      {/* Supply Opportunities */}
      <SectionCard
        title="Supply Opportunities"
        description="Products that businesses need — ideal for suppliers"
        action={
          <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" onClick={() => setPage('admin-organizations')}>
            View orgs <ChevronRight className="size-3" />
          </Button>
        }
      >
        {insights.supplyOpportunities.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.supplyOpportunities.map((opp, i) => (
              <div key={i} className="p-4 rounded-lg border bg-amber-500/5 space-y-2">
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-sm">{opp.productType}</h4>
                  {opp.lowStockCount >= 3 && (
                    <Badge className="bg-amber-500 text-white text-[0.769rem] px-1.5 py-0">HIGH DEMAND</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{opp.lowStockCount}</strong>{' '}
                  {opp.lowStockCount === 1 ? 'business needs' : 'businesses need'} this product
                </p>
                <div className="flex flex-wrap gap-1">
                  {opp.orgNames.slice(0, 3).map((name, j) => (
                    <Badge key={j} variant="outline" className="text-[0.769rem] py-0">{name}</Badge>
                  ))}
                  {opp.orgNames.length > 3 && (
                    <Badge variant="outline" className="text-[0.769rem] py-0">+{opp.orgNames.length - 3}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No supply opportunities detected</p>
        )}
      </SectionCard>

      {/* Fast Moving Products */}
      <SectionCard
        title="Fast Moving Products"
        description="Highest sales volume across all shops"
      >
        {insights.fastMovingProducts.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {insights.fastMovingProducts.slice(0, 10).map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums w-5 text-right">{i + 1}.</span>
                    <h4 className="font-medium text-sm truncate">{p.name}</h4>
                    <Badge variant="outline" className="text-[0.769rem] py-0 shrink-0">{p.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                    {p.orgName} · {p.quantitySold.toLocaleString()} sold
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-semibold text-sm tabular-nums">{formatETB(p.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
        )}
      </SectionCard>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Demand by Category */}
        <SectionCard title="Demand by Category" description="Quantity sold by product category">
          {insights.demandByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={insights.demandByCategory}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="category" tick={{ fontSize: '0.769rem' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: '0.769rem' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: '0.846rem', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="quantitySold" fill="#ea580c" radius={[4, 4, 0, 0]} name="Quantity Sold" barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">No data</p>
            </div>
          )}
        </SectionCard>

        {/* Average Revenue by Business Type */}
        <SectionCard title="Avg Revenue by Type" description="Mean revenue per organization">
          {insights.averageRevenueByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={insights.averageRevenueByType.map(item => ({
                  ...item,
                  businessType: item.businessType.charAt(0).toUpperCase() + item.businessType.slice(1).replace(/_/g, ' '),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="businessType" tick={{ fontSize: '0.769rem' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: '0.769rem' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatETB(value)} contentStyle={{ fontSize: '0.846rem', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="averageRevenue" fill="#ea580c" radius={[4, 4, 0, 0]} name="Avg Revenue" barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">No data</p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Cities */}
        <SectionCard title="Top Cities" description="Where most organizations are located">
          {insights.topCities.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {insights.topCities.map((c, i) => (
                <div key={i} className="text-center p-3 rounded-lg border bg-muted/20">
                  <div className="size-8 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                    <span className="text-sm font-bold tabular-nums">{i + 1}</span>
                  </div>
                  <p className="font-medium text-sm truncate">{c.city || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{c.shopCount} orgs</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No data</p>
          )}
        </SectionCard>

        {/* Business Type Distribution */}
        <SectionCard title="Business Type Distribution">
          {insights.businessTypeDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={insights.businessTypeDistribution.map(item => ({
                    type: item.businessType.charAt(0).toUpperCase() + item.businessType.slice(1).replace(/_/g, ' '),
                    count: item.count,
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="count"
                  label={isMobile
                    ? ({ count }: { count: number }) => count
                    : ({ type, count }: { type: string; count: number }) => `${type} (${count})`
                  }
                  labelLine={false}
                >
                  {insights.businessTypeDistribution.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: '0.846rem', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No data</p>
          )}
        </SectionCard>
      </div>

      {/* Low Stock Alerts */}
      <SectionCard
        title="Low Stock Alerts"
        description="Products running low across shops — supply opportunity"
      >
        {insights.lowStockProducts.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {insights.lowStockProducts.slice(0, 15).map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-red-500/5 hover:bg-red-500/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="size-4 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {p.orgName} — <strong>{p.productName}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground">{p.category}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs shrink-0 ml-2 ${
                    p.quantity === 0
                      ? 'text-red-700 bg-red-100 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                      : 'text-amber-700 bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                  }`}
                >
                  {p.quantity === 0 ? 'OUT' : `${p.quantity} left`}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">All products are well-stocked</p>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ============================================
// System Health Tab
// ============================================
function SystemHealthTab() {
  const [health, setHealth] = useState<SystemHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchHealth = useCallback(async () => {
    setError(null)
    try {
      const data = await swrFetch<SystemHealthData>(
        'admin:system-health',
        () => api.getSystemHealth(),
        { dedupingInterval: 10_000 }
      )
      setHealth(data)
      setLastRefresh(new Date())
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(() => {
      invalidateKey('admin:system-health')
      fetchHealth()
    }, 30_000)
    return () => clearInterval(interval)
  }, [fetchHealth])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (!health) {
    return error
      ? <ErrorState title="Failed to load system health" message={error} onRetry={() => { setLoading(true); fetchHealth() }} />
      : <EmptyState title="No health data" message="System health data is not available." />
  }

  const isHealthy = health.status === 'healthy'
  const isDegraded = health.status === 'degraded'
  const memUsagePercent = health.memory.heapTotalMB > 0
    ? Math.round((health.memory.heapUsedMB / health.memory.heapTotalMB) * 100)
    : 0

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Status KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          title="Server Status"
          value={health.status === 'healthy' ? 'Healthy' : health.status === 'degraded' ? 'Degraded' : 'Error'}
          icon={<Server />}
          tone={isHealthy ? 'success' : isDegraded ? 'warning' : 'danger'}
          subtitle={`Up ${health.uptime.formatted}`}
        />
        <StatCard
          title="DB Latency"
          value={`${health.database.latencyMs}ms`}
          icon={<Database />}
          tone={health.database.latencyMs > 100 ? 'warning' : health.database.latencyMs > 200 ? 'danger' : 'neutral'}
          subtitle={health.database.status}
        />
        <StatCard
          title="Uptime"
          value={health.uptime.formatted}
          icon={<Clock />}
          tone="neutral"
        />
        <StatCard
          title="Cache Entries"
          value={health.cache.totalEntries.toLocaleString()}
          icon={<Zap />}
          tone="neutral"
          subtitle={`${health.cache.namespaces} namespaces`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Memory Usage */}
        <SectionCard title="Memory Usage" description="Node.js process memory allocation">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Heap Used</span>
                <span className="font-medium tabular-nums">{health.memory.heapUsedMB} / {health.memory.heapTotalMB} MB</span>
              </div>
              <Progress
                value={memUsagePercent}
                className={`h-3 ${memUsagePercent > 80 ? '[&>[data-slot=progress-indicator]]:bg-red-500' : memUsagePercent > 60 ? '[&>[data-slot=progress-indicator]]:bg-amber-500' : '[&>[data-slot=progress-indicator]]:bg-emerald-500'}`}
              />
              <p className="text-xs text-muted-foreground tabular-nums">{memUsagePercent}% utilized</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-xs text-muted-foreground">RSS</p>
                <p className="text-sm font-semibold tabular-nums">{health.memory.rssMB} MB</p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-xs text-muted-foreground">External</p>
                <p className="text-sm font-semibold tabular-nums">{health.memory.externalMB} MB</p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Cache Namespaces */}
        <SectionCard title="Cache Namespaces" description="Multi-layer in-memory cache">
          {Object.keys(health.cache.details).length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(Object.entries(health.cache.details) as [string, number][]).map(([ns, count]) => (
                <div key={ns} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-sm font-mono truncate">{ns}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0 ml-2 tabular-nums">{count}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No cache entries</p>
          )}
          <div className="mt-3 p-2 rounded-lg bg-muted/20 text-xs text-muted-foreground">
            Hit Rate: {health.cache.hitRate}
          </div>
        </SectionCard>

        {/* Rate Limiting */}
        <SectionCard title="Rate Limiting" description="Token bucket rate limits">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <span className="text-sm text-muted-foreground">Active Buckets</span>
              <span className="text-sm font-semibold tabular-nums">{health.rateLimit.activeBuckets}</span>
            </div>
            {Object.keys(health.rateLimit.details).length > 0 ? (
              <div className="space-y-2">
                {(Object.entries(health.rateLimit.details) as [string, number][]).map(([prefix, count]) => (
                  <div key={prefix} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/10">
                    <div className="flex items-center gap-2">
                      <ArrowDownUp className="size-3.5 text-muted-foreground" />
                      <span className="text-sm font-mono">{prefix}</span>
                    </div>
                    <Badge variant="outline" className="text-xs tabular-nums">{count} buckets</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">No active rate limit buckets</p>
            )}
          </div>
        </SectionCard>

        {/* Circuit Breakers */}
        <SectionCard title="Circuit Breakers" description="Resilience patterns">
          {Object.keys(health.resilience.circuits).length > 0 ? (
            <div className="space-y-2">
              {(Object.entries(health.resilience.circuits) as [string, { state: string; failureCount: number }][]).map(([key, circuit]) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
                  <div className="flex items-center gap-2">
                    <div className={`size-2.5 rounded-full ${
                      circuit.state === 'closed' ? 'bg-emerald-500' :
                      circuit.state === 'open' ? 'bg-red-500' :
                      'bg-amber-500'
                    }`} />
                    <span className="text-sm font-mono">{key}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[0.769rem] px-1.5 py-0 capitalize ${
                      circuit.state === 'closed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      circuit.state === 'open' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                      'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`} variant="outline">
                      {circuit.state}
                    </Badge>
                    {circuit.failureCount > 0 && (
                      <span className="text-xs text-red-600 dark:text-red-400 tabular-nums">
                        {circuit.failureCount} failures
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <CheckCircle2 className="size-6 text-emerald-500 mx-auto mb-1" />
              <p className="text-sm text-muted-foreground">All circuits closed (healthy)</p>
            </div>
          )}

          {Object.keys(health.resilience.bulkheads).length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Bulkheads</p>
              {(Object.entries(health.resilience.bulkheads) as [string, { active: number; queued: number }][]).map(([key, bh]) => (
                <div key={key} className="flex items-center justify-between p-2 rounded-lg border bg-muted/10 text-sm">
                  <span className="font-mono text-xs">{key}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {bh.active} active / {bh.queued} queued
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Applied Patterns */}
      <SectionCard
        title="Applied Patterns"
        description="Industry-proven patterns from Netflix, Google, and YouTube"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(health.patterns?.applied || []).map((pattern, i) => (
            <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/10">
              <div className="size-5 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="size-3 text-muted-foreground" />
              </div>
              <span className="text-sm">{pattern}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Last Refresh */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Last refreshed: {lastRefresh.toLocaleTimeString()}</span>
        <span className="flex items-center gap-1">
          <Activity className="size-3" />
          Auto-refreshes every 30s
        </span>
      </div>
    </div>
  )
}

// ============================================
// Audit Log Tab (REAL data from /api/admin/audit-logs)
// ============================================
type AuditFilterTab = 'all' | 'organization' | 'user' | 'sale' | 'product' | 'module' | 'settings'

function AuditLogTab() {
  const [logs, setLogs] = useState<Array<{
    id: string
    action: string
    entity: string
    entityId?: string | null
    details?: string | null
    ipAddress?: string | null
    userAgent?: string | null
    createdAt: string
    user: { id: string; name: string; email: string; role: string } | null
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [summary, setSummary] = useState<{ totalActionsToday: number; mostActiveUser: { name: string; count: number } | null; mostChangedEntity: { entity: string; count: number } | null } | null>(null)
  const [filterTab, setFilterTab] = useState<AuditFilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [availableActions, setAvailableActions] = useState<string[]>([])

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getAdminAuditLogs({
        page,
        limit: 20,
        entity: filterTab === 'all' ? undefined : filterTab,
        action: actionFilter || undefined,
        search: searchQuery || undefined,
      })
      setLogs(data.logs)
      setPagination(data.pagination)
      setSummary(data.summary)
      if (data.filters) {
        setAvailableActions(data.filters.actions || [])
      }
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [filterTab, actionFilter, searchQuery])

  useEffect(() => { fetchLogs(1) }, [fetchLogs])

  // Design system: entities distinguished by ICON, not by decorative color.
  // All entity tiles are neutral (muted bg).
  const getEntityIcon = (entity: string) => {
    const icons: Record<string, React.ElementType> = {
      organization: Building2,
      user: Users,
      sale: ShoppingCart,
      product: Package,
      module: LayoutDashboard,
      notification: Megaphone,
      announcement: Megaphone,
      settings: FileText,
    }
    return icons[entity] || FileText
  }

  const filterTabs: Array<{ value: AuditFilterTab; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'organization', label: 'Organizations' },
    { value: 'user', label: 'Users' },
    { value: 'sale', label: 'Sales' },
    { value: 'product', label: 'Products' },
    { value: 'module', label: 'Modules' },
  ]

  if (error && !logs.length) {
    return <ErrorState title="Failed to load audit logs" message={error} onRetry={() => fetchLogs(1)} />
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary Cards — design system compliant */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatCard
            title="Actions Today"
            value={summary.totalActionsToday.toLocaleString()}
            icon={<FileText />}
            tone="neutral"
          />
          {summary.mostActiveUser && (
            <StatCard
              title="Most Active User"
              value={summary.mostActiveUser.name.split(' ')[0]}
              icon={<Users />}
              tone="neutral"
              subtitle={`${summary.mostActiveUser.count} actions today`}
            />
          )}
          {summary.mostChangedEntity && (
            <StatCard
              title="Most Changed"
              value={summary.mostChangedEntity.entity}
              icon={<FileText />}
              tone="neutral"
              subtitle={`${summary.mostChangedEntity.count} changes today`}
            />
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <FilterChips
        options={filterTabs}
        value={filterTab}
        onChange={setFilterTab}
        label="Filter by entity type"
      />

      {/* Additional Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {availableActions.length > 0 && (
          <Select value={actionFilter} onValueChange={(v) => setActionFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Actions</SelectItem>
              {availableActions.map(a => (
                <SelectItem key={a} value={a} className="capitalize">{a.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Logs List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-sm font-semibold">Activity Timeline</CardTitle>
            <CardDescription className="text-xs mt-1">
              {pagination.total} event{pagination.total !== 1 ? 's' : ''} total
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-3 w-20 shrink-0" />
                </div>
              ))}
            </div>
          ) : logs.length > 0 ? (
            <div className="relative max-h-[calc(100vh-380px)] overflow-y-auto">
              <div className="absolute left-[1.125rem] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-0.5">
                {logs.map(log => {
                  const Icon = getEntityIcon(log.entity)
                  return (
                    <div key={log.id} className="relative flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer group">
                      {/* Design system: neutral icon tile for ALL entities (no decorative colors) */}
                      <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0 z-10 ring-2 ring-background">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">
                            {log.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </p>
                          <Badge variant="outline" className="text-[0.769rem] px-1.5 py-0 capitalize shrink-0">
                            {log.entity}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {log.user && (
                            <p className="text-xs text-muted-foreground truncate">
                              {log.user.name}
                            </p>
                          )}
                          {log.details && (
                            <p className="text-xs text-muted-foreground truncate">— {log.details}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2 pt-0.5">
                        <p className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          {formatDateWithTime(log.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No events found"
              message={filterTab === 'all' && !searchQuery ? 'There is no platform activity yet.' : 'Try adjusting your filters.'}
            />
          )}
        </CardContent>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 pb-4">
            <p className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchLogs(pagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => fetchLogs(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// ============================================
// Admin Dashboard Page
// ============================================
export function AdminDashboardPage() {
  const { user } = useAuthStore()
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null)
  const [shopsData, setShopsData] = useState<ShopData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [regions, setRegions] = useState<RegionData[]>([])

  // Fetch regions for the selector
  const fetchRegions = useCallback(async () => {
    try {
      const data = await api.getAdminRegions({ includeStats: true })
      setRegions(data.regions)
    } catch {
      // Silent fail for regions selector
    }
  }, [])

  useEffect(() => { fetchRegions() }, [fetchRegions])

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    setError(null)
    try {
      const [dashboard, shopsResult] = await Promise.all([
        swrFetch<AdminDashboardData>(
          `admin:dashboard:${selectedRegionId || 'all'}`,
          () => api.getAdminDashboard(selectedRegionId || undefined),
          { dedupingInterval: 15_000 }
        ),
        api.getAdminShops({ limit: 100, regionId: selectedRegionId || undefined }),
      ])
      setDashboardData(dashboard)
      setShopsData(shopsResult.shops || [])
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedRegionId])

  useEffect(() => { fetchData() }, [fetchData])

  // Loading State — design system skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="ds-hairline" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    )
  }

  // Error / Empty State
  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={<ShieldCheck />}
          title="Admin Dashboard"
          subtitle="Platform overview and market intelligence"
        />
        {error ? (
          <ErrorState title="Failed to load dashboard" message={error} onRetry={() => fetchData(true)} />
        ) : (
          <EmptyState title="No data available" message="Dashboard data could not be loaded." />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header — design system PageHeader */}
      <PageHeader
        icon={<ShieldCheck />}
        title="Admin Dashboard"
        subtitle={selectedRegionId ? `Filtered to ${dashboardData.regionInfo?.name || 'selected region'}` : 'Platform overview and market intelligence'}
        badges={
          <>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[0.769rem] px-1.5 py-0.5 gap-1 border-0">
              <Zap className="size-3" />
              Live
            </Badge>
            {dashboardData.regionInfo && (
              <span className="text-primary text-sm font-medium">{dashboardData.regionInfo.name}</span>
            )}
          </>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Region Selector Bar */}
      {regions.length > 0 && (
        <FilterChips
          options={[
            { value: '__all__', label: 'All Regions' },
            ...regions.map(r => ({
              value: r.id,
              label: `${r.name} (${r.orgCount ?? 0})`,
            })),
          ]}
          value={selectedRegionId || '__all__'}
          onChange={(v) => setSelectedRegionId(v === '__all__' ? null : v)}
          label="Filter by region"
        />
      )}

      {/* Regions Comparison */}
      {dashboardData.regionsBreakdown && dashboardData.regionsBreakdown.length > 1 && !selectedRegionId && (
        <SectionCard
          title="Regional Breakdown"
          description="Compare performance across regions"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {dashboardData.regionsBreakdown
              .sort((a, b) => b.orgCount - a.orgCount)
              .map(region => (
                <button
                  key={region.regionId}
                  onClick={() => setSelectedRegionId(region.regionId)}
                  className="text-left p-3 rounded-lg border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <p className="font-medium text-sm truncate">{region.regionName}</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Orgs</span>
                      <span className="text-xs font-semibold tabular-nums">{region.orgCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Revenue</span>
                      <span className="text-xs font-semibold tabular-nums">{formatETB(region.revenue)}</span>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </SectionCard>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="size-4" /><span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-1.5 text-xs sm:text-sm">
            <MapPin className="size-4" /><span className="hidden sm:inline">Shops Map</span>
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="gap-1.5 text-xs sm:text-sm">
            <TrendingUp className="size-4" /><span className="hidden sm:inline">Intelligence</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5 text-xs sm:text-sm">
            <Server className="size-4" /><span className="hidden sm:inline">System Health</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="size-4" /><span className="hidden sm:inline">Audit Log</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab data={dashboardData} />
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          <ShopsMapTab shops={shopsData} />
        </TabsContent>

        <TabsContent value="intelligence" className="mt-4">
          <MarketIntelligenceTab regionId={selectedRegionId} />
        </TabsContent>

        <TabsContent value="health" className="mt-4">
          <SystemHealthTab />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditLogTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
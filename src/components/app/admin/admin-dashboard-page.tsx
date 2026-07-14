'use client'

import { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import {
  Building2, Users, DollarSign, CreditCard, MapPin, Search,
  TrendingUp, Package, ShoppingCart, AlertTriangle, Loader2,
  BarChart3, Globe2, Store, Rocket, Flame, ChevronRight,
  Activity, Database, Zap, Clock, Server, CheckCircle2, XCircle,
  AlertCircle, Megaphone, RefreshCw, HardDrive, ShieldCheck,
  ArrowDownUp, Cpu, Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  api, type AdminDashboardData, type ShopData, type MarketInsightsData,
  type SystemHealthData, type RegionData,
} from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useAppStore } from '@/lib/stores/app-store'
import { getNetworkErrorMessage } from '@/lib/validation'
import { formatETB, businessTypeColor, CHART_COLORS, formatDateWithTime } from '@/lib/admin-utils'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { PageHeader } from '@/components/shared/design-system'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { swrFetch, invalidateKey } from '@/lib/client-cache'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from '@/components/ui/recharts-exports'

// ============================================
// Helpers (imported from @/lib/admin-utils)
// ============================================

// ============================================
// Lazy-loaded Map Component (YouTube Pattern)
// ============================================
// YouTube lazily loads heavy components. We do the same with Leaflet
// to reduce initial JS bundle size and improve page load time.
const LazyShopsMap = lazy(() =>
  import('./shops-map-component').then(mod => ({ default: mod.ShopsMapComponent }))
)

function MapSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-[23.077rem] md:h-[34.615rem] w-full rounded-lg" />
      <div className="flex gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  )
}

// ============================================
// Quick Actions Panel
// ============================================
function QuickActionsPanel() {
  const { setPage } = useAppStore()

  // Design rule: navigation actions are neutral — color is reserved for state.
  const actions = [
    { label: 'Manage Organizations', icon: Building2, page: 'admin-organizations' as const, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'View Users', icon: Users, page: 'admin-users' as const, color: 'text-muted-foreground', bg: 'bg-muted' },
    { label: 'Modules & Pricing', icon: Package, page: 'admin-modules' as const, color: 'text-muted-foreground', bg: 'bg-muted' },
    { label: 'Sales Team', icon: DollarSign, page: 'admin-sales-team' as const, color: 'text-muted-foreground', bg: 'bg-muted' },
    { label: 'Regions & Cities', icon: Globe2, page: 'admin-regions' as const, color: 'text-muted-foreground', bg: 'bg-muted' },
    { label: 'Send Announcement', icon: Activity, page: 'admin-notifications' as const, color: 'text-muted-foreground', bg: 'bg-muted' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="size-4 text-primary" /> Quick Actions
        </CardTitle>
        <CardDescription>Jump to common admin tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map(action => (
            <button
              key={action.label}
              onClick={() => setPage(action.page)}
              className="flex items-center gap-2.5 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors text-left group"
            >
              <div className={`size-8 rounded-lg ${action.bg} flex items-center justify-center shrink-0`}>
                <action.icon className={`size-4 ${action.color}`} />
              </div>
              <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">{action.label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Recent Activity Feed
// ============================================
function RecentActivityFeed({ data }: { data: AdminDashboardData }) {
  // Build activity items from dashboard data
  const activities: Array<{
    id: string
    icon: React.ElementType
    iconBg: string
    iconColor: string
    title: string
    description: string
    time: string
  }> = []

  // New shops this month
  if (data.newShopsThisMonth > 0) {
    activities.push({
      id: 'new-shops',
      icon: TrendingUp,
      iconBg: 'bg-brand-50 dark:bg-brand-900/20',
      iconColor: 'text-primary',
      title: `${data.newShopsThisMonth} new organization${data.newShopsThisMonth !== 1 ? 's' : ''} joined`,
      description: 'This month',
      time: 'This month',
    })
  }

  // Revenue info
  if (data.totalRevenue > 0) {
    activities.push({
      id: 'revenue',
      icon: DollarSign,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600',
      title: `Platform revenue at ${formatETB(data.totalRevenue)}`,
      description: `${Object.values(data.activeSubscriptions).reduce((a, b) => a + b, 0)} active subscriptions`,
      time: 'Current',
    })
  }

  // Top shops
  if (data.topShopsByRevenue.length > 0) {
    activities.push({
      id: 'top-shop',
      icon: Store,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600',
      title: `${data.topShopsByRevenue[0].name} leads revenue`,
      description: formatETB(data.topShopsByRevenue[0].totalRevenue) + ' in total',
      time: 'Top performer',
    })
  }

  // Regions breakdown
  if (data.regionsBreakdown && data.regionsBreakdown.length > 0) {
    const topRegion = data.regionsBreakdown.reduce((max, r) => r.orgCount > max.orgCount ? r : max, data.regionsBreakdown[0])
    activities.push({
      id: 'top-region',
      icon: Globe2,
      iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
      iconColor: 'text-cyan-600',
      title: `${topRegion.regionName} has the most orgs`,
      description: `${topRegion.orgCount} organizations in this region`,
      time: 'By region',
    })
  }

  // Sales team
  if (data.salesTeam && data.salesTeam.activeReps > 0) {
    activities.push({
      id: 'sales-team',
      icon: Flame,
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      iconColor: 'text-violet-600',
      title: `${data.salesTeam.registrationsThisMonth} sales team registrations`,
      description: `${data.salesTeam.activeReps} active reps`,
      time: 'This month',
    })
  }

  // Business type growth
  const businessTypes = Object.entries(data.organizationsByBusinessType || {})
  if (businessTypes.length > 0) {
    const [topType, topCount] = businessTypes.reduce((max, [type, count]) => count > max[1] ? [type, count] as [string, number] : max, businessTypes[0] as [string, number])
    activities.push({
      id: 'biz-type',
      icon: BarChart3,
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600',
      title: `${topType.charAt(0).toUpperCase() + topType.slice(1)} is the most popular type`,
      description: `${topCount} organizations`,
      time: 'Distribution',
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="size-4 text-primary" /> Recent Activity
        </CardTitle>
        <CardDescription>Platform insights at a glance</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length > 0 ? (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {activities.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
                <div className={`size-8 rounded-lg ${a.iconBg} flex items-center justify-center shrink-0`}>
                  <a.icon className={`size-4 ${a.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.description}</p>
                </div>
                <Badge variant="outline" className="text-[0.769rem] shrink-0 ml-2">{a.time}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Overview Tab
// ============================================
function OverviewTab({ data }: { data: AdminDashboardData }) {
  const isMobile = useIsMobile()
  // One brand card (primary metric); counts are neutral.
  const stats = [
    { title: 'Organizations', value: data.totalOrganizations, icon: Building2, color: 'text-primary', bg: 'bg-primary/10' },
    { title: 'Total Users', value: data.totalUsers, icon: Users, color: 'text-muted-foreground', bg: 'bg-muted' },
    { title: 'Platform Revenue', value: formatETB(data.totalRevenue), icon: DollarSign, color: 'text-muted-foreground', bg: 'bg-muted' },
    { title: 'Active Subscriptions', value: Object.values(data.activeSubscriptions).reduce((a, b) => a + b, 0), icon: CreditCard, color: 'text-muted-foreground', bg: 'bg-muted' },
  ]

  // Revenue trend data
  const revenueData = data.revenueByMonth || []

  // Top shops data
  const topShops = data.topShopsByRevenue || []

  // Business type distribution for pie chart
  const businessTypeData = Object.entries(data.organizationsByBusinessType || {}).map(([type, count]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    count,
  }))

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(s => (
          <Card key={s.title}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`size-8 sm:size-10 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon className={`size-4 sm:size-5 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.846rem] sm:text-xs text-muted-foreground line-clamp-1">{s.title}</p>
                  <p className="text-sm sm:text-base font-semibold whitespace-nowrap">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New shops this month */}
      {data.newShopsThisMonth > 0 && (
        <Card className="border-brand-100 bg-brand-50/50 dark:border-brand-900/50 dark:bg-brand-900/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-8 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
              <TrendingUp className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{data.newShopsThisMonth} new shops this month</p>
              <p className="text-xs text-muted-foreground">Platform is growing</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Team Quick Stats */}
      {data.salesTeam && data.salesTeam.activeReps > 0 && (
        <Card className="border-violet-200 bg-violet-50/50 dark:border-violet-900/50 dark:bg-violet-900/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Flame className="size-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Sales Team: {data.salesTeam.activeReps} active reps</p>
                <p className="text-xs text-muted-foreground">
                  {data.salesTeam.registrationsThisMonth} registrations this month via sales team
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Revenue Trend
            </CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: '0.846rem' }} />
                  <YAxis tick={{ fontSize: '0.846rem' }} />
                  <Tooltip formatter={(value: number) => formatETB(value)} />
                  <Area type="monotone" dataKey="revenue" stroke="#ea580c" fill="#ea580c" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No revenue data</p>
            )}
          </CardContent>
        </Card>

        {/* Business Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" /> Business Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {businessTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={businessTypeData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={4} dataKey="count"
                    label={isMobile ? ({ count }: { count: number }) => count : ({ type, count }: { type: string; count: number }) => `${type} (${count})`}
                  >
                    {businessTypeData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Shops by Revenue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="size-4 text-primary" /> Top Shops by Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topShops.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, topShops.length * 40)}>
              <BarChart data={topShops} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: '0.846rem' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: '0.846rem' }} width={isMobile ? 70 : 120} />
                <Tooltip formatter={(value: number) => formatETB(value)} />
                <Bar dataKey="totalRevenue" fill="#ea580c" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No shop data</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quick Actions */}
        <QuickActionsPanel />

        {/* Recent Activity */}
        <RecentActivityFeed data={data} />
      </div>
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

  // Fetch shops from API for filtering (server-side handles the filters)
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
    // Debounce search
    const timer = setTimeout(() => fetchShops(), 300)
    return () => clearTimeout(timer)
  }, [fetchShops])

  // Server already filters — just use the results directly
  const filteredShops = shops

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="size-4 text-primary" /> Shops Map
          </CardTitle>
          <CardDescription>Geographic distribution of all registered shops</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Lazy loaded map component (YouTube pattern) */}
          <Suspense fallback={<MapSkeleton />}>
            <LazyShopsMap shops={filteredShops} />
          </Suspense>
        </CardContent>
      </Card>

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search shops by name or city..." value={shopSearch} onChange={(e) => setShopSearch(e.target.value)} className="pl-9" />
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
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : filteredShops.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No shops found</p>
        ) : (
          filteredShops.map(shop => (
            <Card key={shop.id} className="p-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                  shop.businessType === 'retail' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                  shop.businessType === 'service' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  'bg-amber-100 dark:bg-amber-900/30'
                }`}>
                  <Store className={`size-4 ${
                    shop.businessType === 'retail' ? 'text-emerald-600' :
                    shop.businessType === 'service' ? 'text-blue-600' :
                    'text-amber-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm truncate">{shop.name}</h4>
                    <Badge className={businessTypeColor(shop.businessType)} variant="outline">{shop.businessType}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {shop.city && <span className="flex items-center gap-1"><MapPin className="size-3" />{shop.city}</span>}
                    <span>Revenue: <strong className="text-foreground">{formatETB(shop.totalRevenue)}</strong></span>
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
// Market Intelligence Tab (uses isMobile)
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
      const msg = getNetworkErrorMessage(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [regionId])

  useEffect(() => { fetchInsights() }, [fetchInsights])

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
      </div>
    )
  }

  if (!insights) {
    if (error) {
      return (
        <ErrorState
          title="Failed to load market insights"
          message={error}
          onRetry={() => { setLoading(true); fetchInsights() }}
        />
      )
    }
    return (
      <EmptyState
        title="No market data"
        message="Market intelligence data is not available yet."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Supply Opportunities */}
      <Card className="border-amber-200 dark:border-amber-900/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="size-5 text-amber-500" /> Supply Opportunities
          </CardTitle>
          <CardDescription>
            Products that shops need — ideal for suppliers looking to fulfill demand
          </CardDescription>
        </CardHeader>
        <CardContent>
          {insights.supplyOpportunities.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {insights.supplyOpportunities.map((opp, i) => (
                <div key={i} className="p-4 rounded-lg border bg-amber-50/50 dark:bg-amber-900/10 space-y-2">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-sm">{opp.productType}</h4>
                    {opp.lowStockCount >= 3 && (
                      <Badge className="bg-amber-500 text-white text-[0.769rem] px-1.5 py-0">HIGH DEMAND</Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">{opp.lowStockCount}</strong> {opp.lowStockCount === 1 ? 'business needs' : 'businesses need'} this product
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {opp.orgNames.slice(0, 3).map((name, j) => (
                        <Badge key={j} variant="outline" className="text-[0.769rem] py-0">{name}</Badge>
                      ))}
                      {opp.orgNames.length > 3 && (
                        <Badge variant="outline" className="text-[0.769rem] py-0">+{opp.orgNames.length - 3} more</Badge>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs mt-2" onClick={() => setPage('admin-organizations')}>
                    View Organizations <ChevronRight className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No supply opportunities detected</p>
          )}
        </CardContent>
      </Card>

      {/* Fast Moving Products */}
      <Card className="border-brand-100 dark:border-brand-900/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="size-5 text-orange-500" /> Fast Moving Products
          </CardTitle>
          <CardDescription>Products with the highest sales volume across all shops</CardDescription>
        </CardHeader>
        <CardContent>
          {insights.fastMovingProducts.length > 0 ? (
            <div className="space-y-3">
              {insights.fastMovingProducts.slice(0, 10).map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-brand-50/50 dark:bg-brand-900/10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm truncate">{p.name}</h4>
                      <Badge variant="outline" className="text-[0.769rem] py-0 shrink-0">{p.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.orgName} · {p.quantitySold} sold
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-semibold text-sm">{formatETB(p.revenue)}</p>
                    <p className="text-[0.846rem] text-primary">High demand</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Demand by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="size-4 text-primary" /> Demand by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insights.demandByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={insights.demandByCategory}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="category" tick={{ fontSize: '0.846rem' }} />
                  <YAxis tick={{ fontSize: '0.846rem' }} />
                  <Tooltip />
                  <Bar dataKey="quantitySold" fill="#ea580c" radius={[4, 4, 0, 0]} name="Quantity Sold" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Average Revenue by Business Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="size-4 text-primary" /> Avg Revenue by Business Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insights.averageRevenueByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={insights.averageRevenueByType.map(item => ({
                  ...item,
                  businessType: item.businessType.charAt(0).toUpperCase() + item.businessType.slice(1),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="businessType" tick={{ fontSize: '0.846rem' }} />
                  <YAxis tick={{ fontSize: '0.846rem' }} />
                  <Tooltip formatter={(value: number) => formatETB(value)} />
                  <Bar dataKey="averageRevenue" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Avg Revenue" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Cities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe2 className="size-4 text-primary" /> Top Cities
            </CardTitle>
            <CardDescription>Where most shops are located</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.topCities.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {insights.topCities.map((c, i) => (
                  <div key={i} className="text-center p-3 rounded-lg border bg-muted/30">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                      <span className="text-sm font-bold text-primary">{i + 1}</span>
                    </div>
                    <p className="font-medium text-sm">{c.city || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{c.shopCount} shops</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Business Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" /> Business Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insights.businessTypeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={insights.businessTypeDistribution.map(item => ({
                      type: item.businessType.charAt(0).toUpperCase() + item.businessType.slice(1),
                      count: item.count,
                    }))}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={75}
                    paddingAngle={4} dataKey="count"
                    label={isMobile ? ({ count }: { count: number }) => count : ({ type, count }: { type: string; count: number }) => `${type} (${count})`}
                  >
                    {insights.businessTypeDistribution.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alerts */}
      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-5 text-red-500" /> Low Stock Alerts
          </CardTitle>
          <CardDescription>Products running low across shops — supply opportunity</CardDescription>
        </CardHeader>
        <CardContent>
          {insights.lowStockProducts.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {insights.lowStockProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-red-50/50 dark:bg-red-900/10">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                      <Store className="size-4 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        <span className="text-muted-foreground">🏪</span> {p.orgName} needs <strong>{p.productName}</strong>
                      </p>
                      <p className="text-xs text-muted-foreground">{p.category} · only {p.quantity} left</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-red-700 bg-red-100 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                    {p.quantity} left
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No low stock alerts</p>
          )}
        </CardContent>
      </Card>
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
        { dedupingInterval: 10_000 } // 10s dedupe for health data
      )
      setHealth(data)
      setLastRefresh(new Date())
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + auto-refresh every 30 seconds
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
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    )
  }

  if (!health) {
    if (error) {
      return (
        <ErrorState
          title="Failed to load system health"
          message={error}
          onRetry={() => { setLoading(true); fetchHealth() }}
        />
      )
    }
    return (
      <EmptyState
        title="No health data"
        message="System health data is not available."
      />
    )
  }

  const isHealthy = health.status === 'healthy'
  const isDegraded = health.status === 'degraded'
  const memUsagePercent = health.memory.heapTotalMB > 0
    ? Math.round((health.memory.heapUsedMB / health.memory.heapTotalMB) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Status Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Server Status */}
        <Card className={isHealthy ? 'border-emerald-200 dark:border-emerald-900/50' : isDegraded ? 'border-amber-200 dark:border-amber-900/50' : 'border-red-200 dark:border-red-900/50'}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`size-8 sm:size-10 rounded-lg flex items-center justify-center shrink-0 ${
                isHealthy ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                isDegraded ? 'bg-amber-100 dark:bg-amber-900/30' :
                'bg-red-100 dark:bg-red-900/30'
              }`}>
                <Server className={`size-4 sm:size-5 ${
                  isHealthy ? 'text-emerald-600' :
                  isDegraded ? 'text-amber-600' :
                  'text-red-600'
                }`} />
              </div>
              <div className="min-w-0">
                <p className="text-[0.846rem] sm:text-xs text-muted-foreground">Server Status</p>
                <div className="flex items-center gap-1.5">
                  {isHealthy ? <CheckCircle2 className="size-3.5 sm:size-4 text-emerald-600" /> :
                   isDegraded ? <AlertCircle className="size-3.5 sm:size-4 text-amber-600" /> :
                   <XCircle className="size-3.5 sm:size-4 text-red-600" />}
                  <p className="text-sm sm:text-base font-semibold capitalize">{health.status}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Latency */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="size-8 sm:size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Database className="size-4 sm:size-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[0.846rem] sm:text-xs text-muted-foreground">DB Latency</p>
                <p className="text-sm sm:text-base font-semibold">
                  {health.database.latencyMs}ms
                </p>
                <Badge variant="outline" className={`text-[0.769rem] px-1 py-0 mt-0.5 ${
                  health.database.status === 'connected'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}>
                  {health.database.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="size-8 sm:size-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <Clock className="size-4 sm:size-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[0.846rem] sm:text-xs text-muted-foreground">Uptime</p>
                <p className="text-sm sm:text-base font-semibold">{health.uptime.formatted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cache Entries */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="size-8 sm:size-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0">
                <Zap className="size-4 sm:size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[0.846rem] sm:text-xs text-muted-foreground">Cache Entries</p>
                <p className="text-sm sm:text-base font-semibold">{health.cache.totalEntries}</p>
                <p className="text-[0.769rem] text-muted-foreground">{health.cache.namespaces} namespaces</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Memory Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="size-4 text-primary" /> Memory Usage
            </CardTitle>
            <CardDescription>Node.js process memory allocation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Heap usage bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Heap Used</span>
                <span className="font-medium">{health.memory.heapUsedMB} / {health.memory.heapTotalMB} MB</span>
              </div>
              <Progress value={memUsagePercent} className={`h-3 ${memUsagePercent > 80 ? '[&>[data-slot=progress-indicator]]:bg-red-500' : memUsagePercent > 60 ? '[&>[data-slot=progress-indicator]]:bg-amber-500' : '[&>[data-slot=progress-indicator]]:bg-emerald-500'}`} />
              <p className="text-xs text-muted-foreground">{memUsagePercent}% utilized</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground">RSS</p>
                <p className="text-sm font-semibold">{health.memory.rssMB} MB</p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground">External</p>
                <p className="text-sm font-semibold">{health.memory.externalMB} MB</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cache Namespaces */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="size-4 text-primary" /> Cache Namespaces
            </CardTitle>
            <CardDescription>Netflix EVCache-style multi-layer cache</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(health.cache.details).length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(health.cache.details).map(([ns, count]) => (
                  <div key={ns} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-sm font-mono truncate">{ns}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0 ml-2">{count} entries</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No cache entries</p>
            )}
            <div className="mt-3 p-2 rounded-lg bg-muted/30 text-xs text-muted-foreground">
              Hit Rate: {health.cache.hitRate}
            </div>
          </CardContent>
        </Card>

        {/* Rate Limit Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Rate Limiting
            </CardTitle>
            <CardDescription>Google API-style token bucket rate limits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <span className="text-sm text-muted-foreground">Active Buckets</span>
                <span className="text-sm font-semibold">{health.rateLimit.activeBuckets}</span>
              </div>
              {Object.keys(health.rateLimit.details).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(health.rateLimit.details).map(([prefix, count]) => (
                    <div key={prefix} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                      <div className="flex items-center gap-2">
                        <ArrowDownUp className="size-3.5 text-amber-500" />
                        <span className="text-sm font-mono">{prefix}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">{count} buckets</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">No active rate limit buckets</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Circuit Breaker States */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Circuit Breakers
            </CardTitle>
            <CardDescription>Netflix Hystrix-style resilience patterns</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(health.resilience.circuits).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(health.resilience.circuits).map(([key, circuit]) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center gap-2">
                      <div className={`size-2.5 rounded-full ${
                        circuit.state === 'closed' ? 'bg-emerald-500' :
                        circuit.state === 'open' ? 'bg-red-500' :
                        'bg-amber-500'
                      }`} />
                      <span className="text-sm font-mono">{key}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[0.769rem] px-1.5 py-0 ${
                        circuit.state === 'closed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' :
                        circuit.state === 'open' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                      }`} variant="outline">
                        {circuit.state}
                      </Badge>
                      {circuit.failureCount > 0 && (
                        <span className="text-xs text-red-600 dark:text-red-400">
                          {circuit.failureCount} failures
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">All circuits closed (healthy)</p>
            )}

            {Object.keys(health.resilience.bulkheads).length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Bulkheads</p>
                {Object.entries(health.resilience.bulkheads).map(([key, bh]) => (
                  <div key={key} className="flex items-center justify-between p-2 rounded-lg border bg-muted/10 text-sm">
                    <span className="font-mono text-xs">{key}</span>
                    <span className="text-xs text-muted-foreground">
                      {bh.active} active / {bh.queued} queued
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Applied Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="size-4 text-primary" /> Applied Traffic Optimization Patterns
          </CardTitle>
          <CardDescription>
            Industry-proven patterns from Netflix, Google, and YouTube
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {health.patterns.applied.map((pattern, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/20">
                <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap className="size-3 text-primary" />
                </div>
                <span className="text-sm">{pattern}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Last Refresh */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
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
// Activity Log Tab
// ============================================
type ActivityEventType = 'organization' | 'user' | 'announcement'

interface ActivityEvent {
  id: string
  type: ActivityEventType
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
  description: string
  timestamp: string
}

function ActivityLogTab() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | ActivityEventType>('all')

  const fetchEvents = useCallback(async () => {
    setError(null)
    try {
      const [orgsRes, usersRes, announcementsRes] = await Promise.allSettled([
        api.getAdminOrganizations({ limit: 10 }),
        api.getAdminUsers({ limit: 10 }),
        api.getAdminAnnouncements({ limit: 10 }),
      ])

      const allEvents: ActivityEvent[] = []

      // Process organizations
      if (orgsRes.status === 'fulfilled') {
        for (const org of orgsRes.value.organizations) {
          allEvents.push({
            id: `org-${org.id}`,
            type: 'organization',
            icon: Building2,
            iconBg: 'bg-brand-50 dark:bg-brand-900/20',
            iconColor: 'text-primary',
            title: 'New organization registered',
            description: `${org.name}${org.businessType ? ` · ${org.businessType}` : ''}`,
            timestamp: org.createdAt,
          })
        }
      }

      // Process users
      if (usersRes.status === 'fulfilled') {
        for (const user of usersRes.value.users) {
          allEvents.push({
            id: `user-${user.id}`,
            type: 'user',
            icon: Users,
            iconBg: 'bg-blue-100 dark:bg-blue-900/30',
            iconColor: 'text-blue-600',
            title: 'User joined',
            description: `${user.name}${user.email ? ` · ${user.email}` : ''}`,
            timestamp: user.createdAt,
          })
        }
      }

      // Process announcements
      if (announcementsRes.status === 'fulfilled') {
        for (const ann of announcementsRes.value.announcements) {
          allEvents.push({
            id: `ann-${ann.id}`,
            type: 'announcement',
            icon: Megaphone,
            iconBg: 'bg-rose-100 dark:bg-rose-900/30',
            iconColor: 'text-rose-600',
            title: 'Announcement sent',
            description: ann.title,
            timestamp: ann.createdAt,
          })
        }
      }

      // Sort by date, most recent first
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setEvents(allEvents)
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => e.type === filter)

  const filterOptions: Array<{ value: 'all' | ActivityEventType; label: string; icon: React.ElementType }> = [
    { value: 'all', label: 'All', icon: Filter },
    { value: 'organization', label: 'Organizations', icon: Building2 },
    { value: 'user', label: 'Users', icon: Users },
    { value: 'announcement', label: 'Announcements', icon: Megaphone },
  ]

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
        <Card>
          <CardContent className="p-4 space-y-4">
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
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load activity log"
        message={error}
        onRetry={() => { setLoading(true); fetchEvents() }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map(opt => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setFilter(opt.value)}
          >
            <opt.icon className="size-3.5" />
            {opt.label}
            {opt.value !== 'all' && (
              <Badge variant="secondary" className="ml-1 text-[0.769rem] px-1 py-0">
                {events.filter(e => e.type === opt.value).length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="size-4 text-primary" /> Activity Timeline
          </CardTitle>
          <CardDescription>
            {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEvents.length > 0 ? (
            <div className="relative max-h-[calc(100vh-300px)] overflow-y-auto">
              {/* Timeline line */}
              <div className="absolute left-[1.385rem] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-1">
                {filteredEvents.map(event => (
                  <div key={event.id} className="relative flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors group">
                    {/* Icon */}
                    <div className={`size-9 rounded-lg ${event.iconBg} flex items-center justify-center shrink-0 z-10 ring-2 ring-background`}>
                      <event.icon className={`size-4 ${event.iconColor}`} />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{event.title}</p>
                        <Badge variant="outline" className="text-[0.769rem] px-1.5 py-0 capitalize shrink-0">
                          {event.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.description}</p>
                    </div>
                    {/* Timestamp */}
                    <div className="text-right shrink-0 ml-2 pt-0.5">
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateWithTime(event.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No events found"
              message={filter === 'all' ? 'There is no platform activity yet.' : `No ${filter} events found. Try a different filter.`}
            />
          )}
        </CardContent>
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[30.769rem]" />
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={<ShieldCheck />}
          title="Admin Dashboard"
          subtitle="Platform overview and market intelligence"
        />
        {error ? (
          <ErrorState
            title="Failed to load dashboard"
            message={error}
            onRetry={() => fetchData(true)}
          />
        ) : (
          <EmptyState
            title="No data available"
            message="Dashboard data could not be loaded."
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<ShieldCheck />}
        title="Admin Dashboard"
        subtitle={selectedRegionId ? `Filtered to ${dashboardData.regionInfo?.name || 'selected region'}` : 'Platform overview and market intelligence'}
        badges={
          <>
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-[0.769rem] px-1.5 py-0.5 gap-1">
              <Zap className="size-3" />
              Optimized
            </Badge>
            {dashboardData.regionInfo && (
              <span className="text-primary text-sm font-medium">· {dashboardData.regionInfo.name}</span>
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
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            className={`shrink-0 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              !selectedRegionId
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-card-foreground border-border hover:bg-muted/50'
            }`}
            onClick={() => setSelectedRegionId(null)}
          >
            All
          </button>
          {regions.map(region => (
            <button
              key={region.id}
              className={`shrink-0 px-4 py-2 rounded-lg border text-sm transition-colors ${
                selectedRegionId === region.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-card-foreground border-border hover:bg-muted/50'
              }`}
              onClick={() => setSelectedRegionId(region.id)}
            >
              <span className="font-medium">{region.name}</span>
              <span className={`ml-1.5 text-xs ${selectedRegionId === region.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                ({region.orgCount ?? 0})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Regions Comparison */}
      {dashboardData.regionsBreakdown && dashboardData.regionsBreakdown.length > 1 && !selectedRegionId && (
        <Card className="border-brand-100 dark:border-brand-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe2 className="size-4 text-primary" /> Regional Breakdown
            </CardTitle>
            <CardDescription>Compare performance across cities</CardDescription>
          </CardHeader>
          <CardContent>
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
                        <span className="text-xs font-semibold">{region.orgCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Revenue</span>
                        <span className="text-xs font-semibold">{formatETB(region.revenue)}</span>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

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
            <Activity className="size-4" /><span className="hidden sm:inline">System Health</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5 text-xs sm:text-sm">
            <Activity className="size-4" />
            <span className="hidden sm:inline">Activity Log</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <OverviewTab data={dashboardData} />
        </TabsContent>

        {/* Map Tab */}
        <TabsContent value="map" className="mt-4">
          <ShopsMapTab shops={shopsData} />
        </TabsContent>

        {/* Intelligence Tab */}
        <TabsContent value="intelligence" className="mt-4">
          <MarketIntelligenceTab regionId={selectedRegionId} />
        </TabsContent>

        {/* System Health Tab */}
        <TabsContent value="health" className="mt-4">
          <SystemHealthTab />
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="mt-4">
          <ActivityLogTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

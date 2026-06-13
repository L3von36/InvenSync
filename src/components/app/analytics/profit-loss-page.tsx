'use client'

import { useEffect, useState, useCallback } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw,
  ArrowUpDown,
  Loader2,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from '@/components/ui/recharts-exports'
import { api } from '@/lib/api-client'
import { getNetworkErrorMessage } from '@/lib/validation'
import { ErrorState } from '@/components/shared/error-states'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ============================================
// Types
// ============================================

interface ProfitLossData {
  revenue: number
  costOfGoods: number
  grossProfit: number
  grossMargin: number
  totalDiscount: number
  totalTax: number
  expenses: number
  netProfit: number
  monthlyBreakdown: Array<{
    month: string
    revenue: number
    cost: number
    expenses: number
    profit: number
  }>
  expenseBreakdown: Array<{
    category: string
    amount: number
  }>
  profitTrend: Array<{
    date: string
    profit: number
    grossProfit: number
  }>
  topProducts: Array<{
    id: string
    name: string
    sku?: string | null
    revenue: number
    cost: number
    profit: number
    quantity: number
    margin: number
  }>
}

type DateRange = 'this_month' | 'last_month' | 'last_3_months' | 'custom'

// ============================================
// Helpers
// ============================================

const etbFormatter = new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB' })
const formatETB = (val: number) => etbFormatter.format(val)

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${MONTH_LABELS[month] || month} ${year.slice(2)}`
}

function formatDateLabel(dateKey: string): string {
  const d = new Date(dateKey)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const PIE_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#ca8a04']

const CATEGORY_LABELS: Record<string, string> = {
  rent: 'Rent',
  salary: 'Salary',
  utilities: 'Utilities',
  marketing: 'Marketing',
  supplies: 'Supplies',
  transport: 'Transport',
  other: 'Other',
}

function getDateRange(range: DateRange): { from: string; to: string } {
  const now = new Date()
  const toDate = now.toISOString().split('T')[0]

  switch (range) {
    case 'this_month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      return { from, to: toDate }
    }
    case 'last_month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
      const to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
      return { from, to }
    }
    case 'last_3_months': {
      const from = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0]
      return { from, to: toDate }
    }
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: toDate }
  }
}

// ============================================
// KPI Card
// ============================================

function KPICard({
  title, value, icon, trend, description, isLoading,
}: {
  title: string
  value: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  description?: string
  isLoading?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">{title}</p>
              <p className="text-sm sm:text-lg md:text-xl font-bold tracking-tight">{value}</p>
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <div className={`size-9 sm:size-10 rounded-xl flex items-center justify-center shrink-0 ${
              trend === 'up' ? 'bg-emerald-100 text-emerald-600' :
              trend === 'down' ? 'bg-red-100 text-red-600' :
              'bg-muted text-muted-foreground'
            }`}>
              {icon}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Component
// ============================================

export function ProfitLossPage() {
  const { currentOrg } = useAuthStore()
  const isMobile = useIsMobile()
  const [data, setData] = useState<ProfitLossData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('this_month')

  const fetchData = useCallback(async () => {
    if (!currentOrg) return
    setIsLoading(true)
    setError(null)
    try {
      const { from, to } = getDateRange(dateRange)
      const response = await fetch(
        `/api/analytics/profit-loss?organizationId=${currentOrg.id}&from=${from}&to=${to}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('sb_token')}` } }
      )
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to fetch profit & loss data')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [currentOrg, dateRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (error) {
    return <ErrorState title="Failed to load Profit & Loss" message={error} onRetry={fetchData} />
  }

  const grossMargin = data?.grossMargin ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profit & Loss</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Financial overview for {currentOrg?.name || 'your organization'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_3_months">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <KPICard
          title="Total Revenue"
          value={formatETB(data?.revenue ?? 0)}
          icon={<DollarSign className="size-5" />}
          trend="up"
          isLoading={isLoading}
        />
        <KPICard
          title="Cost of Goods"
          value={formatETB(data?.costOfGoods ?? 0)}
          icon={<TrendingDown className="size-5" />}
          trend="down"
          isLoading={isLoading}
        />
        <KPICard
          title="Gross Profit"
          value={formatETB(data?.grossProfit ?? 0)}
          icon={<TrendingUp className="size-5" />}
          trend={data?.grossProfit && data.grossProfit > 0 ? 'up' : 'down'}
          isLoading={isLoading}
        />
        <KPICard
          title="Gross Margin"
          value={`${grossMargin.toFixed(1)}%`}
          icon={<BarChart3 className="size-5" />}
          trend={grossMargin > 0 ? 'up' : 'down'}
          description={grossMargin > 50 ? 'Healthy margin' : grossMargin > 20 ? 'Moderate margin' : 'Low margin'}
          isLoading={isLoading}
        />
        <KPICard
          title="Total Expenses"
          value={formatETB(data?.expenses ?? 0)}
          icon={<TrendingDown className="size-5" />}
          trend="down"
          isLoading={isLoading}
        />
        <KPICard
          title="Net Profit"
          value={formatETB(data?.netProfit ?? 0)}
          icon={data?.netProfit && data.netProfit > 0
            ? <ArrowUpRight className="size-5" />
            : <ArrowDownRight className="size-5" />
          }
          trend={data?.netProfit && data.netProfit > 0 ? 'up' : 'down'}
          isLoading={isLoading}
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="revenue-cost" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue-cost">Revenue vs Cost</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="profit-trend">Profit Trend</TabsTrigger>
        </TabsList>

        {/* Revenue vs Cost Bar Chart */}
        <TabsContent value="revenue-cost">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue vs Cost Breakdown</CardTitle>
              <CardDescription>Monthly revenue, cost of goods, and expenses comparison</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[350px] w-full" />
              ) : (data?.monthlyBreakdown ?? []).length === 0 ? (
                <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
                  No sales data available for this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={(data?.monthlyBreakdown ?? []).map(d => ({
                    ...d,
                    month: formatMonthLabel(d.month),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => formatETB(value)}
                      contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cost" name="Cost of Goods" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expense Breakdown Pie Chart */}
        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expense Breakdown</CardTitle>
              <CardDescription>Distribution of expenses by category</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[350px] w-full" />
              ) : (data?.expenseBreakdown ?? []).length === 0 ? (
                <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
                  No expense data available for this period
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row items-center gap-6">
                  <div className="w-full lg:w-1/2">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={(data?.expenseBreakdown ?? []).map(d => ({
                            ...d,
                            category: CATEGORY_LABELS[d.category] || d.category,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          dataKey="amount"
                          nameKey="category"
                          label={({ category, percent }) => `${category} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={true}
                        >
                          {(data?.expenseBreakdown ?? []).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatETB(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full lg:w-1/2 space-y-3">
                    {(data?.expenseBreakdown ?? []).map((item, idx) => (
                      <div key={item.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="size-3 rounded-full"
                            style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                          />
                          <span className="text-sm font-medium">
                            {CATEGORY_LABELS[item.category] || item.category}
                          </span>
                        </div>
                        <span className="text-sm font-semibold">{formatETB(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profit Trend Line Chart */}
        <TabsContent value="profit-trend">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profit Trend</CardTitle>
              <CardDescription>Daily gross profit and net profit trend</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[350px] w-full" />
              ) : (data?.profitTrend ?? []).length === 0 ? (
                <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
                  No profit data available for this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={(data?.profitTrend ?? []).map(d => ({
                    ...d,
                    date: formatDateLabel(d.date),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => formatETB(value)}
                      contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="grossProfit"
                      name="Gross Profit"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      name="Net Profit"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top Profitable Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Profitable Products</CardTitle>
          <CardDescription>Products with the highest profit in the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (data?.topProducts ?? []).length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              No product sales data available for this period
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {(data?.topProducts ?? []).map((product, idx) => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">#{idx + 1}</Badge>
                      <span className="font-medium text-sm">{product.name}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>Revenue: {formatETB(product.revenue)}</span>
                      <span>Profit: {formatETB(product.profit)}</span>
                    </div>
                  </div>
                  <Badge variant={product.margin > 30 ? 'default' : 'secondary'} className="text-xs">
                    {product.margin.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Qty Sold</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.topProducts ?? []).map((product, idx) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground">{product.sku || '—'}</TableCell>
                    <TableCell className="text-right">{formatETB(product.revenue)}</TableCell>
                    <TableCell className="text-right">{formatETB(product.cost)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatETB(product.profit)}</TableCell>
                    <TableCell className="text-right">{product.quantity}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={product.margin > 30 ? 'default' : 'secondary'}>
                        {product.margin.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

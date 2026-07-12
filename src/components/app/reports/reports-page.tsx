'use client'

import { PageHeader } from '@/components/shared/design-system'

import { useState, useEffect, useCallback } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  DollarSign, TrendingUp, ShoppingCart, BarChart3,
  Package, PieChart, ArrowUpRight, ArrowDownRight, Calendar, Download
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart as RechartsPie, Pie, Cell
} from '@/components/ui/recharts-exports'
import { getNetworkErrorMessage } from '@/lib/validation'
import { exportToCSV } from '@/lib/export-utils'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { formatETB } from '@/lib/format'
import { formatShortETB } from '@/lib/currency'

// ============================================
// Helpers
// ============================================

const CHART_COLORS = [
  'oklch(0.637 0.237 25.331)',  // orange (brand)
  'oklch(0.6 0.118 184.704)',  // teal
  'oklch(0.592 0.172 142.495)', // green
  'oklch(0.627 0.265 303.9)',   // purple
  'oklch(0.645 0.246 16.439)',  // red
  'oklch(0.769 0.188 70.08)',   // amber
  'oklch(0.55 0.19 25)',        // dark orange
  'oklch(0.592 0.214 105.38)',  // lime
]

function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Cash',
    card: 'Card',
    mobile_money: 'Mobile Money',
    bank_transfer: 'Bank Transfer',
    credit: 'Credit',
  other: 'Other',
  }
  return labels[method] || method.charAt(0).toUpperCase() + method.slice(1)
}

// ============================================
// Types
// ============================================
interface ReportData {
  period: { start: string; end: string; type: string }
  summary: {
    totalRevenue: number
    totalCost: number
    totalProfit: number
    totalSales: number
    averageSaleValue: number
  }
  salesByDate: Array<{
    date: string
    revenue: number
    cost: number
    profit: number
    count: number
  }>
  bestSellingProducts: Array<{
    id: string
    name: string
    sku?: string | null
    sellingPrice: number
    totalRevenue: number
    totalQuantity: number
    salesCount: number
  }>
  paymentMethodBreakdown: Array<{
    method: string
    count: number
    revenue: number
  }>
  inventoryValuation: {
    totalItems: number
    totalCostValue: number
    totalRetailValue: number
    potentialProfit: number
  }
}

// ============================================
// Main Component
// ============================================
export function ReportsPage() {
  const { currentOrg, currentShop } = useAuthStore()
  const orgId = currentOrg?.id || ''
  const isMobile = useIsMobile()

  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('sales')

  // Date range
  const [periodType, setPeriodType] = useState('monthly')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const getDateRange = useCallback(() => {
    const now = new Date()
    let startDate: string
    let endDate: string = now.toISOString().split('T')[0]

    switch (periodType) {
      case 'today':
        startDate = endDate
        break
      case 'weekly': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        startDate = weekAgo.toISOString().split('T')[0]
        break
      }
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        break
      case 'quarterly': {
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0]
        break
      }
      case 'custom':
        startDate = customStart || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        endDate = customEnd || now.toISOString().split('T')[0]
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    }
    return { startDate, endDate }
  }, [periodType, customStart, customEnd])

  const fetchReport = useCallback(async () => {
    if (!orgId) return

    // Date range validation for custom period
    if (periodType === 'custom' && customStart && customEnd) {
      if (new Date(customStart) > new Date(customEnd)) {
        setDateError('Start date must be before end date')
        return
      }
    }
    setDateError(null)
    setPageError(null)
    setLoading(true)
    try {
      const { startDate, endDate } = getDateRange()
      const data = await api.getReports(orgId, {
        startDate,
        endDate,
        period: periodType === 'custom' ? 'daily' : periodType,
        shopId: currentShop?.id,
      })
      setReportData(data as unknown as ReportData)
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setPageError(msg)
    } finally {
      setLoading(false)
    }
  }, [orgId, getDateRange, periodType, currentShop])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const summary = reportData?.summary
  const salesByDate = reportData?.salesByDate || []
  const bestSelling = reportData?.bestSellingProducts || []
  const inventoryVal = reportData?.inventoryValuation

  const handleExportCSV = useCallback(() => {
    if (!reportData) return

    if (activeTab === 'sales') {
      exportToCSV(
        salesByDate.map(row => ({
          date: row.date,
          invoice: row.count,
          customer: '',
          total: row.revenue,
          status: '',
          paymentMethod: '',
        })),
        'sales-report',
        [
          { key: 'date', label: 'Date' },
          { key: 'invoice', label: 'Transactions' },
          { key: 'customer', label: 'Customer' },
          { key: 'total', label: 'Total' },
          { key: 'status', label: 'Status' },
          { key: 'paymentMethod', label: 'Payment Method' },
        ]
      )
    } else if (activeTab === 'profit') {
      exportToCSV(
        salesByDate.map(row => ({
          date: row.date,
          revenue: row.revenue,
          cost: row.cost,
          profit: row.profit,
          margin: row.revenue > 0 ? ((row.profit / row.revenue) * 100).toFixed(1) + '%' : '0%',
        })),
        'profit-report',
        [
          { key: 'date', label: 'Date' },
          { key: 'revenue', label: 'Revenue' },
          { key: 'cost', label: 'Cost' },
          { key: 'profit', label: 'Profit' },
          { key: 'margin', label: 'Margin' },
        ]
      )
    } else if (activeTab === 'inventory') {
      const val = reportData.inventoryValuation
      exportToCSV(
        [{
          productName: 'All Inventory',
          type: 'Summary',
          quantity: val?.totalItems || 0,
          costPrice: val?.totalCostValue || 0,
          sellingPrice: val?.totalRetailValue || 0,
          value: val?.totalRetailValue || 0,
        }],
        'inventory-report',
        [
          { key: 'productName', label: 'Product Name' },
          { key: 'type', label: 'Type' },
          { key: 'quantity', label: 'Quantity' },
          { key: 'costPrice', label: 'Cost Price' },
          { key: 'sellingPrice', label: 'Selling Price' },
          { key: 'value', label: 'Value' },
        ]
      )
    } else if (activeTab === 'bestsellers') {
      exportToCSV(
        bestSelling.map(p => ({
          productName: p.name,
          sku: p.sku || '',
          quantitySold: p.totalQuantity,
          revenue: p.totalRevenue,
          avgPrice: p.totalQuantity > 0 ? p.totalRevenue / p.totalQuantity : 0,
        })),
        'bestsellers-report',
        [
          { key: 'productName', label: 'Product Name' },
          { key: 'sku', label: 'SKU' },
          { key: 'quantitySold', label: 'Quantity Sold' },
          { key: 'revenue', label: 'Revenue' },
          { key: 'avgPrice', label: 'Avg Price' },
        ]
      )
    }
  }, [activeTab, reportData, salesByDate, bestSelling])

  // Payment method distribution derived from real sales data
  const paymentMethodData = (reportData?.paymentMethodBreakdown || []).reduce((acc, item) => {
    const label = paymentMethodLabel(item.method)
    const existing = acc.find(entry => entry.name === label)
    if (existing) existing.value += item.count
    else acc.push({ name: label, value: item.count })
    return acc
  }, [] as { name: string; value: number }[])

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<BarChart3 />}
        title="Reports"
        subtitle="Analyze your sales, profit, and inventory performance"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!reportData || salesByDate.length === 0}
            className="gap-2"
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />

      {/* Date Range Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Period:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: 'today', label: 'Today' },
                { value: 'weekly', label: 'This Week' },
                { value: 'monthly', label: 'This Month' },
                { value: 'quarterly', label: 'This Quarter' },
                { value: 'custom', label: 'Custom' },
              ].map((p) => (
                <Button
                  key={p.value}
                  variant={periodType === p.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPeriodType(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {periodType === 'custom' && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">From</Label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => { setCustomStart(e.target.value); setDateError(null) }}
                    className="h-8 text-xs w-36"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">To</Label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => { setCustomEnd(e.target.value); setDateError(null) }}
                    className="h-8 text-xs w-36"
                  />
                </div>
              </div>
            )}
            {dateError && (
              <p className="w-full text-xs text-destructive">{dateError}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="sales" className="gap-1 text-xs sm:text-sm px-1 sm:px-3">
            <ShoppingCart className="size-3.5 sm:size-4" />
            <span className="hidden sm:inline">Sales</span>
          </TabsTrigger>
          <TabsTrigger value="profit" className="gap-1 text-xs sm:text-sm px-1 sm:px-3">
            <TrendingUp className="size-3.5 sm:size-4" />
            <span className="hidden sm:inline">Profit</span>
          </TabsTrigger>
          <TabsTrigger value="bestsellers" className="gap-1 text-xs sm:text-sm px-1 sm:px-3">
            <BarChart3 className="size-3.5 sm:size-4" />
            <span className="hidden sm:inline">Best</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1 text-xs sm:text-sm px-1 sm:px-3">
            <Package className="size-3.5 sm:size-4" />
            <span className="hidden sm:inline">Inventory</span>
          </TabsTrigger>
        </TabsList>

        {/* Sales Report */}
        <TabsContent value="sales" className="space-y-4">
          {loading ? (
            <LoadingSkeleton cards={3} />
          ) : pageError && !reportData ? (
            <ErrorState title="Failed to load report data" message={pageError} onRetry={fetchReport} />
          ) : !loading && reportData && salesByDate.length === 0 ? (
            <EmptyState
              title="No sales data for this period"
              message="Try selecting a different date range, or make your first sale to see reports here."
              icon={<BarChart3 className="size-7 text-muted-foreground" />}
            />
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                        <DollarSign className="size-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-xl sm:text-2xl font-semibold tabular-nums">{formatETB(summary?.totalRevenue || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <ShoppingCart className="size-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Transactions</p>
                        <p className="text-xl sm:text-2xl font-semibold tabular-nums">{summary?.totalSales || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <TrendingUp className="size-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Transaction</p>
                        <p className="text-xl sm:text-2xl font-semibold tabular-nums">{formatETB(summary?.averageSaleValue || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
                {/* Daily Sales Bar Chart */}
                <Card className="lg:col-span-2 overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Daily Sales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {salesByDate.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={salesByDate}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(val: string) => {
                              const d = new Date(val)
                              return `${d.getMonth() + 1}/${d.getDate()}`
                            }}
                          />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(val: number) => formatShortETB(val)} />
                          <Tooltip
                            formatter={(value: number) => formatETB(value)}
                            labelFormatter={(label: string) => {
                              const d = new Date(label)
                              return d.toLocaleDateString('en-US', {
                                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                              })
                            }}
                          />
                          <Legend />
                          <Bar dataKey="revenue" name="Revenue" fill="oklch(0.637 0.237 25.331)" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="profit" name="Profit" fill="oklch(0.6 0.118 184.704)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart message="No sales data for this period" />
                    )}
                  </CardContent>
                </Card>

                {/* Payment Method Pie */}
                <Card className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">By Payment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPie>
                        <Pie
                          data={paymentMethodData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, percent }: { name: string; percent: number }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {paymentMethodData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Sales Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Daily Sales Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Transactions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesByDate.length > 0 ? (
                          salesByDate.map((row) => (
                            <TableRow key={row.date}>
                              <TableCell className="font-medium">
                                {new Date(row.date).toLocaleDateString('en-US', {
                                  weekday: 'short', month: 'short', day: 'numeric'
                                })}
                              </TableCell>
                              <TableCell className="text-right">{formatETB(row.revenue)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{formatETB(row.cost)}</TableCell>
                              <TableCell className="text-right">
                                <span className={row.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                  {formatETB(row.profit)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{row.count}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              No sales data for this period
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile card view */}
                  <div className="md:hidden space-y-3 p-3 max-h-96 overflow-y-auto">
                    {salesByDate.length > 0 ? (
                      salesByDate.map((row) => (
                        <Card key={row.date} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-sm">
                              {new Date(row.date).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric'
                              })}
                            </p>
                            <span className="text-xs text-muted-foreground">{row.count} txns</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-muted-foreground">Revenue:</span> <span className="font-medium">{formatETB(row.revenue)}</span></div>
                            <div><span className="text-muted-foreground">Cost:</span> <span className="text-muted-foreground">{formatETB(row.cost)}</span></div>
                            <div><span className="text-muted-foreground">Profit:</span> <span className={`font-bold ${row.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatETB(row.profit)}</span></div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No sales data for this period</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Profit Report */}
        <TabsContent value="profit" className="space-y-4">
          {loading ? (
            <LoadingSkeleton cards={4} />
          ) : pageError && !reportData ? (
            <ErrorState title="Failed to load report data" message={pageError} onRetry={fetchReport} />
          ) : !loading && reportData && salesByDate.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingUp className="size-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-base font-semibold mb-1">No profit data for this period</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Try selecting a different date range, or make your first sale to see profit reports here
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                        <DollarSign className="size-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Gross Revenue</p>
                        <p className="text-xl sm:text-2xl font-semibold tabular-nums">{formatETB(summary?.totalRevenue || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <ArrowDownRight className="size-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Cost</p>
                        <p className="text-xl sm:text-2xl font-semibold tabular-nums">{formatETB(summary?.totalCost || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                        <ArrowUpRight className="size-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Gross Profit</p>
                        <p className="text-xl sm:text-2xl font-semibold tabular-nums">{formatETB(summary?.totalProfit || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <TrendingUp className="size-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Profit Margin</p>
                        <p className="text-xl sm:text-2xl font-semibold tabular-nums">
                          {summary && summary.totalRevenue > 0
                            ? `${((summary.totalProfit / summary.totalRevenue) * 100).toFixed(1)}%`
                            : '0%'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Profit Trend Line Chart */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Profit Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {salesByDate.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={salesByDate}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(val: string) => {
                            const d = new Date(val)
                            return `${d.getMonth() + 1}/${d.getDate()}`
                          }}
                        />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(val: number) => formatShortETB(val)} />
                        <Tooltip
                          formatter={(value: number) => formatETB(value)}
                          labelFormatter={(label: string) => {
                            const d = new Date(label)
                            return d.toLocaleDateString('en-US', {
                              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                            })
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          name="Revenue"
                          stroke="oklch(0.637 0.237 25.331)"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="profit"
                          name="Profit"
                          stroke="oklch(0.6 0.118 184.704)"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="cost"
                          name="Cost"
                          stroke="oklch(0.769 0.188 70.08)"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          strokeDasharray="5 5"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart message="No profit data for this period" />
                  )}
                </CardContent>
              </Card>

              {/* Daily Profit Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Daily Profit Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesByDate.length > 0 ? (
                          salesByDate.map((row) => (
                            <TableRow key={row.date}>
                              <TableCell className="font-medium">
                                {new Date(row.date).toLocaleDateString('en-US', {
                                  weekday: 'short', month: 'short', day: 'numeric'
                                })}
                              </TableCell>
                              <TableCell className="text-right">{formatETB(row.revenue)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{formatETB(row.cost)}</TableCell>
                              <TableCell className="text-right font-medium">
                                <span className={row.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                  {formatETB(row.profit)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant="outline"
                                  className={
                                    row.revenue > 0 && row.profit >= 0
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700'
                                      : row.profit < 0
                                        ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
                                        : ''
                                  }
                                >
                                  {row.revenue > 0
                                    ? `${((row.profit / row.revenue) * 100).toFixed(1)}%`
                                    : '0%'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              No data for this period
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile card view */}
                  <div className="md:hidden space-y-3 p-3 max-h-96 overflow-y-auto">
                    {salesByDate.length > 0 ? (
                      salesByDate.map((row) => (
                        <Card key={row.date} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-sm">
                              {new Date(row.date).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric'
                              })}
                            </p>
                            <Badge
                              variant="outline"
                              className={
                                row.revenue > 0 && row.profit >= 0
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700 text-xs'
                                  : row.profit < 0
                                    ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700 text-xs'
                                    : 'text-xs'
                              }
                            >
                              {row.revenue > 0 ? `${((row.profit / row.revenue) * 100).toFixed(1)}%` : '0%'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-muted-foreground">Revenue:</span> <span className="font-medium">{formatETB(row.revenue)}</span></div>
                            <div><span className="text-muted-foreground">Cost:</span> <span className="text-muted-foreground">{formatETB(row.cost)}</span></div>
                            <div><span className="text-muted-foreground">Profit:</span> <span className={`font-bold ${row.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatETB(row.profit)}</span></div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Best Sellers */}
        <TabsContent value="bestsellers" className="space-y-4">
          {loading ? (
            <LoadingSkeleton cards={2} />
          ) : pageError && !reportData ? (
            <ErrorState title="Failed to load report data" message={pageError} onRetry={fetchReport} />
          ) : !loading && reportData && bestSelling.length === 0 ? (
            <EmptyState
              title="No product sales data for this period"
              message="Try selecting a different date range, or sell some products to see best sellers here."
              icon={<Package className="size-7 text-muted-foreground" />}
            />
          ) : (
            <>
              {/* Top 10 by Revenue Chart */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Top 10 Products by Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  {bestSelling.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={bestSelling.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(val: number) => formatShortETB(val)} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          width={isMobile ? 70 : 120}
                        />
                        <Tooltip formatter={(value: number) => formatETB(value)} />
                        <Bar dataKey="totalRevenue" name="Revenue" fill="oklch(0.637 0.237 25.331)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart message="No product sales data for this period" />
                  )}
                </CardContent>
              </Card>

              {/* Top 10 by Quantity Chart */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Top 10 Products by Quantity Sold</CardTitle>
                </CardHeader>
                <CardContent>
                  {bestSelling.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart
                        data={[...bestSelling].sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 10)}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={isMobile ? 70 : 120} />
                        <Tooltip />
                        <Bar dataKey="totalQuantity" name="Quantity" fill="oklch(0.6 0.118 184.704)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart message="No product sales data for this period" />
                  )}
                </CardContent>
              </Card>

              {/* Best Sellers Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Product Performance</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Product Name</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Quantity Sold</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Avg Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bestSelling.length > 0 ? (
                          bestSelling.map((product, i) => (
                            <TableRow key={product.id}>
                              <TableCell>
                                <Badge variant="secondary" className="size-6 p-0 flex items-center justify-center text-xs">
                                  {i + 1}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">{product.name}</TableCell>
                              <TableCell className="text-muted-foreground">{product.sku || '—'}</TableCell>
                              <TableCell className="text-right">{product.totalQuantity}</TableCell>
                              <TableCell className="text-right">{formatETB(product.totalRevenue)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatETB(product.totalQuantity > 0 ? product.totalRevenue / product.totalQuantity : 0)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No product sales data for this period
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile card view */}
                  <div className="md:hidden space-y-3 p-3 max-h-96 overflow-y-auto">
                    {bestSelling.length > 0 ? (
                      bestSelling.map((product, i) => (
                        <Card key={product.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <Badge variant="secondary" className="size-6 p-0 flex items-center justify-center text-xs shrink-0 mt-0.5">
                              {i + 1}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.sku || '—'}</p>
                              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                <div><span className="text-muted-foreground">Qty:</span> <span className="font-medium">{product.totalQuantity}</span></div>
                                <div><span className="text-muted-foreground">Revenue:</span> <span className="font-medium">{formatETB(product.totalRevenue)}</span></div>
                                <div className="col-span-2"><span className="text-muted-foreground">Avg:</span> {formatETB(product.totalQuantity > 0 ? product.totalRevenue / product.totalQuantity : 0)}</div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No product sales data for this period</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Inventory Valuation */}
        <TabsContent value="inventory" className="space-y-4">
          {loading ? (
            <LoadingSkeleton cards={3} />
          ) : pageError && !reportData ? (
            <ErrorState title="Failed to load report data" message={pageError} onRetry={fetchReport} />
          ) : !loading && reportData && (inventoryVal?.totalItems || 0) === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="size-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-base font-semibold mb-1">No inventory data yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Add products to your inventory to see valuation reports here
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                        <DollarSign className="size-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Cost Value</p>
                        <p className="text-xl sm:text-2xl font-semibold tabular-nums">{formatETB(inventoryVal?.totalCostValue || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <ShoppingCart className="size-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Retail Value</p>
                        <p className="text-xl sm:text-2xl font-semibold tabular-nums">{formatETB(inventoryVal?.totalRetailValue || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <TrendingUp className="size-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Potential Profit</p>
                        <p className="text-xl sm:text-2xl font-semibold tabular-nums">{formatETB(inventoryVal?.potentialProfit || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <Package className="size-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Items</p>
                        <p className="text-xl sm:text-2xl font-semibold tabular-nums">{inventoryVal?.totalItems || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Inventory by Category Pie */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Inventory Value Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPie>
                      <Pie
                        data={[
                          { name: 'Cost Value', value: inventoryVal?.totalCostValue || 0 },
                          { name: 'Potential Profit', value: inventoryVal?.potentialProfit || 0 },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, value }: { name: string; value: number }) => `${name}: ${formatShortETB(value)}`}
                      >
                        <Cell fill="oklch(0.398 0.07 227.392)" />
                        <Cell fill="oklch(0.508 0.14 160)" />
                      </Pie>
                      <Tooltip formatter={(value: number) => formatETB(value)} />
                      <Legend />
                    </RechartsPie>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Products Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Inventory Valuation Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Shows total inventory value at cost and retail prices
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <Card className="bg-muted/50">
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">Total at Cost</p>
                        <p className="text-sm font-semibold">{formatETB(inventoryVal?.totalCostValue || 0)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">Total at Retail</p>
                        <p className="text-sm font-semibold">{formatETB(inventoryVal?.totalRetailValue || 0)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">Profit Margin</p>
                        <p className="text-sm font-semibold">
                          {inventoryVal && inventoryVal.totalRetailValue > 0
                            ? `${((inventoryVal.potentialProfit / inventoryVal.totalRetailValue) * 100).toFixed(1)}%`
                            : '0%'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================
// Helpers
// ============================================
function LoadingSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
      <PieChart className="size-12 mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

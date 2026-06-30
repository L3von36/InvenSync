'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Sparkles,
  BarChart3,
  Calendar,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  Package,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Legend,
} from '@/components/ui/recharts-exports'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { getNetworkErrorMessage } from '@/lib/validation'
import { ErrorState } from '@/components/shared/error-states'
import { formatETB } from '@/lib/format'

// ============================================
// Types
// ============================================
interface ForecastPoint {
  date: string
  predictedRevenue: number
  lowerBound: number
  upperBound: number
}

interface ProductForecast {
  productId: string
  productName: string
  predictedUnits: number
  predictedRevenue: number
  trend: 'up' | 'down' | 'stable'
}

interface ForecastResult {
  forecast: ForecastPoint[]
  trend: 'up' | 'down' | 'stable'
  growthRate: number
  confidenceLevel: 'high' | 'medium' | 'low'
  predictedTotalRevenue: number
  keyFactors: string[]
  productBreakdown: ProductForecast[]
  source: 'ai' | 'rule-based'
  analyzedAt: string
}

type ForecastPeriod = 'week' | 'month' | 'quarter'

// ============================================
// Trend Icon
// ============================================
function TrendIcon({ trend, className = '' }: { trend: string; className?: string }) {
  if (trend === 'up') return <TrendingUp className={`size-4 text-green-600 dark:text-green-400 ${className}`} />
  if (trend === 'down') return <TrendingDown className={`size-4 text-red-600 dark:text-red-400 ${className}`} />
  return <Minus className={`size-4 text-muted-foreground ${className}`} />
}

// ============================================
// Custom Chart Tooltip
// ============================================
function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const currency = 'ETB'
  const dateStr = label ? new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-medium mb-1">{dateStr}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">
            {entry.dataKey === 'predictedRevenue' ? 'Predicted' :
             entry.dataKey === 'lowerBound' ? 'Lower Bound' :
             entry.dataKey === 'upperBound' ? 'Upper Bound' : entry.dataKey}:
          </span>
          <span className="font-medium">
            {Number(entry.value).toLocaleString()} {currency}
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================
// Sales Forecast Page
// ============================================
export function SalesForecastPage() {
  const { currentOrg } = useAuthStore()
  const [result, setResult] = useState<ForecastResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [period, setPeriod] = useState<ForecastPeriod>('month')
  const [fetchError, setFetchError] = useState<string | null>(null)

  const runForecast = useCallback(async (p: ForecastPeriod) => {
    if (!currentOrg || isLoading) return

    setIsLoading(true)
    setFetchError(null)
    try {
      const data = await api.getSalesForecast(currentOrg.id, p) as unknown as ForecastResult
      setResult(data)
      toast.success('Forecast generated', {
        description: `Prediction for next ${p} powered by ${data.source === 'ai' ? 'AI' : 'rule-based engine'}`,
      })
    } catch (err) {
      console.error('Sales forecast failed', err)
      setFetchError(getNetworkErrorMessage(err))
      toast.error('Forecast failed', { description: getNetworkErrorMessage(err) })
    } finally {
      setIsLoading(false)
    }
  }, [currentOrg, isLoading])

  const handleRetry = () => {
    setFetchError(null)
    runForecast(period)
  }

  const handlePeriodChange = useCallback((value: string) => {
    const newPeriod = value as ForecastPeriod
    setPeriod(newPeriod)
    runForecast(newPeriod)
  }, [runForecast])

  // Chart data
  const chartData = useMemo(() => {
    if (!result) return []
    return result.forecast.map(f => ({
      date: f.date,
      predictedRevenue: Math.round(f.predictedRevenue),
      lowerBound: Math.round(f.lowerBound),
      upperBound: Math.round(f.upperBound),
    }))
  }, [result])

  const currency = currentOrg?.currency || 'ETB'

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  const confidenceConfig = {
    high: { label: 'High', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-950/30' },
    medium: { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-950/30' },
    low: { label: 'Low', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-950/30' },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" />
            Sales Forecast
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            AI-powered sales predictions based on your historical data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <span className="text-xs text-muted-foreground">
              Last: {formatTimestamp(result.analyzedAt)}
            </span>
          )}
          <Button
            onClick={() => runForecast(period)}
            disabled={isLoading || !currentOrg}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <Sparkles className="size-4 mr-1" />
            )}
            {isLoading ? 'Forecasting...' : 'Generate Forecast'}
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <Calendar className="size-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Forecast period:</span>
        <div className="flex gap-1">
          {(['week', 'month', 'quarter'] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              size="sm"
              className={`h-7 text-xs ${period === p ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => handlePeriodChange(p)}
              disabled={isLoading}
            >
              Next {p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {fetchError && (
        <ErrorState title="Failed to load data" message={fetchError} onRetry={handleRetry} />
      )}

      {/* Empty State */}
      {!result && !isLoading && !fetchError && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <BarChart3 className="size-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No Forecast Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Generate a sales forecast to predict future revenue and identify trends in your business.
            </p>
            <Button
              onClick={() => runForecast(period)}
              disabled={!currentOrg}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Sparkles className="size-4 mr-1" />
              Generate Forecast
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-8 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-64 bg-muted rounded" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results */}
      {result && !isLoading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="size-3.5 text-primary" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Predicted Revenue</span>
                </div>
                <p className="text-xl font-bold">
                  {formatETB(result.predictedTotalRevenue, { decimals: 0 })}
                </p>
                <p className="text-[10px] text-muted-foreground">{currency}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`size-7 rounded-full flex items-center justify-center ${
                    result.trend === 'up' ? 'bg-green-100 dark:bg-green-950/30' :
                    result.trend === 'down' ? 'bg-red-100 dark:bg-red-950/30' :
                    'bg-gray-100 dark:bg-gray-950/30'
                  }`}>
                    <TrendIcon trend={result.trend} className="size-3.5" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Trend Direction</span>
                </div>
                <p className="text-xl font-bold capitalize">{result.trend}</p>
                <p className="text-[10px] text-muted-foreground">
                  {result.trend === 'up' ? 'Revenue trending up' :
                   result.trend === 'down' ? 'Revenue trending down' :
                   'Revenue is stable'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-7 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                    {result.growthRate >= 0 ? (
                      <ArrowUpRight className="size-3.5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <ArrowDownRight className="size-3.5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Growth Rate</span>
                </div>
                <p className={`text-xl font-bold ${
                  result.growthRate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {result.growthRate >= 0 ? '+' : ''}{result.growthRate}%
                </p>
                <p className="text-[10px] text-muted-foreground">vs current period</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`size-7 rounded-full flex items-center justify-center ${
                    confidenceConfig[result.confidenceLevel].bg
                  }`}>
                    <Target className={`size-3.5 ${confidenceConfig[result.confidenceLevel].color}`} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Confidence</span>
                </div>
                <p className={`text-xl font-bold ${confidenceConfig[result.confidenceLevel].color}`}>
                  {confidenceConfig[result.confidenceLevel].label}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {result.source === 'ai' ? '✨ AI-Powered' : '📊 Rule-Based'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Forecast Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Revenue Forecast</CardTitle>
              <CardDescription className="text-xs">
                Predicted daily revenue with confidence interval
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <defs>
                      <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(val: string) => {
                        try {
                          return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        } catch {
                          return val
                        }
                      }}
                      interval={Math.max(0, Math.floor(chartData.length / 7) - 1)}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(val: number) => `${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 10 }}
                      formatter={(value: string) => {
                        if (value === 'predictedRevenue') return 'Predicted Revenue'
                        if (value === 'upperBound') return 'Upper Bound'
                        if (value === 'lowerBound') return 'Lower Bound'
                        return value
                      }}
                    />
                    {/* Confidence interval area */}
                    <Area
                      type="monotone"
                      dataKey="upperBound"
                      stroke="none"
                      fill="url(#confidenceGradient)"
                      fillOpacity={1}
                      name="upperBound"
                    />
                    <Area
                      type="monotone"
                      dataKey="lowerBound"
                      stroke="none"
                      fill="hsl(var(--background))"
                      fillOpacity={1}
                      name="lowerBound"
                    />
                    {/* Main prediction line */}
                    <Line
                      type="monotone"
                      dataKey="predictedRevenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
                      name="predictedRevenue"
                    />
                    {/* Bound lines */}
                    <Line
                      type="monotone"
                      dataKey="upperBound"
                      stroke="hsl(var(--primary))"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      strokeOpacity={0.4}
                      dot={false}
                      name="upperBound"
                    />
                    <Line
                      type="monotone"
                      dataKey="lowerBound"
                      stroke="hsl(var(--primary))"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      strokeOpacity={0.4}
                      dot={false}
                      name="lowerBound"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Key Factors & Product Breakdown */}
          <Tabs defaultValue="factors" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-sm">
              <TabsTrigger value="factors" className="text-xs">
                <Lightbulb className="size-3 mr-1" />
                Key Factors
              </TabsTrigger>
              <TabsTrigger value="products" className="text-xs">
                <Package className="size-3 mr-1" />
                Product Forecast
              </TabsTrigger>
            </TabsList>

            <TabsContent value="factors" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Key Factors Influencing Forecast</CardTitle>
                  <CardDescription className="text-xs">
                    Main drivers behind the predicted trend
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.keyFactors.map((factor, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.05 }}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                        </div>
                        <p className="text-sm">{factor}</p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="products" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Product-Level Forecast</CardTitle>
                  <CardDescription className="text-xs">
                    Predicted performance for your top products
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {result.productBreakdown.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No product-level data available for this forecast.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Product</TableHead>
                            <TableHead className="text-xs text-right">Predicted Units</TableHead>
                            <TableHead className="text-xs text-right">Predicted Revenue</TableHead>
                            <TableHead className="text-xs text-center">Trend</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.productBreakdown.map((product, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm font-medium">
                                {product.productName}
                              </TableCell>
                              <TableCell className="text-sm text-right">
                                {product.predictedUnits.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-sm text-right">
                                {formatETB(product.predictedRevenue, { decimals: 0 })} {currency}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <TrendIcon trend={product.trend} />
                                  <span className={`text-xs capitalize ${
                                    product.trend === 'up' ? 'text-green-600 dark:text-green-400' :
                                    product.trend === 'down' ? 'text-red-600 dark:text-red-400' :
                                    'text-muted-foreground'
                                  }`}>
                                    {product.trend}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

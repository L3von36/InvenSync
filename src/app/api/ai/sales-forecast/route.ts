import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { createAI, isAIAvailable } from '@/lib/ai'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'
import { cache, CacheNamespaces, CacheTTL } from '@/lib/cache'

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
}

// POST /api/ai/sales-forecast
export async function POST(request: Request) {
  try {
    // AI rate limiting
    const rateLimitResult = applyRateLimit(request, RateLimitTiers.AI)
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { organizationId, period = 'month' } = body

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      )
    }

    if (!['week', 'month', 'quarter'].includes(period)) {
      return NextResponse.json(
        { error: 'period must be "week", "month", or "quarter"' },
        { status: 400 }
      )
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check cache before expensive computation
    const cacheKey = `forecast:${organizationId}:${period}`
    const cached = cache.get<Record<string, unknown>>(CacheNamespaces.AI_SALES_FORECAST, cacheKey)
    if (cached) {
      if (!cached.isStale) {
        return NextResponse.json({ ...cached.data, source: 'cached' })
      }
      // Stale data - return it and trigger background refresh
      cache.swr(CacheNamespaces.AI_SALES_FORECAST, cacheKey, async () => {
        return computeSalesForecast(organizationId, period)
      }, { ttl: CacheTTL.COLD, staleTtl: 60_000 }).catch(() => {})
      return NextResponse.json({ ...cached.data, source: 'cached-stale' })
    }

    // Cache miss - compute and cache result
    const result = await computeSalesForecast(organizationId, period)
    if (result) {
      cache.set(CacheNamespaces.AI_SALES_FORECAST, cacheKey, result, { ttl: CacheTTL.COLD, staleTtl: 60_000 })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Sales forecast error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Extracted computation logic for reuse by cache background refresh
async function computeSalesForecast(organizationId: string, period: string) {
  const now = new Date()
  // Fetch 90 days of historical data for better forecasting
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Fetch historical sales data
  const [
    dailySales,
    last30DaysSales,
    prev30DaysSales,
    topProductsLast30,
    topProductsPrev30,
    orgInfo,
  ] = await Promise.all([
    // Daily sales for last 90 days
    db.sale.findMany({
      where: {
        organizationId,
        saleDate: { gte: ninetyDaysAgo },
        status: 'completed',
      },
      select: {
        total: true,
        saleDate: true,
        items: { select: { productId: true, quantity: true, total: true } },
      },
      orderBy: { saleDate: 'asc' },
    }),

    // Last 30 days aggregate
    db.sale.aggregate({
      where: { organizationId, saleDate: { gte: thirtyDaysAgo }, status: 'completed' },
      _sum: { total: true },
      _count: true,
    }),

    // Previous 30 days aggregate
    db.sale.aggregate({
      where: {
        organizationId,
        saleDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        status: 'completed',
      },
      _sum: { total: true },
      _count: true,
    }),

    // Top products last 30 days (exclude orphaned items whose product was deleted)
    db.saleItem.groupBy({
      by: ['productId'],
      where: {
        productId: { not: null },
        sale: { organizationId, saleDate: { gte: thirtyDaysAgo }, status: 'completed' },
      },
      _sum: { total: true, quantity: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    }),

    // Top products prev 30 days
    db.saleItem.groupBy({
      by: ['productId'],
      where: {
        productId: { not: null },
        sale: { organizationId, saleDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }, status: 'completed' },
      },
      _sum: { total: true, quantity: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    }),

    // Org info
    db.organization.findUnique({
      where: { id: organizationId },
      select: { currency: true, businessType: true },
    }),
  ])

  const currency = orgInfo?.currency || 'ETB'

  // Aggregate daily sales
  const dailyMap = new Map<string, number>()
  for (const sale of dailySales) {
    const dateKey = sale.saleDate.toISOString().split('T')[0]
    dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + sale.total)
  }

  const dailyData: Array<{ date: string; revenue: number }> = []
  for (const [date, revenue] of dailyMap) {
    dailyData.push({ date, revenue })
  }
  dailyData.sort((a, b) => a.date.localeCompare(b.date))

  // Get product names for top products
  const allTopProductIds = [...topProductsLast30, ...topProductsPrev30]
    .map(p => p.productId)
    .filter((id): id is string => id !== null)
  const uniqueProductIds = [...new Set(allTopProductIds)]
  const productNames = await db.product.findMany({
    where: { id: { in: uniqueProductIds } },
    select: { id: true, name: true },
  })
  const productNameMap = new Map(productNames.map(p => [p.id, p.name]))

  // Build product comparison data
  const productComparison = topProductsLast30
    .filter((p): p is typeof p & { productId: string } => p.productId !== null)
    .map(p => {
    const prevP = topProductsPrev30.find(pp => pp.productId === p.productId)
    return {
      productId: p.productId,
      productName: productNameMap.get(p.productId) || 'Unknown',
      last30Revenue: p._sum.total || 0,
      last30Units: p._sum.quantity || 0,
      prev30Revenue: prevP?._sum.total || 0,
      prev30Units: prevP?._sum.quantity || 0,
      change: prevP && prevP._sum.total
        ? ((p._sum.total || 0) - prevP._sum.total) / prevP._sum.total * 100
        : 100,
    }
  })

  // Build context for AI
  const last30Revenue = last30DaysSales._sum.total || 0
  const prev30Revenue = prev30DaysSales._sum.total || 0
  const revenueTrend = prev30Revenue > 0
    ? ((last30Revenue - prev30Revenue) / prev30Revenue * 100).toFixed(1)
    : 'N/A'

  const context = `
Historical Sales Data for Forecasting:
- Currency: ${currency}
- Business Type: ${orgInfo?.businessType || 'retail'}
- Forecast Period: ${period}

Recent Performance:
- Last 30 days: ${last30DaysSales._count} sales, ${last30Revenue.toLocaleString()} ${currency}
- Previous 30 days: ${prev30DaysSales._count} sales, ${prev30Revenue.toLocaleString()} ${currency}
- Trend: ${revenueTrend}%

Daily Sales (last 90 days):
${dailyData.map(d => `${d.date}: ${d.revenue.toLocaleString()} ${currency}`).join('\n')}

Top Products (last 30 days):
${productComparison.map(p => `- ${p.productName}: ${p.last30Units} units, ${p.last30Revenue.toLocaleString()} ${currency} (prev: ${p.prev30Revenue.toLocaleString()} ${currency}, change: ${p.change.toFixed(1)}%)`).join('\n')}
`.trim()

  // Try AI-based forecasting
  if (isAIAvailable()) {
    try {
      const ai = await createAI()
      const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 90

      const systemPrompt = `You are an AI sales forecasting system for an inventory management platform. Analyze the historical sales data and generate a ${period}-day sales forecast. Return a JSON object with:
- forecast: array of objects, each with:
  - date: ISO date string (YYYY-MM-DD)
  - predictedRevenue: number (estimated daily revenue)
  - lowerBound: number (pessimistic estimate)
  - upperBound: number (optimistic estimate)
- trend: "up" | "down" | "stable"
- growthRate: number (percentage, e.g. 5.2 for 5.2% growth)
- confidenceLevel: "high" | "medium" | "low"
- keyFactors: array of strings describing what's influencing the forecast
- productBreakdown: array of objects with productId, productName, predictedUnits, predictedRevenue, trend

Generate ${periodDays} forecast data points starting from tomorrow. Consider day-of-week patterns, recent trends, and seasonality if visible. The forecast should be realistic based on the historical data.

Return ONLY the JSON object, no other text.`

      const response = await ai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context },
        ],
      })

      const textContent = response.choices?.[0]?.message?.content || String(response)
      const jsonMatch = (textContent as string).match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.forecast && Array.isArray(parsed.forecast)) {
          const result: ForecastResult = {
            forecast: parsed.forecast.map((f: Record<string, unknown>) => ({
              date: f.date as string,
              predictedRevenue: Number(f.predictedRevenue) || 0,
              lowerBound: Number(f.lowerBound) || 0,
              upperBound: Number(f.upperBound) || 0,
            })),
            trend: parsed.trend || 'stable',
            growthRate: Number(parsed.growthRate) || 0,
            confidenceLevel: parsed.confidenceLevel || 'medium',
            predictedTotalRevenue: parsed.forecast.reduce(
              (sum: number, f: Record<string, unknown>) => sum + (Number(f.predictedRevenue) || 0), 0
            ),
            keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors : [],
            productBreakdown: Array.isArray(parsed.productBreakdown)
              ? parsed.productBreakdown.map((p: Record<string, unknown>) => ({
                  productId: p.productId || '',
                  productName: p.productName || 'Unknown',
                  predictedUnits: Number(p.predictedUnits) || 0,
                  predictedRevenue: Number(p.predictedRevenue) || 0,
                  trend: p.trend || 'stable',
                }))
              : [],
          }
          return {
            ...result,
            source: 'ai',
            analyzedAt: new Date().toISOString(),
          }
        }
      }
    } catch (err) {
      console.error('AI sales forecast failed, falling back to rule-based:', err)
    }
  }

  // Rule-based fallback forecasting
  const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 90

  // Calculate daily average from recent data
  const recentDailyRevenue = dailyData.slice(-30)
  const avgDailyRevenue = recentDailyRevenue.length > 0
    ? recentDailyRevenue.reduce((sum, d) => sum + d.revenue, 0) / recentDailyRevenue.length
    : 0

  // Calculate trend (simple linear regression on last 30 days)
  let trendSlope = 0
  if (recentDailyRevenue.length >= 7) {
    const n = recentDailyRevenue.length
    const xMean = (n - 1) / 2
    const yMean = recentDailyRevenue.reduce((s, d) => s + d.revenue, 0) / n
    let num = 0
    let den = 0
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (recentDailyRevenue[i].revenue - yMean)
      den += (i - xMean) * (i - xMean)
    }
    trendSlope = den !== 0 ? num / den : 0
  }

  // Calculate day-of-week patterns
  const dayOfWeekAverages: number[] = new Array(7).fill(0)
  const dayOfWeekCounts: number[] = new Array(7).fill(0)
  for (const d of dailyData) {
    const dayOfWeek = new Date(d.date).getDay()
    dayOfWeekAverages[dayOfWeek] += d.revenue
    dayOfWeekCounts[dayOfWeek]++
  }
  for (let i = 0; i < 7; i++) {
    if (dayOfWeekCounts[i] > 0) {
      dayOfWeekAverages[i] /= dayOfWeekCounts[i]
    } else {
      dayOfWeekAverages[i] = avgDailyRevenue
    }
  }

  // Calculate standard deviation for confidence intervals
  const revenues = recentDailyRevenue.map(d => d.revenue)
  const stdDev = revenues.length > 1
    ? Math.sqrt(revenues.reduce((sum, r) => sum + Math.pow(r - avgDailyRevenue, 2), 0) / (revenues.length - 1))
    : avgDailyRevenue * 0.3

  // Generate forecast
  const forecast: ForecastPoint[] = []
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  for (let i = 0; i < periodDays; i++) {
    const forecastDate = new Date(tomorrow)
    forecastDate.setDate(forecastDate.getDate() + i)

    const dayOfWeek = forecastDate.getDay()
    const dayAdjustment = dayOfWeekAverages[dayOfWeek] / avgDailyRevenue
    const trendAdjustment = trendSlope * i * 0.3 // Dampen trend

    const predictedRevenue = Math.max(0,
      avgDailyRevenue * dayAdjustment + trendAdjustment
    )

    const confidenceWidth = stdDev * (1 + i * 0.02) // Wider interval further out

    forecast.push({
      date: forecastDate.toISOString().split('T')[0],
      predictedRevenue: Math.round(predictedRevenue),
      lowerBound: Math.round(Math.max(0, predictedRevenue - confidenceWidth)),
      upperBound: Math.round(predictedRevenue + confidenceWidth),
    })
  }

  // Determine overall trend
  const lastDayForecast = forecast[forecast.length - 1].predictedRevenue
  const firstDayForecast = forecast[0].predictedRevenue
  const overallTrend = lastDayForecast > firstDayForecast * 1.05
    ? 'up' as const
    : lastDayForecast < firstDayForecast * 0.95
      ? 'down' as const
      : 'stable' as const

  const growthRate = firstDayForecast > 0
    ? ((lastDayForecast - firstDayForecast) / firstDayForecast * 100)
    : 0

  const predictedTotalRevenue = forecast.reduce((sum, f) => sum + f.predictedRevenue, 0)

  // Determine confidence level based on data quality
  const confidenceLevel: 'high' | 'medium' | 'low' =
    recentDailyRevenue.length >= 21 ? 'high'
    : recentDailyRevenue.length >= 7 ? 'medium'
    : 'low'

  // Key factors
  const keyFactors: string[] = []
  if (trendSlope > 0) keyFactors.push('Positive sales trend over the last 30 days')
  else if (trendSlope < 0) keyFactors.push('Declining sales trend over the last 30 days')
  else keyFactors.push('Stable sales pattern')

  if (revenueTrend !== 'N/A') {
    keyFactors.push(`Month-over-month revenue change: ${revenueTrend}%`)
  }

  const weekdayAvg = (dayOfWeekAverages[1] + dayOfWeekAverages[2] + dayOfWeekAverages[3] + dayOfWeekAverages[4] + dayOfWeekAverages[5]) / 5
  const weekendAvg = (dayOfWeekAverages[0] + dayOfWeekAverages[6]) / 2
  if (weekdayAvg > weekendAvg * 1.3) {
    keyFactors.push('Higher sales on weekdays compared to weekends')
  } else if (weekendAvg > weekdayAvg * 1.3) {
    keyFactors.push('Higher sales on weekends compared to weekdays')
  }

  if (stdDev > avgDailyRevenue * 0.5) {
    keyFactors.push('High sales volatility may affect forecast accuracy')
  }

  keyFactors.push(`Based on ${recentDailyRevenue.length} days of historical data`)

  // Product breakdown
  const productBreakdown: ProductForecast[] = productComparison.slice(0, 10).map(p => ({
    productId: p.productId,
    productName: p.productName,
    predictedUnits: Math.round(p.last30Units / 30 * periodDays),
    predictedRevenue: Math.round(p.last30Revenue / 30 * periodDays),
    trend: p.change > 10 ? 'up' as const : p.change < -10 ? 'down' as const : 'stable' as const,
  }))

  const result: ForecastResult = {
    forecast,
    trend: overallTrend,
    growthRate: Math.round(growthRate * 10) / 10,
    confidenceLevel,
    predictedTotalRevenue,
    keyFactors,
    productBreakdown,
  }

  return {
    ...result,
    source: 'rule-based',
    analyzedAt: new Date().toISOString(),
  }
}

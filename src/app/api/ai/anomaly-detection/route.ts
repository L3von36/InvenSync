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
interface Anomaly {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: string
  title: string
  description: string
  affectedEntity: string
  entityId?: string
  recommendation: string
  detectedAt: string
}

// POST /api/ai/anomaly-detection
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
    const { organizationId } = body

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      )
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check cache before expensive computation
    const cacheKey = `anomaly:${organizationId}`
    const cached = cache.get<Record<string, unknown>>(CacheNamespaces.AI_ANOMALY_DETECTION, cacheKey)
    if (cached) {
      if (!cached.isStale) {
        return NextResponse.json({ ...cached.data, source: 'cached' })
      }
      // Stale data - return it and trigger background refresh
      cache.swr(CacheNamespaces.AI_ANOMALY_DETECTION, cacheKey, async () => {
        return computeAnomalyDetection(organizationId)
      }, { ttl: CacheTTL.COLD, staleTtl: 60_000 }).catch(() => {})
      return NextResponse.json({ ...cached.data, source: 'cached-stale' })
    }

    // Cache miss - compute and cache result
    const result = await computeAnomalyDetection(organizationId)
    if (result) {
      cache.set(CacheNamespaces.AI_ANOMALY_DETECTION, cacheKey, result, { ttl: CacheTTL.COLD, staleTtl: 60_000 })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Anomaly detection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Extracted computation logic for reuse by cache background refresh
async function computeAnomalyDetection(organizationId: string) {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // Fetch all relevant data in parallel
  const [
    products,
    recentStockMovements,
    recentSales,
    monthlyRevenue,
    previousMonthlyRevenue,
    dailySalesLast30Days,
  ] = await Promise.all([
    // All active products with their stock info
    db.product.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        quantity: true,
        costPrice: true,
        sellingPrice: true,
        lowStockThreshold: true,
        createdAt: true,
        saleItems: {
          where: { sale: { saleDate: { gte: thirtyDaysAgo }, status: 'completed' } },
          select: { quantity: true, total: true },
        },
      },
    }),

    // Recent stock movements
    db.stockMovement.findMany({
      where: { organizationId, createdAt: { gte: thirtyDaysAgo } },
      select: {
        id: true,
        productId: true,
        type: true,
        quantity: true,
        previousStock: true,
        newStock: true,
        reason: true,
        createdAt: true,
        product: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Recent sales
    db.sale.findMany({
      where: { organizationId, saleDate: { gte: thirtyDaysAgo }, status: 'completed' },
      select: {
        id: true,
        total: true,
        saleDate: true,
        items: { select: { productId: true, quantity: true, total: true } },
      },
      orderBy: { saleDate: 'desc' },
    }),

    // This month's revenue
    db.sale.aggregate({
      where: {
        organizationId,
        saleDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        status: 'completed',
      },
      _sum: { total: true },
      _count: true,
    }),

    // Previous month's revenue
    db.sale.aggregate({
      where: {
        organizationId,
        saleDate: {
          gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          lt: new Date(now.getFullYear(), now.getMonth(), 1),
        },
        status: 'completed',
      },
      _sum: { total: true },
      _count: true,
    }),

    // Daily sales for last 30 days
    db.sale.groupBy({
      by: ['saleDate'],
      where: {
        organizationId,
        saleDate: { gte: thirtyDaysAgo },
        status: 'completed',
      },
      _sum: { total: true },
      _count: true,
      orderBy: { saleDate: 'asc' },
    }),
  ])

  // Build context for AI analysis
  const outOfStockProducts = products.filter(p => p.quantity === 0)
  const lowStockProducts = products.filter(p => p.quantity > 0 && p.quantity <= p.lowStockThreshold)
  const overstockedProducts = products.filter(p => p.quantity > 100)

  const productSalesData = products.map(p => ({
    name: p.name,
    quantity: p.quantity,
    costPrice: p.costPrice,
    sellingPrice: p.sellingPrice,
    margin: p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice * 100).toFixed(1) : '0',
    unitsSoldLast30: p.saleItems.reduce((sum, i) => sum + i.quantity, 0),
    revenueLast30: p.saleItems.reduce((sum, i) => sum + i.total, 0),
  }))

  const stockDropMovements = recentStockMovements.filter(m =>
    m.type === 'out' && (m.previousStock - m.newStock) > 50
  )

  const thisMonthRevenue = monthlyRevenue._sum.total || 0
  const lastMonthRevenue = previousMonthlyRevenue._sum.total || 0
  const revenueChange = lastMonthRevenue > 0
    ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
    : 'N/A'

  const context = `
Organization Data for Anomaly Detection:
- Total Products: ${products.length}
- Out of Stock Products: ${outOfStockProducts.length} (${outOfStockProducts.map(p => p.name).join(', ') || 'none'})
- Low Stock Products: ${lowStockProducts.length} (${lowStockProducts.map(p => `${p.name} (${p.quantity} left)`).join(', ') || 'none'})
- Overstocked Products (>100 units): ${overstockedProducts.length} (${overstockedProducts.map(p => `${p.name} (${p.quantity})`).join(', ') || 'none'})
- This Month Revenue: ${thisMonthRevenue.toLocaleString()} ETB (${monthlyRevenue._count} sales)
- Last Month Revenue: ${lastMonthRevenue.toLocaleString()} ETB (${previousMonthlyRevenue._count} sales)
- Revenue Change: ${revenueChange}%
- Large Stock Drops (last 30 days): ${stockDropMovements.length} (${stockDropMovements.map(m => `${m.product.name}: ${m.previousStock} → ${m.newStock}`).join(', ') || 'none'})
- Recent Sales (last 30 days): ${recentSales.length} sales
- Daily Sales Data: ${dailySalesLast30Days.map(d => `${d.saleDate.toISOString().split('T')[0]}: ${(d._sum.total || 0).toLocaleString()} ETB (${d._count} sales)`).join('; ') || 'No data'}
- Product Performance: ${productSalesData.slice(0, 20).map(p => `${p.name}: ${p.unitsSoldLast30} sold, ${p.revenueLast30.toLocaleString()} ETB revenue, ${p.margin}% margin, ${p.quantity} in stock`).join('; ')}
`.trim()

  // Try AI-based detection
  if (isAIAvailable()) {
    try {
      const ai = await createAI()
      const systemPrompt = `You are an AI anomaly detection system for an inventory and sales management platform. Analyze the provided business data and detect anomalies. Return a JSON object with an "anomalies" array. Each anomaly should have:
- severity: "critical" | "high" | "medium" | "low"
- type: category like "stock_anomaly", "sales_anomaly", "revenue_anomaly", "pricing_anomaly"
- title: short descriptive title
- description: detailed explanation of what's anomalous
- affectedEntity: name of the affected product/entity
- recommendation: actionable recommendation

Focus on:
1. Unusual stock drops (comparing current vs average movements)
2. Suspicious sales patterns (unusually high/low amounts)
3. Revenue anomalies (sudden spikes or drops compared to previous period)
4. Products with very low or very high margins
5. Products that haven't sold in 30 days despite having stock
6. Sudden changes in sales velocity

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
        if (parsed.anomalies && Array.isArray(parsed.anomalies)) {
          const anomalies: Anomaly[] = parsed.anomalies.map((a: Record<string, unknown>, i: number) => ({
            id: `ai-${i + 1}`,
            severity: a.severity || 'medium',
            type: a.type || 'general',
            title: a.title || 'Anomaly Detected',
            description: a.description || '',
            affectedEntity: a.affectedEntity || 'Unknown',
            entityId: a.entityId,
            recommendation: a.recommendation || '',
            detectedAt: new Date().toISOString(),
          }))
          return { anomalies, source: 'ai', analyzedAt: new Date().toISOString() }
        }
      }
    } catch (err) {
      console.error('AI anomaly detection failed, falling back to rule-based:', err)
    }
  }

  // Rule-based fallback detection
  const anomalies: Anomaly[] = []
  let anomalyId = 1

  // 1. Revenue anomaly - sudden drop or spike
  if (lastMonthRevenue > 0) {
    const changePct = (thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100
    if (changePct < -30) {
      anomalies.push({
        id: `rule-${anomalyId++}`,
        severity: changePct < -50 ? 'critical' : 'high',
        type: 'revenue_anomaly',
        title: 'Significant Revenue Drop',
        description: `Revenue dropped by ${Math.abs(changePct).toFixed(1)}% compared to last month (${lastMonthRevenue.toLocaleString()} → ${thisMonthRevenue.toLocaleString()} ETB).`,
        affectedEntity: 'Organization',
        recommendation: 'Investigate the cause of the revenue drop. Check for lost customers, stock shortages, or market changes. Consider promotions to boost sales.',
        detectedAt: new Date().toISOString(),
      })
    } else if (changePct > 50) {
      anomalies.push({
        id: `rule-${anomalyId++}`,
        severity: 'medium',
        type: 'revenue_anomaly',
        title: 'Unusual Revenue Spike',
        description: `Revenue increased by ${changePct.toFixed(1)}% compared to last month (${lastMonthRevenue.toLocaleString()} → ${thisMonthRevenue.toLocaleString()} ETB).`,
        affectedEntity: 'Organization',
        recommendation: 'Verify the sales data is accurate. If valid, analyze what drove the increase and try to replicate it.',
        detectedAt: new Date().toISOString(),
      })
    }
  }

  // 2. Out of stock products
  if (outOfStockProducts.length > 0) {
    anomalies.push({
      id: `rule-${anomalyId++}`,
      severity: outOfStockProducts.length > 5 ? 'critical' : 'high',
      type: 'stock_anomaly',
      title: `${outOfStockProducts.length} Products Out of Stock`,
      description: `${outOfStockProducts.length} products have zero stock: ${outOfStockProducts.slice(0, 5).map(p => p.name).join(', ')}${outOfStockProducts.length > 5 ? ` and ${outOfStockProducts.length - 5} more` : ''}.`,
      affectedEntity: outOfStockProducts.length === 1 ? outOfStockProducts[0].name : 'Multiple Products',
      recommendation: 'Reorder these products immediately. Set up automatic low stock alerts to prevent future stockouts.',
      detectedAt: new Date().toISOString(),
    })
  }

  // 3. Low stock products
  if (lowStockProducts.length > 3) {
    anomalies.push({
      id: `rule-${anomalyId++}`,
      severity: 'medium',
      type: 'stock_anomaly',
      title: `${lowStockProducts.length} Products at Low Stock`,
      description: `${lowStockProducts.length} products are below their low stock threshold: ${lowStockProducts.slice(0, 5).map(p => `${p.name} (${p.quantity}/${p.lowStockThreshold})`).join(', ')}.`,
      affectedEntity: 'Multiple Products',
      recommendation: 'Review and reorder these products before they run out. Consider increasing reorder points.',
      detectedAt: new Date().toISOString(),
    })
  }

  // 4. Large stock drops
  for (const movement of stockDropMovements.slice(0, 5)) {
    const dropPct = ((movement.previousStock - movement.newStock) / movement.previousStock * 100).toFixed(1)
    anomalies.push({
      id: `rule-${anomalyId++}`,
      severity: Number(dropPct) > 70 ? 'high' : 'medium',
      type: 'stock_anomaly',
      title: `Large Stock Drop: ${movement.product.name}`,
      description: `${movement.product.name} stock dropped from ${movement.previousStock} to ${movement.newStock} (${dropPct}% decrease). Reason: ${movement.reason || 'Not specified'}.`,
      affectedEntity: movement.product.name,
      recommendation: 'Verify this stock movement is legitimate. Check for errors or unauthorized stock removals.',
      detectedAt: new Date().toISOString(),
    })
  }

  // 5. Products with very low margins
  const lowMarginProducts = productSalesData.filter(p => Number(p.margin) < 10 && p.sellingPrice > 0)
  if (lowMarginProducts.length > 0) {
    anomalies.push({
      id: `rule-${anomalyId++}`,
      severity: lowMarginProducts.length > 3 ? 'high' : 'medium',
      type: 'pricing_anomaly',
      title: `${lowMarginProducts.length} Products with Very Low Margins`,
      description: `${lowMarginProducts.length} products have margins below 10%: ${lowMarginProducts.slice(0, 5).map(p => `${p.name} (${p.margin}%)`).join(', ')}.`,
      affectedEntity: 'Multiple Products',
      recommendation: 'Review pricing for these products. Consider raising prices or negotiating better supplier rates.',
      detectedAt: new Date().toISOString(),
    })
  }

  // 6. Products with no sales despite having stock (dead stock)
  const deadStock = productSalesData.filter(p => p.unitsSoldLast30 === 0 && p.quantity > 0)
  if (deadStock.length > 0) {
    anomalies.push({
      id: `rule-${anomalyId++}`,
      severity: deadStock.length > 5 ? 'high' : 'medium',
      type: 'sales_anomaly',
      title: `${deadStock.length} Products with No Sales (Dead Stock)`,
      description: `${deadStock.length} products haven't sold in the last 30 days despite having stock: ${deadStock.slice(0, 5).map(p => `${p.name} (${p.quantity} units)`).join(', ')}.`,
      affectedEntity: 'Multiple Products',
      recommendation: 'Consider running promotions, adjusting prices, or discounting these products to move inventory.',
      detectedAt: new Date().toISOString(),
    })
  }

  // 7. Unusually high single-day sales
  const avgDailySales = dailySalesLast30Days.length > 0
    ? dailySalesLast30Days.reduce((sum, d) => sum + (d._sum.total || 0), 0) / dailySalesLast30Days.length
    : 0

  const highSalesDays = dailySalesLast30Days.filter(d => (d._sum.total || 0) > avgDailySales * 3 && avgDailySales > 0)
  if (highSalesDays.length > 0) {
    anomalies.push({
      id: `rule-${anomalyId++}`,
      severity: 'low',
      type: 'sales_anomaly',
      title: 'Unusually High Sales Days Detected',
      description: `${highSalesDays.length} days had sales more than 3x the daily average (${avgDailySales.toFixed(0)} ETB/day): ${highSalesDays.map(d => `${d.saleDate.toISOString().split('T')[0]} (${(d._sum.total || 0).toLocaleString()} ETB)`).join(', ')}.`,
      affectedEntity: 'Organization',
      recommendation: 'Investigate what caused these spikes. If they coincide with promotions or events, plan similar activities.',
      detectedAt: new Date().toISOString(),
    })
  }

  // 8. Overstocked products
  if (overstockedProducts.length > 0) {
    anomalies.push({
      id: `rule-${anomalyId++}`,
      severity: 'low',
      type: 'stock_anomaly',
      title: `${overstockedProducts.length} Overstocked Products`,
      description: `${overstockedProducts.length} products have more than 100 units: ${overstockedProducts.slice(0, 5).map(p => `${p.name} (${p.quantity} units)`).join(', ')}.`,
      affectedEntity: 'Multiple Products',
      recommendation: 'Consider reducing prices or bundling to move excess inventory. Avoid reordering until stock levels normalize.',
      detectedAt: new Date().toISOString(),
    })
  }

  return {
    anomalies,
    source: 'rule-based',
    analyzedAt: new Date().toISOString(),
  }
}

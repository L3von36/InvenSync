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
interface PriceSuggestion {
  id: string
  productId: string
  productName: string
  currentPrice: number
  costPrice: number
  suggestedPrice: number
  priceChange: number
  priceChangePercent: number
  currentMargin: number
  suggestedMargin: number
  confidence: 'high' | 'medium' | 'low'
  expectedImpact: string
  reasoning: string
  salesVelocity: number
  currentStock: number
}

// POST /api/ai/price-optimization
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
    const { organizationId, productId } = body

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
    const cacheKey = `price-opt:${organizationId}:${productId || 'all'}`
    const cached = cache.get<Record<string, unknown>>(CacheNamespaces.AI_PRICE_OPTIMIZATION, cacheKey)
    if (cached) {
      if (!cached.isStale) {
        return NextResponse.json({ ...cached.data, source: 'cached' })
      }
      // Stale data - return it and trigger background refresh
      cache.swr(CacheNamespaces.AI_PRICE_OPTIMIZATION, cacheKey, async () => {
        return computePriceOptimization(organizationId, productId)
      }, { ttl: CacheTTL.COLD, staleTtl: 60_000 }).catch(() => {})
      return NextResponse.json({ ...cached.data, source: 'cached-stale' })
    }

    // Cache miss - compute and cache result
    const result = await computePriceOptimization(organizationId, productId)
    if (result) {
      cache.set(CacheNamespaces.AI_PRICE_OPTIMIZATION, cacheKey, result, { ttl: CacheTTL.COLD, staleTtl: 60_000 })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Price optimization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Extracted computation logic for reuse by cache background refresh
async function computePriceOptimization(organizationId: string, productId?: string) {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // Fetch products with sales data
  const productWhere = {
    organizationId,
    isActive: true,
    ...(productId ? { id: productId } : {}),
  }

  const products = await db.product.findMany({
    where: productWhere,
    select: {
      id: true,
      name: true,
      quantity: true,
      costPrice: true,
      sellingPrice: true,
      lowStockThreshold: true,
      productType: { select: { name: true } },
      saleItems: {
        where: { sale: { saleDate: { gte: thirtyDaysAgo }, status: 'completed' } },
        select: { quantity: true, total: true, sale: { select: { saleDate: true } } },
      },
    },
    take: productId ? 1 : 50,
  })

  // Fetch org-level data for context
  const [totalSalesLast30, totalSalesPrev30, orgCurrency] = await Promise.all([
    db.sale.aggregate({
      where: { organizationId, saleDate: { gte: thirtyDaysAgo }, status: 'completed' },
      _sum: { total: true },
      _count: true,
    }),
    db.sale.aggregate({
      where: {
        organizationId,
        saleDate: { gte: ninetyDaysAgo, lt: thirtyDaysAgo },
        status: 'completed',
      },
      _sum: { total: true },
      _count: true,
    }),
    db.organization.findUnique({
      where: { id: organizationId },
      select: { currency: true, businessType: true },
    }),
  ])

  const currency = orgCurrency?.currency || 'ETB'
  const businessType = orgCurrency?.businessType || 'retail'

  // Calculate product metrics
  const productMetrics = products.map(p => {
    const unitsSold = p.saleItems.reduce((sum, i) => sum + i.quantity, 0)
    const revenue = p.saleItems.reduce((sum, i) => sum + i.total, 0)
    const currentMargin = p.sellingPrice > 0
      ? ((p.sellingPrice - p.costPrice) / p.sellingPrice * 100)
      : 0
    const dailyVelocity = unitsSold / 30
    const daysOfStock = dailyVelocity > 0 ? Math.round(p.quantity / dailyVelocity) : Infinity

    return {
      id: p.id,
      name: p.name,
      productType: p.productType.name,
      quantity: p.quantity,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      lowStockThreshold: p.lowStockThreshold,
      unitsSoldLast30: unitsSold,
      revenueLast30: revenue,
      currentMargin,
      dailyVelocity,
      daysOfStock,
    }
  })

  // Build context for AI
  const context = `
Organization: ${businessType} business, currency: ${currency}
Last 30 days: ${totalSalesLast30._count} sales, ${(totalSalesLast30._sum.total || 0).toLocaleString()} ${currency} revenue
Previous 30 days: ${totalSalesPrev30._count} sales, ${(totalSalesPrev30._sum.total || 0).toLocaleString()} ${currency} revenue

Product Data for Price Optimization:
${productMetrics.map(p =>
  `- ${p.name} (${p.productType}): Cost ${p.costPrice} ${currency}, Selling ${p.sellingPrice} ${currency}, Margin ${p.currentMargin.toFixed(1)}%, Stock ${p.quantity} units, Sold ${p.unitsSoldLast30} units (30d), Velocity ${p.dailyVelocity.toFixed(1)}/day, ${p.daysOfStock === Infinity ? 'No sales' : `${p.daysOfStock} days of stock`}`
).join('\n')}
`.trim()

  // Try AI-based price optimization
  if (isAIAvailable()) {
    try {
      const ai = await createAI()
      const systemPrompt = `You are an AI pricing optimization system for an inventory management platform. Analyze the provided product data and suggest optimal pricing. Return a JSON object with a "suggestions" array. Each suggestion should have:
- productName: name of the product
- suggestedPrice: the recommended selling price (number)
- confidence: "high" | "medium" | "low"
- expectedImpact: brief description of expected revenue/profit impact
- reasoning: detailed explanation for the price change

Pricing strategies to consider:
1. Low stock items that sell fast → consider raising prices to maximize profit before stock runs out
2. Overstocked items that sell slowly → consider lowering prices to move inventory
3. Items with very low margins → suggest price increases
4. Items with very high margins but low sales → may be priced too high
5. Items with no sales → suggest competitive pricing to stimulate demand
6. Consider cost-price to maintain healthy margins (minimum 15% for most products)

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
        if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
          const suggestions: PriceSuggestion[] = parsed.suggestions.map((s: Record<string, unknown>, i: number) => {
            const product = productMetrics.find(p => p.name === s.productName)
            const suggestedPrice = Number(s.suggestedPrice) || product?.sellingPrice || 0
            const currentPrice = product?.sellingPrice || 0
            const costPrice = product?.costPrice || 0
            const priceChange = suggestedPrice - currentPrice
            const priceChangePercent = currentPrice > 0 ? (priceChange / currentPrice * 100) : 0
            const suggestedMargin = suggestedPrice > 0
              ? ((suggestedPrice - costPrice) / suggestedPrice * 100)
              : 0

            return {
              id: `ai-${i + 1}`,
              productId: product?.id || '',
              productName: s.productName || 'Unknown',
              currentPrice,
              costPrice,
              suggestedPrice,
              priceChange,
              priceChangePercent,
              currentMargin: product?.currentMargin || 0,
              suggestedMargin,
              confidence: s.confidence || 'medium',
              expectedImpact: s.expectedImpact || '',
              reasoning: s.reasoning || '',
              salesVelocity: product?.dailyVelocity || 0,
              currentStock: product?.quantity || 0,
            }
          })
          const totalImpact = suggestions.reduce((sum, s) =>
            sum + s.priceChange * s.salesVelocity * 30, 0)

          return {
            suggestions,
            source: 'ai',
            analyzedAt: new Date().toISOString(),
            summary: {
              totalSuggestions: suggestions.length,
              potentialMonthlyImpact: totalImpact,
              currency,
            },
          }
        }
      }
    } catch (err) {
      console.error('AI price optimization failed, falling back to rule-based:', err)
    }
  }

  // Rule-based fallback
  const suggestions: PriceSuggestion[] = []
  let suggId = 1

  for (const product of productMetrics) {
    // Skip products with no cost price or selling price
    if (product.costPrice <= 0 || product.sellingPrice <= 0) continue

    let suggestedPrice = product.sellingPrice
    let confidence: 'high' | 'medium' | 'low' = 'medium'
    let reasoning = ''
    let expectedImpact = ''

    // 1. Low stock + high velocity → raise price
    if (product.quantity <= product.lowStockThreshold && product.dailyVelocity > 1) {
      const increase = Math.min(product.sellingPrice * 0.1, 500)
      suggestedPrice = Math.round(product.sellingPrice + increase)
      confidence = product.daysOfStock < 7 ? 'high' : 'medium'
      reasoning = `This product has only ${product.quantity} units left (below threshold of ${product.lowStockThreshold}) and sells ${product.dailyVelocity.toFixed(1)}/day. Raising the price maximizes revenue from remaining stock.`
      expectedImpact = `Estimated +${(increase * product.dailyVelocity * 30).toFixed(0)} ${currency}/month`
    }
    // 2. Overstocked + slow sales → lower price
    else if (product.quantity > 100 && product.dailyVelocity < 0.5) {
      const decrease = Math.min(product.sellingPrice * 0.15, 300)
      suggestedPrice = Math.round(product.sellingPrice - decrease)
      confidence = 'medium'
      reasoning = `This product has ${product.quantity} units but only sells ${product.dailyVelocity.toFixed(1)}/day. Lowering the price can help move excess inventory.`
      expectedImpact = `May increase sales velocity by 20-40%`
    }
    // 3. Very low margin → suggest increase
    else if (product.currentMargin < 15 && product.currentMargin > 0) {
      const targetMargin = 20
      suggestedPrice = Math.round(product.costPrice / (1 - targetMargin / 100))
      confidence = 'high'
      reasoning = `Current margin is only ${product.currentMargin.toFixed(1)}%. Suggesting price increase to achieve a healthier ${targetMargin}% margin.`
      expectedImpact = `Margin improvement from ${product.currentMargin.toFixed(1)}% to ~${targetMargin}%`
    }
    // 4. No sales but has stock → suggest competitive pricing
    else if (product.unitsSoldLast30 === 0 && product.quantity > 0) {
      const decrease = Math.min(product.sellingPrice * 0.1, 200)
      suggestedPrice = Math.round(product.sellingPrice - decrease)
      confidence = 'low'
      reasoning = `No sales in the last 30 days despite having ${product.quantity} units in stock. A price reduction might stimulate demand.`
      expectedImpact = `Potential to start generating sales`
    }
    // 5. High margin + low sales → may be overpriced
    else if (product.currentMargin > 60 && product.dailyVelocity < 1) {
      const decrease = Math.min(product.sellingPrice * 0.1, 200)
      suggestedPrice = Math.round(product.sellingPrice - decrease)
      confidence = 'low'
      reasoning = `Very high margin (${product.currentMargin.toFixed(1)}%) but low sales velocity. The product may be priced above market rate.`
      expectedImpact = `May increase sales volume`
    }
    else {
      // No suggestion needed
      continue
    }

    const priceChange = suggestedPrice - product.sellingPrice
    const priceChangePercent = product.sellingPrice > 0
      ? (priceChange / product.sellingPrice * 100) : 0
    const suggestedMargin = suggestedPrice > 0
      ? ((suggestedPrice - product.costPrice) / suggestedPrice * 100) : 0

    suggestions.push({
      id: `rule-${suggId++}`,
      productId: product.id,
      productName: product.name,
      currentPrice: product.sellingPrice,
      costPrice: product.costPrice,
      suggestedPrice,
      priceChange,
      priceChangePercent,
      currentMargin: product.currentMargin,
      suggestedMargin,
      confidence,
      expectedImpact,
      reasoning,
      salesVelocity: product.dailyVelocity,
      currentStock: product.quantity,
    })
  }

  const totalImpact = suggestions.reduce((sum, s) =>
    sum + s.priceChange * s.salesVelocity * 30, 0)

  return {
    suggestions,
    source: 'rule-based',
    analyzedAt: new Date().toISOString(),
    summary: {
      totalSuggestions: suggestions.length,
      potentialMonthlyImpact: totalImpact,
      currency,
    },
  }
}

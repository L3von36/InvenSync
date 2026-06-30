import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { createAI, isAIAvailable } from '@/lib/ai'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'
import { cache, CacheNamespaces, CacheTTL } from '@/lib/cache'

// POST /api/ai/business-assistant
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
    const { orgId, question } = body

    if (!orgId || !question) {
      return NextResponse.json(
        { error: 'orgId and question are required' },
        { status: 400 }
      )
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'ai-business-assistant')
      if (moduleError) return moduleError
    }

    // Check cache before expensive computation
    const questionHash = crypto.createHash('sha256').update(question).digest('hex').slice(0, 16)
    const cacheKey = `assistant:${orgId}:${questionHash}`
    const cached = cache.get<{ answer: string }>(CacheNamespaces.AI_BUSINESS_ASSISTANT, cacheKey)
    if (cached) {
      if (!cached.isStale) {
        return NextResponse.json({ ...cached.data, source: 'cached' })
      }
      // Stale data - return it and trigger background refresh
      cache.swr(CacheNamespaces.AI_BUSINESS_ASSISTANT, cacheKey, async () => {
        return computeBusinessAssistant(orgId, question)
      }, { ttl: CacheTTL.COLD, staleTtl: 60_000 }).catch(() => {})
      return NextResponse.json({ ...cached.data, source: 'cached-stale' })
    }

    // Cache miss - compute and cache result
    const result = await computeBusinessAssistant(orgId, question)
    if (result) {
      cache.set(CacheNamespaces.AI_BUSINESS_ASSISTANT, cacheKey, result, { ttl: CacheTTL.COLD, staleTtl: 60_000 })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('AI business assistant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Extracted computation logic for reuse by cache background refresh
async function computeBusinessAssistant(orgId: string, question: string) {
  // Check if AI service is available in this environment
  if (!isAIAvailable()) {
    // Still fetch data and return it without AI analysis
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [productCount, totalRevenue] = await Promise.all([
      db.product.count({ where: { organizationId: orgId, isActive: true } }),
      db.sale.aggregate({
        where: { organizationId: orgId, saleDate: { gte: monthStart }, status: 'completed' },
        _sum: { total: true }
      }),
    ])

    return {
      answer: `AI features are currently available in the development environment only. Here's your data summary: You have ${productCount} products, and this month's revenue is ${(totalRevenue._sum.total || 0).toLocaleString()} ETB. Full AI analysis will be available when a public AI API endpoint is configured for production.`,
      aiAvailable: false,
    }
  }

  // Fetch relevant org data for context
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    productCount,
    outOfStock,
    recentSales,
    totalRevenue,
    outstandingDebts,
    topProducts,
    lowStockProducts,
  ] = await Promise.all([
    db.product.count({ where: { organizationId: orgId, isActive: true } }),

    db.product.count({
      where: { organizationId: orgId, quantity: 0, isActive: true }
    }),

    db.sale.findMany({
      where: {
        organizationId: orgId,
        saleDate: { gte: weekAgo },
        status: 'completed',
      },
      include: {
        items: {
          include: {
            product: { select: { name: true } }
          }
        }
      },
      orderBy: { saleDate: 'desc' },
      take: 10,
    }),

    db.sale.aggregate({
      where: {
        organizationId: orgId,
        saleDate: { gte: monthStart },
        status: 'completed',
      },
      _sum: { total: true }
    }),

    db.debt.aggregate({
      where: {
        organizationId: orgId,
        status: { in: ['pending', 'partial'] },
      },
      _sum: { amount: true, paidAmount: true }
    }),

    db.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          organizationId: orgId,
          saleDate: { gte: monthStart },
          status: 'completed',
        }
      },
      _sum: { total: true, quantity: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    }).then(async (items) => {
      const results = await Promise.all(
        items.map(async (item) => {
          const product = item.productId
            ? await db.product.findUnique({
                where: { id: item.productId },
                select: { name: true }
              })
            : null
          return {
            name: product?.name || 'Unknown',
            revenue: item._sum.total || 0,
            quantity: item._sum.quantity || 0,
          }
        })
      )
      return results
    }),

    db.product.findMany({
      where: { organizationId: orgId, isActive: true, quantity: { gt: 0, lte: 10 } },
      select: { name: true, quantity: true, lowStockThreshold: true },
      take: 10,
    }),
  ])

  const salesSummary = recentSales.map(s => ({
    date: s.saleDate.toISOString().split('T')[0],
    total: s.total,
    items: s.items.map(i => `${i.quantity}x ${i.product?.name || 'Unknown'}`).join(', '),
  }))

  const context = `
Business Data Context:
- Total Products: ${productCount}
- Out of Stock Products: ${outOfStock}
- This Month's Revenue: ${(totalRevenue._sum.total || 0).toLocaleString()} ETB
- Outstanding Debts: ${((outstandingDebts._sum.amount || 0) - (outstandingDebts._sum.paidAmount || 0)).toLocaleString()} ETB
- Top Products This Month: ${topProducts.map(p => `${p.name} (${p.quantity} sold, ${p.revenue.toLocaleString()} ETB)`).join(', ')}
- Low Stock Products: ${lowStockProducts.map(p => `${p.name} (${p.quantity} left)`).join(', ')}
- Recent Sales (Last 7 days): ${salesSummary.map(s => `${s.date}: ${s.total.toLocaleString()} ETB - ${s.items}`).join('; ')}
`.trim()

  const systemPrompt = `You are a helpful business assistant for an inventory and sales management system. You have access to the following business data for context. Answer the user's question based on this data. If you need information that isn't available, say so. Be concise and actionable.

${context}`

  const ai = await createAI()
  const response = await ai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ]
  })

  const answer = response.choices?.[0]?.message?.content || String(response)

  return { answer }
}

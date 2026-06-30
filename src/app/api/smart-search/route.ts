import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

// ============================================
// POST /api/smart-search - Smart search using AI
// ============================================

interface SearchIntent {
  entities: string[]
  filters: Record<string, unknown>
  sortBy?: string
  limit?: number
}

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
    const { query, organizationId } = body as { query: string; organizationId: string }

    if (!query || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    // Use AI to interpret the natural language query
    const searchIntent = await interpretQuery(query.trim())

    // Execute the search based on the interpreted intent
    const results = await executeSearch(searchIntent, organizationId)

    return NextResponse.json({
      query: query.trim(),
      results,
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Smart search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================
// AI Query Interpretation
// ============================================

async function interpretQuery(query: string): Promise<SearchIntent> {
  // Try using the AI SDK to interpret the query
  try {
    const { createAI } = await import('@/lib/ai')
    const sdk = await createAI()

    const SYSTEM_PROMPT = `You are a search query interpreter for an inventory management system called InvenSync. 
Given a natural language query, extract the search intent and return a JSON object with:
- "entities": array of entity types to search. Possible values: "Product", "Sale", "Customer", "Supplier", "Shop", "User", "Organization"
- "filters": object with filter criteria. Common filters:
  - For Products: lowStock (boolean), minPrice (number), maxPrice (number), name (string), sku (string), isActive (boolean)
  - For Sales: status (string - completed/pending/cancelled), minTotal (number), maxTotal (number), dateFrom (string ISO), dateTo (string ISO)
  - For Customers: hasDebt (boolean), name (string), phone (string), minBalance (number)
  - For Suppliers: name (string), city (string)
- "sortBy": optional sort field (e.g., "quantity_asc", "total_desc", "name_asc", "createdAt_desc")
- "limit": max results to return (default 10, max 50)

IMPORTANT: Return ONLY valid JSON. No markdown, no explanation.
Example query: "products low stock over 500 ETB"
Example response: {"entities":["Product"],"filters":{"lowStock":true,"minPrice":500},"sortBy":"quantity_asc","limit":10}`

    const response = await sdk.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      response_format: { type: 'json_object' },
    })

    const content = response.choices?.[0]?.message?.content
    if (content) {
      const parsed = JSON.parse(content)
      return {
        entities: parsed.entities || ['Product', 'Sale', 'Customer', 'Supplier'],
        filters: parsed.filters || {},
        sortBy: parsed.sortBy,
        limit: Math.min(parsed.limit || 10, 50),
      }
    }
  } catch (err) {
    console.warn('AI interpretation failed, using fallback:', err instanceof Error ? err.message : err)
  }

  // Fallback: simple keyword-based interpretation
  return fallbackInterpretQuery(query)
}

function fallbackInterpretQuery(query: string): SearchIntent {
  const q = query.toLowerCase()
  const entities: string[] = []
  const filters: Record<string, unknown> = {}

  // Detect entity types from keywords
  if (q.includes('product') || q.includes('stock') || q.includes('inventory') || q.includes('item')) {
    entities.push('Product')
  }
  if (q.includes('sale') || q.includes('sold') || q.includes('revenue') || q.includes('order') || q.includes('transaction')) {
    entities.push('Sale')
  }
  if (q.includes('customer') || q.includes('debt') || q.includes('buyer') || q.includes('client')) {
    entities.push('Customer')
  }
  if (q.includes('supplier') || q.includes('vendor') || q.includes('provider')) {
    entities.push('Supplier')
  }
  if (q.includes('shop') || q.includes('store')) {
    entities.push('Shop')
  }

  // If no entities detected, search all
  if (entities.length === 0) {
    entities.push('Product', 'Sale', 'Customer', 'Supplier')
  }

  // Detect filters
  if (q.includes('low stock') || q.includes('low inventory') || q.includes('out of stock')) {
    filters.lowStock = true
  }

  if (q.includes('debt') || q.includes('owe') || q.includes('unpaid') || q.includes('balance')) {
    filters.hasDebt = true
  }

  // Extract price/amount values
  const priceMatch = q.match(/over\s+(\d+)\s*(?:etb|birr)?/i)
  if (priceMatch) {
    filters.minPrice = parseInt(priceMatch[1])
  }

  const underMatch = q.match(/under\s+(\d+)\s*(?:etb|birr)?/i)
  if (underMatch) {
    filters.maxPrice = parseInt(underMatch[1])
  }

  // Detect time ranges
  if (q.includes('today')) {
    filters.dateFrom = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  } else if (q.includes('this week')) {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay())
    filters.dateFrom = d.toISOString()
  } else if (q.includes('this month')) {
    filters.dateFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  }

  return { entities, filters, limit: 10 }
}

// ============================================
// Execute Search Based on Interpreted Intent
// ============================================

async function executeSearch(intent: SearchIntent, organizationId: string) {
  const results: Record<string, unknown[]> = {}
  const limit = intent.limit || 10

  await Promise.all(
    intent.entities.map(async (entity) => {
      try {
        switch (entity) {
          case 'Product':
            results.Product = await searchProducts(intent.filters, organizationId, limit)
            break
          case 'Sale':
            results.Sale = await searchSales(intent.filters, organizationId, limit)
            break
          case 'Customer':
            results.Customer = await searchCustomers(intent.filters, organizationId, limit)
            break
          case 'Supplier':
            results.Supplier = await searchSuppliers(intent.filters, organizationId, limit)
            break
          case 'Shop':
            results.Shop = await searchShops(organizationId, limit)
            break
        }
      } catch (err) {
        console.error(`Error searching ${entity}:`, err)
        results[entity] = []
      }
    })
  )

  return results
}

async function searchProducts(filters: Record<string, unknown>, orgId: string, limit: number) {
  const where: Record<string, unknown> = { organizationId: orgId, isActive: true }

  if (filters.lowStock) {
    where.quantity = { lte: 10 } // low stock threshold
  }

  if (filters.minPrice) {
    where.sellingPrice = { ...(where.sellingPrice as object || {}), gte: filters.minPrice }
  }

  if (filters.maxPrice) {
    where.sellingPrice = { ...(where.sellingPrice as object || {}), lte: filters.maxPrice }
  }

  if (filters.name) {
    where.name = { contains: filters.name as string }
  }

  if (filters.sku) {
    where.sku = { contains: filters.sku as string }
  }

  const products = await db.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      sku: true,
      quantity: true,
      costPrice: true,
      sellingPrice: true,
      lowStockThreshold: true,
      productType: { select: { name: true } },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  })

  return products.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    quantity: p.quantity,
    costPrice: p.costPrice,
    sellingPrice: p.sellingPrice,
    lowStock: p.quantity <= p.lowStockThreshold,
    productType: p.productType?.name || null,
  }))
}

async function searchSales(filters: Record<string, unknown>, orgId: string, limit: number) {
  const where: Record<string, unknown> = { organizationId: orgId }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.minTotal) {
    where.total = { ...(where.total as object || {}), gte: filters.minTotal }
  }

  if (filters.maxTotal) {
    where.total = { ...(where.total as object || {}), lte: filters.maxTotal }
  }

  if (filters.dateFrom || filters.dateTo) {
    const saleDate: Record<string, unknown> = {}
    if (filters.dateFrom) saleDate.gte = new Date(filters.dateFrom as string)
    if (filters.dateTo) saleDate.lte = new Date(filters.dateTo as string)
    where.saleDate = saleDate
  }

  const sales = await db.sale.findMany({
    where,
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      status: true,
      saleDate: true,
      customer: { select: { name: true } },
    },
    take: limit,
    orderBy: { saleDate: 'desc' },
  })

  return sales.map(s => ({
    id: s.id,
    saleNumber: s.invoiceNumber,
    total: s.total,
    status: s.status,
    saleDate: s.saleDate.toISOString(),
    customerName: s.customer?.name || null,
  }))
}

async function searchCustomers(filters: Record<string, unknown>, orgId: string, limit: number) {
  const where: Record<string, unknown> = { organizationId: orgId }

  if (filters.name) {
    where.name = { contains: filters.name as string }
  }

  if (filters.phone) {
    where.phone = { contains: filters.phone as string }
  }

  // A customer's outstanding balance is derived from unpaid customer_debt records
  // (there is no denormalized balance column on Customer).
  if (filters.hasDebt) {
    where.debts = { some: { type: 'customer_debt', status: { not: 'paid' } } }
  }

  const customers = await db.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      debts: {
        where: { type: 'customer_debt', status: { not: 'paid' } },
        select: { amount: true, paidAmount: true },
      },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  })

  let result = customers.map(c => {
    const balance = c.debts.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      balance,
      hasDebt: balance > 0,
    }
  })

  const minBalance = filters.minBalance != null ? Number(filters.minBalance) : null
  if (minBalance != null && !Number.isNaN(minBalance)) {
    result = result.filter(c => c.balance >= minBalance)
  }

  return result
}

async function searchSuppliers(filters: Record<string, unknown>, orgId: string, limit: number) {
  const where: Record<string, unknown> = { organizationId: orgId }

  if (filters.name) {
    where.name = { contains: filters.name as string }
  }

  const suppliers = await db.supplier.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      debts: {
        where: { type: 'supplier_debt', status: { not: 'paid' } },
        select: { amount: true, paidAmount: true },
      },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  })

  return suppliers.map(s => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    email: s.email,
    address: s.address,
    balance: s.debts.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0),
  }))
}

async function searchShops(orgId: string, limit: number) {
  const shops = await db.shop.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      name: true,
      city: true,
      isActive: true,
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  })

  return shops.map(s => ({
    id: s.id,
    name: s.name,
    city: s.city,
    isActive: s.isActive,
  }))
}

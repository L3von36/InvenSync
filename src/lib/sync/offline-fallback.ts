// ============================================
// Offline Fallback — Reconstruct API responses from IndexedDB
// ============================================
// When the network is unavailable, the API client calls
// getOfflineFallback() to reconstruct API responses from
// the local Dexie entity tables. This allows the app to
// function fully offline after the initial bootstrap.
//
// CRITICAL: Every fallback response MUST match the exact
// shape that the real API returns, as defined in api-client.ts
// interfaces. Components access nested fields like shop.members,
// customer._count.sales, sale.customer.name — if these are
// missing, the app crashes with TypeError.
// ============================================

import { db, type LocalCustomer, type LocalSupplier, type LocalSaleItem } from '@/lib/db'

// ============================================
// Helper: Parse query params from endpoint URL
// ============================================

function extractOrgId(url: string): string | null {
  try {
    const urlObj = new URL(url, 'http://localhost')
    return urlObj.searchParams.get('orgId') || urlObj.searchParams.get('organizationId')
  } catch {
    const match = url.match(/orgId=([^&]+)/) || url.match(/organizationId=([^&]+)/)
    return match ? match[1] : null
  }
}

function extractShopId(url: string): string | null {
  try {
    const urlObj = new URL(url, 'http://localhost')
    return urlObj.searchParams.get('shopId')
  } catch {
    const match = url.match(/shopId=([^&]+)/)
    return match ? match[1] : null
  }
}

function extractSearch(url: string): string | null {
  try {
    const urlObj = new URL(url, 'http://localhost')
    return urlObj.searchParams.get('search') || urlObj.searchParams.get('q')
  } catch {
    return null
  }
}

function extractPage(url: string): number {
  try {
    const urlObj = new URL(url, 'http://localhost')
    return parseInt(urlObj.searchParams.get('page') || '1', 10)
  } catch {
    return 1
  }
}

function extractLimit(url: string): number {
  try {
    const urlObj = new URL(url, 'http://localhost')
    return parseInt(urlObj.searchParams.get('limit') || '50', 10)
  } catch {
    return 50
  }
}

function extractStatus(url: string): string | null {
  try {
    const urlObj = new URL(url, 'http://localhost')
    return urlObj.searchParams.get('status')
  } catch {
    return null
  }
}

function extractParam(url: string, param: string): string | null {
  try {
    const urlObj = new URL(url, 'http://localhost')
    return urlObj.searchParams.get(param)
  } catch {
    const match = url.match(new RegExp(`${param}=([^&]+)`))
    return match ? match[1] : null
  }
}

// ============================================
// Helper: Filter by shopId
// ============================================

function filterByShop<T extends { shopId?: string | null }>(items: T[], shopId: string | null): T[] {
  if (!shopId) return items
  return items.filter(item => !item.shopId || item.shopId === shopId)
}

// ============================================
// Pagination shape — MUST match api-client Pagination interface
// { page, limit, total, totalPages }
// ============================================

function makePagination(page: number, limit: number, total: number): {
  page: number
  limit: number
  total: number
  totalPages: number
} {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }
}

// ============================================
// Route Handlers
// ============================================

async function handleDashboard(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const shopId = extractShopId(endpoint)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [products, sales, debts, expenses] = await Promise.all([
    db.products.where('organizationId').equals(orgId).toArray(),
    db.sales.where('organizationId').equals(orgId).toArray(),
    db.debts.where('organizationId').equals(orgId).toArray(),
    db.expenses.where('organizationId').equals(orgId).toArray(),
  ])

  const filteredProducts = filterByShop(products, shopId)
  const filteredSales = filterByShop(sales, shopId)
  const filteredDebts = filterByShop(debts, shopId)
  const filteredExpenses = filterByShop(expenses, shopId)

  const todaySales = filteredSales.filter(s => s.saleDate >= todayStart && s.status === 'completed')
  const monthSales = filteredSales.filter(s => s.saleDate >= monthStart && s.status === 'completed')

  const outOfStock = filteredProducts.filter(p => p.quantity <= 0)
  const lowStock = filteredProducts.filter(p => p.quantity > 0 && p.quantity <= p.lowStockThreshold)

  const totalStockCostValue = filteredProducts.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0)
  const totalStockRetailValue = filteredProducts.reduce((sum, p) => sum + (p.sellingPrice * p.quantity), 0)

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0)
  const monthRevenue = monthSales.reduce((sum, s) => sum + s.total, 0)

  const totalCustomerDebt = filteredDebts
    .filter(d => d.type === 'customer_debt' && d.status !== 'paid')
    .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)

  const totalSupplierDebt = filteredDebts
    .filter(d => d.type === 'supplier_debt' && d.status !== 'paid')
    .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)

  const periodExpenses = filteredExpenses
    .filter(e => e.date >= monthStart)
    .reduce((sum, e) => sum + e.amount, 0)

  // Resolve customer names and sale items for recentSales
  const recentSalesRaw = filteredSales
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)

  const recentCustomerIds = [...new Set(recentSalesRaw.map(s => s.customerId).filter(Boolean) as string[])]
  const recentSaleIds = recentSalesRaw.map(s => s.id)

  const [recentCustomers, recentItems] = await Promise.all([
    recentCustomerIds.length > 0 ? db.customers.where('id').anyOf(recentCustomerIds).toArray() : ([] as LocalCustomer[]),
    recentSaleIds.length > 0 ? db.saleItems.where('saleId').anyOf(recentSaleIds).toArray() : ([] as LocalSaleItem[]),
  ])
  const recentCustomerMap = new Map(recentCustomers.map(c => [c.id, c]))
  const recentItemsBySale = new Map<string, typeof recentItems>()
  for (const si of recentItems) {
    const items = recentItemsBySale.get(si.saleId) || []
    items.push(si)
    recentItemsBySale.set(si.saleId, items)
  }

  // Resolve product names for sale items
  const recentProductIds = [...new Set(recentItems.map(si => si.productId))]
  const recentProducts = recentProductIds.length > 0
    ? await db.products.where('id').anyOf(recentProductIds).toArray()
    : []
  const recentProductMap = new Map(recentProducts.map(p => [p.id, p]))

  // Resolve top products from sale items (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const recent30DaysSales = filteredSales.filter(s => s.status === 'completed' && s.saleDate >= thirtyDaysAgo)
  const recent30SaleIds = recent30DaysSales.map(s => s.id)
  const recent30Items = recent30SaleIds.length > 0
    ? await db.saleItems.where('saleId').anyOf(recent30SaleIds).toArray()
    : []
  const topProductMap = new Map<string, { totalRevenue: number; totalQuantity: number }>()
  for (const si of recent30Items) {
    const existing = topProductMap.get(si.productId) || { totalRevenue: 0, totalQuantity: 0 }
    existing.totalRevenue += si.total
    existing.totalQuantity += si.quantity
    topProductMap.set(si.productId, existing)
  }
  const topProductIds = [...topProductMap.keys()]
  const topProductDetails = topProductIds.length > 0
    ? await db.products.where('id').anyOf(topProductIds).toArray()
    : []
  const topProductDetailMap = new Map(topProductDetails.map(p => [p.id, p]))

  // Build sales trend from last 30 days
  const salesTrendMap = new Map<string, number>()
  for (const s of recent30DaysSales) {
    const dateKey = s.saleDate.split('T')[0]
    salesTrendMap.set(dateKey, (salesTrendMap.get(dateKey) || 0) + s.total)
  }

  // Match DashboardData interface exactly
  return {
    stats: {
      totalProducts: filteredProducts.length,
      outOfStockCount: outOfStock.length,
      lowStockCount: lowStock.length,
      totalStockCostValue,
      totalStockRetailValue,
      todayRevenue,
      todaySalesCount: todaySales.length,
      monthRevenue,
      totalCustomerDebt,
      periodRevenue: monthRevenue,
      periodExpenses,
      periodCogs: 0,
      periodNetProfit: monthRevenue - periodExpenses,
      periodSalesCount: monthSales.length,
    },
    comparison: {
      revenueChange: 0,
      expenseChange: 0,
      netProfitChange: 0,
      salesCountChange: 0,
      prevRevenue: 0,
      prevExpenses: 0,
      prevNetProfit: 0,
      prevSalesCount: 0,
    },
    period: {
      from: monthStart,
      to: todayStart,
      prevFrom: '',
      prevTo: '',
    },
    anomalies: [
      ...outOfStock.slice(0, 3).map(p => ({
        id: p.id,
        type: 'out_of_stock' as const,
        message: `${p.name} is out of stock`,
        severity: 'high' as const,
      })),
      ...lowStock.slice(0, 3).map(p => ({
        id: p.id,
        type: 'critical_low' as const,
        message: `${p.name} is low on stock (${p.quantity} left)`,
        severity: 'medium' as const,
      })),
    ],
    recentSales: recentSalesRaw.map(s => {
      const cust = s.customerId ? recentCustomerMap.get(s.customerId) : undefined
      const saleItems = recentItemsBySale.get(s.id) || []
      return {
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        status: s.status,
        total: s.total,
        amountPaid: s.amountPaid,
        saleDate: s.saleDate,
        customer: cust ? { id: cust.id, name: cust.name } : null,
        items: saleItems.map(si => {
          const prod = recentProductMap.get(si.productId)
          return {
            id: si.id,
            quantity: si.quantity,
            unitPrice: si.unitPrice,
            total: si.total,
            product: prod ? { id: prod.id, name: prod.name } : null,
          }
        }),
      }
    }),
    topProducts: [...topProductMap.entries()]
      .sort(([, a], [, b]) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5)
      .map(([productId, data]) => {
        const prod = topProductDetailMap.get(productId)
        return {
          id: productId,
          name: prod?.name || 'Unknown',
          sku: prod?.sku ?? null,
          imageUrl: prod?.imageUrl ?? null,
          totalRevenue: data.totalRevenue,
          totalQuantity: data.totalQuantity,
        }
      }),
    salesTrend: [...salesTrendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue })),
  }
}

async function handleProducts(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const shopId = extractShopId(endpoint)
  const search = extractSearch(endpoint)
  const page = extractPage(endpoint)
  const limit = extractLimit(endpoint)

  let products = await db.products.where('organizationId').equals(orgId).toArray()
  products = filterByShop(products, shopId)

  if (search) {
    const lowerSearch = search.toLowerCase()
    products = products.filter(p =>
      p.name.toLowerCase().includes(lowerSearch) ||
      (p.sku && p.sku.toLowerCase().includes(lowerSearch))
    )
  }

  // Sort by name
  products.sort((a, b) => a.name.localeCompare(b.name))

  const total = products.length
  const start = (page - 1) * limit
  const pagedProducts = products.slice(start, start + limit)

  // Load categories for nested productType
  const categories = await db.categories.where('organizationId').equals(orgId).toArray()
  const categoryMap = new Map(categories.map(c => [c.id, c]))

  return {
    products: pagedProducts.map(p => {
      const cat = categoryMap.get(p.productTypeId)
      return {
        id: p.id,
        productTypeId: p.productTypeId,
        organizationId: p.organizationId,
        sku: p.sku,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        quantity: p.quantity,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        lowStockThreshold: p.lowStockThreshold,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        // Match Product interface: productType is { id, name, icon? }
        productType: cat ? { id: cat.id, name: cat.name, icon: cat.icon ?? null } : null,
        attributeValues: [] as Array<{
          id: string; productId: string; attributeDefinitionId: string;
          value: string; attributeDefinition?: { id: string; name: string; fieldType: string };
        }>,
      }
    }),
    // Match Pagination interface: { page, limit, total, totalPages }
    pagination: makePagination(page, limit, total),
  }
}

async function handleProductTypes(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  // Count products per type
  const products = await db.products.where('organizationId').equals(orgId).toArray()
  const productCountByType = new Map<string, number>()
  for (const p of products) {
    productCountByType.set(p.productTypeId, (productCountByType.get(p.productTypeId) || 0) + 1)
  }

  const categories = await db.categories.where('organizationId').equals(orgId).toArray()

  return {
    productTypes: categories.map(c => ({
      id: c.id,
      organizationId: c.organizationId,
      name: c.name,
      icon: c.icon,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      attributes: [] as Array<{
        id: string; productTypeId: string; name: string; fieldType: string;
        options?: string | null; required: boolean; order: number;
      }>,
      _count: { products: productCountByType.get(c.id) || 0 },
    })),
  }
}

async function handleCustomers(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const shopId = extractShopId(endpoint)
  const search = extractSearch(endpoint)
  const page = extractPage(endpoint)
  const limit = extractLimit(endpoint)

  let customers = await db.customers.where('organizationId').equals(orgId).toArray()
  customers = filterByShop(customers, shopId)

  if (search) {
    const lowerSearch = search.toLowerCase()
    customers = customers.filter(c =>
      c.name.toLowerCase().includes(lowerSearch) ||
      (c.phone && c.phone.toLowerCase().includes(lowerSearch)) ||
      (c.email && c.email.toLowerCase().includes(lowerSearch))
    )
  }

  customers.sort((a, b) => a.name.localeCompare(b.name))

  const total = customers.length
  const start = (page - 1) * limit
  const paged = customers.slice(start, start + limit)

  // Count sales and debts per customer for _count
  const [sales, debts] = await Promise.all([
    db.sales.where('organizationId').equals(orgId).toArray(),
    db.debts.where('organizationId').equals(orgId).toArray(),
  ])
  const salesByCustomer = new Map<string, number>()
  for (const s of sales) {
    if (s.customerId) salesByCustomer.set(s.customerId, (salesByCustomer.get(s.customerId) || 0) + 1)
  }
  const debtsByCustomer = new Map<string, number>()
  for (const d of debts) {
    if (d.customerId) debtsByCustomer.set(d.customerId, (debtsByCustomer.get(d.customerId) || 0) + 1)
  }

  return {
    customers: paged.map(c => ({
      id: c.id,
      organizationId: c.organizationId,
      shopId: c.shopId,
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      _count: {
        sales: salesByCustomer.get(c.id) || 0,
        debts: debtsByCustomer.get(c.id) || 0,
      },
    })),
    pagination: makePagination(page, limit, total),
  }
}

async function handleSuppliers(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const shopId = extractShopId(endpoint)
  const search = extractSearch(endpoint)
  const page = extractPage(endpoint)
  const limit = extractLimit(endpoint)

  let suppliers = await db.suppliers.where('organizationId').equals(orgId).toArray()
  suppliers = filterByShop(suppliers, shopId)

  if (search) {
    const lowerSearch = search.toLowerCase()
    suppliers = suppliers.filter(s =>
      s.name.toLowerCase().includes(lowerSearch) ||
      (s.phone && s.phone.toLowerCase().includes(lowerSearch)) ||
      (s.email && s.email.toLowerCase().includes(lowerSearch))
    )
  }

  suppliers.sort((a, b) => a.name.localeCompare(b.name))

  const total = suppliers.length
  const start = (page - 1) * limit
  const paged = suppliers.slice(start, start + limit)

  return {
    suppliers: paged.map(s => ({
      id: s.id,
      organizationId: s.organizationId,
      shopId: s.shopId,
      name: s.name,
      email: s.email,
      phone: s.phone,
      address: s.address,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
    pagination: makePagination(page, limit, total),
  }
}

async function handleSales(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const shopId = extractShopId(endpoint)
  const page = extractPage(endpoint)
  const limit = extractLimit(endpoint)
  const status = extractStatus(endpoint)

  let sales = await db.sales.where('organizationId').equals(orgId).toArray()
  sales = filterByShop(sales, shopId)

  if (status) {
    sales = sales.filter(s => s.status === status)
  }

  sales.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = sales.length
  const start = (page - 1) * limit
  const paged = sales.slice(start, start + limit)

  // Load customer names for nested customer field
  const customerIds = [...new Set(paged.map(s => s.customerId).filter(Boolean) as string[])]
  const customers = customerIds.length > 0
    ? await db.customers.where('id').anyOf(customerIds).toArray()
    : []
  const customerMap = new Map(customers.map(c => [c.id, c]))

  // Load sale items
  const saleIds = paged.map(s => s.id)
  const allSaleItems = saleIds.length > 0
    ? await db.saleItems.where('saleId').anyOf(saleIds).toArray()
    : []
  const itemsBySale = new Map<string, typeof allSaleItems>()
  for (const si of allSaleItems) {
    const items = itemsBySale.get(si.saleId) || []
    items.push(si)
    itemsBySale.set(si.saleId, items)
  }

  // Resolve product names for sale items
  const allItemProductIds = [...new Set(allSaleItems.map(si => si.productId))]
  const itemProducts = allItemProductIds.length > 0
    ? await db.products.where('id').anyOf(allItemProductIds).toArray()
    : []
  const itemProductMap = new Map(itemProducts.map(p => [p.id, p]))

  return {
    sales: paged.map(s => ({
      id: s.id,
      organizationId: s.organizationId,
      shopId: s.shopId,
      customerId: s.customerId,
      invoiceNumber: s.invoiceNumber,
      status: s.status,
      paymentMethod: s.paymentMethod,
      subtotal: s.subtotal,
      discount: s.discount,
      tax: s.tax,
      total: s.total,
      amountPaid: s.amountPaid,
      notes: s.notes,
      saleDate: s.saleDate,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      // Match Sale interface: customer is { id, name, phone? } | null
      customer: s.customerId
        ? (() => {
            const c = customerMap.get(s.customerId!)
            return c ? { id: c.id, name: c.name, phone: c.phone ?? null } : null
          })()
        : null,
      // Match Sale interface: items with nested product
      items: (itemsBySale.get(s.id) || []).map(si => {
        const prod = itemProductMap.get(si.productId)
        return {
          id: si.id,
          saleId: si.saleId,
          productId: si.productId,
          quantity: si.quantity,
          unitPrice: si.unitPrice,
          costPrice: si.costPrice,
          total: si.total,
          createdAt: si.createdAt,
          product: prod ? { id: prod.id, name: prod.name, sku: prod.sku ?? null } : null,
        }
      }),
    })),
    pagination: makePagination(page, limit, total),
  }
}

async function handleInventory(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const shopId = extractShopId(endpoint)

  const products = filterByShop(
    await db.products.where('organizationId').equals(orgId).toArray(),
    shopId,
  )

  const outOfStock = products.filter(p => p.quantity <= 0)
  const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= p.lowStockThreshold)
  const totalCostValue = products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0)
  const totalRetailValue = products.reduce((sum, p) => sum + (p.sellingPrice * p.quantity), 0)

  // Load categories for productType in lowStockProducts
  const categories = await db.categories.where('organizationId').equals(orgId).toArray()
  const categoryMap = new Map(categories.map(c => [c.id, c]))

  const movements = await db.stockMovements.where('organizationId').equals(orgId).toArray()

  // Load product names for movement.product
  const productIds = [...new Set(movements.map(m => m.productId))]
  const movementProducts = productIds.length > 0
    ? await db.products.where('id').anyOf(productIds).toArray()
    : []
  const productMap = new Map(movementProducts.map(p => [p.id, p]))

  return {
    // Match InventoryStats interface exactly
    overview: {
      totalProducts: products.length,
      outOfStock: outOfStock.length,
      lowStock: lowStock.length,
      totalCostValue,
      totalRetailValue,
    },
    lowStockProducts: lowStock.slice(0, 10).map(p => {
      const cat = categoryMap.get(p.productTypeId)
      return {
        id: p.id,
        name: p.name,
        quantity: p.quantity,
        lowStockThreshold: p.lowStockThreshold,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        productType: cat ? { id: cat.id, name: cat.name } : { id: p.productTypeId, name: '—' },
      }
    }),
    recentMovements: movements
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)
      .map(m => {
        const prod = productMap.get(m.productId)
        return {
          id: m.id,
          organizationId: m.organizationId,
          productId: m.productId,
          type: m.type,
          quantity: m.quantity,
          previousStock: m.previousStock,
          newStock: m.newStock,
          reason: m.reason,
          reference: m.reference,
          createdAt: m.createdAt,
          // Match StockMovement interface: product is { id, name, sku? }
          product: prod ? { id: prod.id, name: prod.name, sku: prod.sku ?? null } : null,
        }
      }),
  }
}

async function handleDebts(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const shopId = extractShopId(endpoint)
  const page = extractPage(endpoint)
  const limit = extractLimit(endpoint)
  const status = extractStatus(endpoint)

  let debts = await db.debts.where('organizationId').equals(orgId).toArray()
  debts = filterByShop(debts, shopId)

  if (status) {
    debts = debts.filter(d => d.status === status)
  }

  debts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = debts.length
  const start = (page - 1) * limit
  const paged = debts.slice(start, start + limit)

  // Load customer/supplier names for nested fields
  const customerIds = [...new Set(paged.map(d => d.customerId).filter(Boolean) as string[])]
  const supplierIds = [...new Set(paged.map(d => d.supplierId).filter(Boolean) as string[])]

  const [customers, suppliers] = await Promise.all([
    customerIds.length > 0 ? db.customers.where('id').anyOf(customerIds).toArray() : ([] as LocalCustomer[]),
    supplierIds.length > 0 ? db.suppliers.where('id').anyOf(supplierIds).toArray() : ([] as LocalSupplier[]),
  ])
  const customerMap = new Map(customers.map(c => [c.id, c]))
  const supplierMap = new Map(suppliers.map(s => [s.id, s]))

  const totalCustomerDebt = debts
    .filter(d => d.type === 'customer_debt' && d.status !== 'paid')
    .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
  const totalSupplierDebt = debts
    .filter(d => d.type === 'supplier_debt' && d.status !== 'paid')
    .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)

  return {
    debts: paged.map(d => {
      const cust = d.customerId ? customerMap.get(d.customerId) : undefined
      const supp = d.supplierId ? supplierMap.get(d.supplierId) : undefined
      return {
        id: d.id,
        organizationId: d.organizationId,
        shopId: d.shopId,
        customerId: d.customerId,
        supplierId: d.supplierId,
        type: d.type,
        amount: d.amount,
        paidAmount: d.paidAmount,
        dueDate: d.dueDate,
        status: d.status,
        description: d.description,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        // Match Debt interface: customer is { id, name, phone? } | null
        customer: cust ? { id: cust.id, name: cust.name, phone: cust.phone ?? null } : null,
        // Match Debt interface: supplier is { id, name, phone? } | null
        supplier: supp ? { id: supp.id, name: supp.name, phone: supp.phone ?? null } : null,
        // Match Debt interface: payments array
        payments: [] as Array<{
          id: string; debtId: string; amount: number;
          paymentMethod: string; notes?: string | null; paidAt: string;
        }>,
      }
    }),
    summary: {
      totalCustomerDebt,
      totalSupplierDebt,
      totalOutstanding: totalCustomerDebt + totalSupplierDebt,
    },
    pagination: makePagination(page, limit, total),
  }
}

async function handleExpenses(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const shopId = extractShopId(endpoint)
  const page = extractPage(endpoint)
  const limit = extractLimit(endpoint)

  let expenses = await db.expenses.where('organizationId').equals(orgId).toArray()
  expenses = filterByShop(expenses, shopId)

  expenses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = expenses.length
  const start = (page - 1) * limit
  const paged = expenses.slice(start, start + limit)

  // Load shop names for nested shop field
  const shopIds = [...new Set(paged.map(e => e.shopId).filter(Boolean) as string[])]
  const shops = shopIds.length > 0
    ? await db.shops.where('id').anyOf(shopIds).toArray()
    : []
  const shopMap = new Map(shops.map(s => [s.id, s]))

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  return {
    expenses: paged.map(e => {
      const shop = e.shopId ? shopMap.get(e.shopId) : undefined
      return {
        id: e.id,
        organizationId: e.organizationId,
        shopId: e.shopId,
        category: e.category,
        amount: e.amount,
        description: e.description,
        // Match Expense interface: expenseDate (not "date")
        expenseDate: e.date,
        isRecurring: e.isRecurring ?? false,
        recurringPeriod: null as string | null,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        // Match Expense interface: shop is { id, name } | null
        shop: shop ? { id: shop.id, name: shop.name } : null,
      }
    }),
    total,
    summary: { totalExpenses },
    monthlySummary: [] as Array<{ month: string; total: number }>,
    pagination: makePagination(page, limit, total),
  }
}

async function handleShops(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const shops = await db.shops.where('organizationId').equals(orgId).toArray()

  // Count products and sales per shop for _count
  const [products, sales] = await Promise.all([
    db.products.where('organizationId').equals(orgId).toArray(),
    db.sales.where('organizationId').equals(orgId).toArray(),
  ])

  const productsByShop = new Map<string, number>()
  for (const p of products) {
    if (p.shopId) productsByShop.set(p.shopId, (productsByShop.get(p.shopId) || 0) + 1)
  }
  const salesByShop = new Map<string, number>()
  for (const s of sales) {
    if (s.shopId) salesByShop.set(s.shopId, (salesByShop.get(s.shopId) || 0) + 1)
  }

  const totalShops = shops.length

  return {
    shops: shops.map(s => ({
      id: s.id,
      organizationId: s.organizationId,
      name: s.name,
      address: s.address ?? null,
      city: s.city ?? null,
      latitude: s.latitude ?? null,
      longitude: s.longitude ?? null,
      phone: s.phone ?? null,
      isActive: s.isActive,
      createdAt: s.createdAt,
      // branches-page.tsx reads shop._count.products and shop._count.sales
      _count: {
        products: productsByShop.get(s.id) || 0,
        sales: salesByShop.get(s.id) || 0,
      },
      // branches-page.tsx reads shop.members.length and iterates members
      members: [] as Array<{
        id: string; userId: string; role: string;
        user: { id: string; name: string; email: string; avatarUrl?: string | null };
      }>,
    })),
    pagination: makePagination(1, 100, totalShops),
  }
}

async function handleServiceTypes(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const serviceTypes = await db.serviceTypes.where('organizationId').equals(orgId).toArray()

  return {
    serviceTypes: serviceTypes.map(st => ({
      id: st.id,
      organizationId: st.organizationId,
      name: st.name,
      description: st.description,
      duration: st.duration,
      price: st.price,
      imageUrl: st.imageUrl,
      isActive: st.isActive,
      createdAt: st.createdAt,
      updatedAt: st.updatedAt,
    })),
  }
}

async function handleServiceBookings(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const shopId = extractShopId(endpoint)
  const page = extractPage(endpoint)
  const limit = extractLimit(endpoint)

  let bookings = await db.serviceBookings.where('organizationId').equals(orgId).toArray()
  bookings = filterByShop(bookings, shopId)

  bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = bookings.length
  const start = (page - 1) * limit
  const paged = bookings.slice(start, start + limit)

  // Load service type names for nested serviceType field
  const serviceTypeIds = [...new Set(paged.map(b => b.serviceTypeId).filter(Boolean) as string[])]
  const serviceTypes = serviceTypeIds.length > 0
    ? await db.serviceTypes.where('id').anyOf(serviceTypeIds).toArray()
    : []
  const serviceTypeMap = new Map(serviceTypes.map(st => [st.id, st]))

  // Load customer names for nested customer field
  const customerIds = [...new Set(paged.map(b => b.customerId).filter(Boolean) as string[])]
  const customers = customerIds.length > 0
    ? await db.customers.where('id').anyOf(customerIds).toArray()
    : []
  const customerMap = new Map(customers.map(c => [c.id, c]))

  return {
    bookings: paged.map(b => {
      const st = b.serviceTypeId ? serviceTypeMap.get(b.serviceTypeId) : undefined
      const cust = b.customerId ? customerMap.get(b.customerId) : undefined
      return {
        id: b.id,
        organizationId: b.organizationId,
        shopId: b.shopId,
        serviceTypeId: b.serviceTypeId,
        customerId: b.customerId,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        status: b.status,
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        notes: b.notes,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        // Match ServiceBooking interface: serviceType is { id, name, duration, price }
        serviceType: st ? { id: st.id, name: st.name, duration: st.duration, price: st.price } : null,
        // Match ServiceBooking interface: customer is { id, name, phone? } | null
        customer: cust ? { id: cust.id, name: cust.name, phone: cust.phone ?? null } : null,
      }
    }),
    pagination: makePagination(page, limit, total),
  }
}

async function handlePurchaseOrders(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const purchaseOrders = await db.purchaseOrders.where('organizationId').equals(orgId).toArray()

  return {
    purchaseOrders: purchaseOrders.map(po => ({
      id: po.id,
      organizationId: po.organizationId,
      shopId: po.shopId,
      supplierId: po.supplierId,
      status: po.status,
      totalAmount: po.totalAmount,
      notes: po.notes,
      createdAt: po.createdAt,
      updatedAt: po.updatedAt,
    })),
  }
}

async function handleReports(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const shopId = extractShopId(endpoint)

  // Parse period params from URL
  const startDate = extractParam(endpoint, 'startDate')
  const endDate = extractParam(endpoint, 'endDate')
  const type = extractParam(endpoint, 'period') || extractParam(endpoint, 'type') || 'daily'

  const now = new Date()
  const periodStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = endDate ? new Date(endDate) : now

  const [products, sales, expenses] = await Promise.all([
    db.products.where('organizationId').equals(orgId).toArray(),
    db.sales.where('organizationId').equals(orgId).toArray(),
    db.expenses.where('organizationId').equals(orgId).toArray(),
  ])

  const filteredProducts = filterByShop(products, shopId)
  const filteredSales = filterByShop(sales, shopId)
  const filteredExpenses = filterByShop(expenses, shopId)

  // Filter sales to the requested period
  const periodSales = filteredSales.filter(s => {
    if (s.status !== 'completed') return false
    const saleDate = new Date(s.saleDate)
    return saleDate >= periodStart && saleDate <= periodEnd
  })

  // Aggregate sales by date for salesByPeriod and salesByDate
  const salesByDateMap = new Map<string, { revenue: number; cost: number; profit: number; count: number }>()
  for (const s of periodSales) {
    const dateKey = s.saleDate.split('T')[0]
    const existing = salesByDateMap.get(dateKey) || { revenue: 0, cost: 0, profit: 0, count: 0 }
    existing.revenue += s.total
    existing.cost += s.subtotal - s.discount // approximate COGS
    existing.profit += s.total - (s.subtotal - s.discount)
    existing.count += 1
    salesByDateMap.set(dateKey, existing)
  }

  // Top products by quantity from sale items
  const saleIds = periodSales.map(s => s.id)
  const allSaleItems = saleIds.length > 0
    ? await db.saleItems.where('saleId').anyOf(saleIds).toArray()
    : []
  const productRevenueMap = new Map<string, { name: string; sku: string | null; sellingPrice: number; quantity: number; revenue: number; salesCount: number }>()
  for (const si of allSaleItems) {
    const existing = productRevenueMap.get(si.productId) || { name: '', sku: null, sellingPrice: 0, quantity: 0, revenue: 0, salesCount: 0 }
    existing.quantity += si.quantity
    existing.revenue += si.total
    existing.salesCount += 1
    productRevenueMap.set(si.productId, existing)
  }
  // Resolve product names, skus, sellingPrices
  const productIds = [...productRevenueMap.keys()]
  const prods = productIds.length > 0
    ? await db.products.where('id').anyOf(productIds).toArray()
    : []
  for (const p of prods) {
    const entry = productRevenueMap.get(p.id)
    if (entry) {
      entry.name = p.name
      entry.sku = p.sku ?? null
      entry.sellingPrice = p.sellingPrice
    }
  }

  // Payment method breakdown from sales
  const paymentMethodMap = new Map<string, { count: number; revenue: number }>()
  for (const s of periodSales) {
    const method = s.paymentMethod || 'cash'
    const existing = paymentMethodMap.get(method) || { count: 0, revenue: 0 }
    existing.count += 1
    existing.revenue += s.total
    paymentMethodMap.set(method, existing)
  }

  // Summary calculations
  const totalRevenue = periodSales.reduce((sum, s) => sum + s.total, 0)
  const totalCost = allSaleItems.reduce((sum, si) => sum + (si.costPrice * si.quantity), 0)
  const totalProfit = totalRevenue - totalCost
  const totalSales = periodSales.length
  const averageSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0

  // Inventory valuation — match real API shape
  const totalCostValue = filteredProducts.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0)
  const totalRetailValue = filteredProducts.reduce((sum, p) => sum + (p.sellingPrice * p.quantity), 0)
  const totalItems = filteredProducts.reduce((sum, p) => sum + p.quantity, 0)
  const potentialProfit = filteredProducts.reduce((sum, p) => sum + (p.quantity * (p.sellingPrice - p.costPrice)), 0)

  // Match the real reports API shape EXACTLY:
  // { period, summary, salesByPeriod, salesByDate, bestSellingProducts, paymentMethodBreakdown, inventoryValuation }
  return {
    period: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
      type,
    },
    summary: {
      totalRevenue,
      totalCost,
      totalProfit,
      totalSales,
      averageSaleValue,
    },
    salesByPeriod: [...salesByDateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => ({
        period,
        revenue: data.revenue,
        cost: data.cost,
        profit: data.profit,
        count: data.count,
      })),
    salesByDate: [...salesByDateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        cost: data.cost,
        profit: data.profit,
        count: data.count,
      })),
    bestSellingProducts: [...productRevenueMap.entries()]
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(([id, data]) => ({
        id,
        name: data.name,
        sku: data.sku,
        sellingPrice: data.sellingPrice,
        totalRevenue: data.revenue,
        totalQuantity: data.quantity,
        salesCount: data.salesCount,
      })),
    paymentMethodBreakdown: [...paymentMethodMap.entries()]
      .map(([method, data]) => ({
        method,
        count: data.count,
        revenue: data.revenue,
      })),
    inventoryValuation: {
      totalItems,
      totalCostValue,
      totalRetailValue,
      potentialProfit,
    },
  }
}

async function handleAuthMe(): Promise<unknown> {
  try {
    const profiles = await db.userProfile.toArray()
    if (profiles.length === 0) return null

    const profile = profiles[0]
    const orgs = JSON.parse(profile.organizations || '[]')

    return {
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        role: profile.role,
      },
      organizations: orgs,
    }
  } catch {
    return null
  }
}

async function handleModules(_endpoint: string): Promise<unknown> {
  // Modules are org-level configuration — we can't fully reconstruct them
  // from local data. Return an empty modules list so the UI doesn't crash.
  // The fetchModules catch block in auth-store handles this gracefully.
  return {
    modules: [],
  }
}

/**
 * Stock Transfers — no local Dexie table exists for these.
 * Return an empty list with the correct shape so the page renders its
 * "no transfers" state instead of erroring.
 *
 * Shape matches GET /api/stock-transfers and api.getStockTransfers().
 */
async function handleStockTransfers(_endpoint: string): Promise<unknown> {
  return { transfers: [] }
}

/**
 * Notifications — no local Dexie table exists for these.
 * Return an empty list with zero unread count so the notification bell
 * renders gracefully offline instead of erroring.
 *
 * Shape matches GET /api/notifications: { notifications, unreadCount }
 */
async function handleNotifications(_endpoint: string): Promise<unknown> {
  return { notifications: [], unreadCount: 0 }
}

/**
 * Loyalty Accounts — no local Dexie table exists for these.
 * Return an empty paginated response so the Customer Loyalty page renders
 * its empty state instead of crashing.
 *
 * Shape matches GET /api/loyalty:
 *   { accounts: [], pagination: { page, limit, total, totalPages } }
 */
async function handleLoyalty(endpoint: string): Promise<unknown> {
  const url = new URL(endpoint, 'http://localhost')
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const limit = parseInt(url.searchParams.get('limit') || '50', 10)
  return {
    accounts: [],
    pagination: { page, limit, total: 0, totalPages: 0 },
  }
}

/**
 * Credit Limits — no local Dexie table exists for these.
 * Return an empty paginated response with zeroed summary KPIs so the
 * Credit Limits page renders its empty state instead of crashing.
 *
 * Shape matches GET /api/credit-limits:
 *   { creditLimits: [], pagination: {...}, summary: { totalCreditExtended, totalUsed, totalAvailable, blockedAccounts } }
 */
async function handleCreditLimits(endpoint: string): Promise<unknown> {
  const url = new URL(endpoint, 'http://localhost')
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const limit = parseInt(url.searchParams.get('limit') || '50', 10)
  return {
    creditLimits: [],
    pagination: { page, limit, total: 0, totalPages: 0 },
    summary: {
      totalCreditExtended: 0,
      totalUsed: 0,
      totalAvailable: 0,
      blockedAccounts: 0,
    },
  }
}

/**
 * Organization detail — reconstruct from the cached user profile
 * (db.userProfile stores the user's organizations as JSON). Members can't
 * be fully reconstructed offline, so we return an empty members array —
 * the Settings page degrades gracefully.
 *
 * Shape matches GET /api/organizations/{id}:
 *   { organization: Organization & { members: [...] } }
 */
async function handleOrganization(endpoint: string): Promise<unknown> {
  try {
    // Extract the org ID from /api/organizations/{id}
    const match = endpoint.match(/\/api\/organizations\/([^/?]+)/)
    const orgId = match?.[1]
    if (!orgId) return null

    const profiles = await db.userProfile.toArray()
    if (profiles.length === 0) return null

    const profile = profiles[0]
    const orgs = JSON.parse(profile.organizations || '[]') as Array<{
      id: string
      name: string
      slug?: string
      role?: string
      businessType?: string
      description?: string
      address?: string
      city?: string
      latitude?: number
      longitude?: number
      phone?: string
    }>
    const org = orgs.find(o => o.id === orgId)
    if (!org) return null

    return {
      organization: {
        ...org,
        members: [],
      },
    }
  } catch {
    return null
  }
}

// ============================================
// Route Matching
// ============================================

interface RouteHandler {
  pattern: RegExp
  handler: (endpoint: string) => Promise<unknown>
}

const ROUTE_HANDLERS: RouteHandler[] = [
  { pattern: /\/api\/auth\/me/, handler: handleAuthMe },
  { pattern: /\/api\/dashboard/, handler: handleDashboard },
  { pattern: /\/api\/products[/?]/, handler: handleProducts },
  { pattern: /\/api\/products$/, handler: handleProducts },
  { pattern: /\/api\/product-types/, handler: handleProductTypes },
  { pattern: /\/api\/customers/, handler: handleCustomers },
  { pattern: /\/api\/suppliers/, handler: handleSuppliers },
  { pattern: /\/api\/sales[/?]/, handler: handleSales },
  { pattern: /\/api\/sales$/, handler: handleSales },
  { pattern: /\/api\/inventory/, handler: handleInventory },
  { pattern: /\/api\/debts/, handler: handleDebts },
  { pattern: /\/api\/expenses/, handler: handleExpenses },
  { pattern: /\/api\/shops[/?]/, handler: handleShops },
  { pattern: /\/api\/shops$/, handler: handleShops },
  { pattern: /\/api\/service-types/, handler: handleServiceTypes },
  { pattern: /\/api\/service-bookings/, handler: handleServiceBookings },
  { pattern: /\/api\/purchase-orders/, handler: handlePurchaseOrders },
  { pattern: /\/api\/reports/, handler: handleReports },
  { pattern: /\/api\/modules/, handler: handleModules },
  { pattern: /\/api\/stock-transfers/, handler: handleStockTransfers },
  { pattern: /\/api\/notifications/, handler: handleNotifications },
  { pattern: /\/api\/loyalty/, handler: handleLoyalty },
  { pattern: /\/api\/credit-limits/, handler: handleCreditLimits },
  { pattern: /\/api\/organizations\/[^/?]+/, handler: handleOrganization },
]

// ============================================
// Main Export
// ============================================

/**
 * Attempts to reconstruct an API response from local IndexedDB data.
 * Called by the API client when the network is unavailable.
 *
 * Every response MUST match the exact shape that the real API returns,
 * as defined in the api-client.ts interfaces. Components access nested
 * fields (shop.members, customer._count.sales, sale.customer.name) —
 * if these are missing, the app crashes with TypeError.
 *
 * @param endpoint - The API endpoint URL (e.g., '/api/products?orgId=xxx')
 * @returns The reconstructed response data, or null if no fallback is available
 */
export async function getOfflineFallback<T>(endpoint: string): Promise<T | null> {
  // Strip any base URL if present
  const path = endpoint.replace(/^https?:\/\/[^/]+/, '')

  for (const { pattern, handler } of ROUTE_HANDLERS) {
    if (pattern.test(path)) {
      try {
        const result = await handler(path)
        if (result !== null) {
          console.log(`[OfflineFallback] ✓ Reconstructed response for ${path}`)
          return result as T
        }
      } catch (err) {
        console.warn(`[OfflineFallback] Failed to reconstruct ${path}:`, err)
      }
    }
  }

  console.log(`[OfflineFallback] No handler for ${path}`)
  return null
}

// ============================================
// Offline Fallback — Reconstruct API responses from IndexedDB
// ============================================
// When the network is unavailable, the API client calls
// getOfflineFallback() to reconstruct API responses from
// the local Dexie entity tables. This allows the app to
// function fully offline after the initial bootstrap.
// ============================================

import { db } from '@/lib/db'

// ============================================
// Helper: Parse orgId from endpoint URL
// ============================================

function extractOrgId(url: string): string | null {
  try {
    const urlObj = new URL(url, 'http://localhost')
    return urlObj.searchParams.get('orgId') || urlObj.searchParams.get('organizationId')
  } catch {
    // Try regex as fallback
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

// ============================================
// Helper: Filter by shopId
// ============================================

function filterByShop<T extends { shopId?: string | null }>(items: T[], shopId: string | null): T[] {
  if (!shopId) return items
  return items.filter(item => !item.shopId || item.shopId === shopId)
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
      totalSupplierDebt,
      totalOutstanding: totalCustomerDebt + totalSupplierDebt,
      periodRevenue: monthRevenue,
      periodExpenses,
      periodCogs: 0,
      periodNetProfit: monthRevenue - periodExpenses,
      periodSalesCount: monthSales.length,
    },
    recentSales: filteredSales
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(s => ({
        id: s.id,
        organizationId: s.organizationId,
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
        customer: null,
        items: undefined,
      })),
    topProducts: [],
    salesTrend: [],
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

  const totalProducts = products.length
  const totalPages = Math.ceil(totalProducts / limit)
  const start = (page - 1) * limit
  const pagedProducts = products.slice(start, start + limit)

  return {
    products: pagedProducts.map(p => ({
      id: p.id,
      productTypeId: p.productTypeId,
      organizationId: p.organizationId,
      shopId: p.shopId,
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
      productType: null,
    })),
    pagination: {
      page,
      limit,
      totalProducts,
      totalPages,
    },
  }
}

async function handleProductTypes(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const categories = await db.categories.where('organizationId').equals(orgId).toArray()

  return {
    productTypes: categories.map(c => ({
      id: c.id,
      organizationId: c.organizationId,
      name: c.name,
      icon: c.icon,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      _count: { products: 0 },
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

  const totalCustomers = customers.length
  const totalPages = Math.ceil(totalCustomers / limit)
  const start = (page - 1) * limit
  const paged = customers.slice(start, start + limit)

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
    })),
    pagination: { page, limit, totalCustomers, totalPages },
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

  const totalSuppliers = suppliers.length
  const totalPages = Math.ceil(totalSuppliers / limit)
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
    pagination: { page, limit, totalSuppliers, totalPages },
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

  const totalSales = sales.length
  const totalPages = Math.ceil(totalSales / limit)
  const start = (page - 1) * limit
  const paged = sales.slice(start, start + limit)

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
      customer: null,
      items: [],
    })),
    pagination: { page, limit, totalSales, totalPages },
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

  const movements = await db.stockMovements.where('organizationId').equals(orgId).toArray()

  return {
    overview: {
      totalProducts: products.length,
      outOfStock: outOfStock.length,
      lowStock: lowStock.length,
      totalCostValue,
      totalRetailValue,
    },
    lowStockProducts: lowStock.slice(0, 10).map(p => ({
      id: p.id,
      name: p.name,
      quantity: p.quantity,
      lowStockThreshold: p.lowStockThreshold,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      productType: { id: p.productTypeId, name: '—' },
    })),
    recentMovements: movements
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)
      .map(m => ({
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
        product: null,
      })),
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

  const totalDebts = debts.length
  const totalPages = Math.ceil(totalDebts / limit)
  const start = (page - 1) * limit
  const paged = debts.slice(start, start + limit)

  const totalCustomerDebt = debts
    .filter(d => d.type === 'customer_debt' && d.status !== 'paid')
    .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)

  const totalSupplierDebt = debts
    .filter(d => d.type === 'supplier_debt' && d.status !== 'paid')
    .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)

  return {
    debts: paged.map(d => ({
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
      customer: null,
      supplier: null,
    })),
    summary: {
      totalCustomerDebt,
      totalSupplierDebt,
      totalOutstanding: totalCustomerDebt + totalSupplierDebt,
    },
    pagination: { page, limit, totalDebts, totalPages },
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

  const totalExpenses = expenses.length
  const totalPages = Math.ceil(totalExpenses / limit)
  const start = (page - 1) * limit
  const paged = expenses.slice(start, start + limit)

  return {
    expenses: paged.map(e => ({
      id: e.id,
      organizationId: e.organizationId,
      shopId: e.shopId,
      category: e.category,
      amount: e.amount,
      description: e.description,
      expenseDate: e.date,
      isRecurring: e.isRecurring,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
    pagination: { page, limit, totalExpenses, totalPages },
  }
}

async function handleShops(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  const shops = await db.shops.where('organizationId').equals(orgId).toArray()

  return {
    shops: shops.map(s => ({
      id: s.id,
      organizationId: s.organizationId,
      name: s.name,
      address: s.address,
      city: s.city,
      phone: s.phone,
      isActive: s.isActive,
    })),
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

  const totalBookings = bookings.length
  const totalPages = Math.ceil(totalBookings / limit)
  const start = (page - 1) * limit
  const paged = bookings.slice(start, start + limit)

  return {
    bookings: paged.map(b => ({
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
    })),
    pagination: { page, limit, totalBookings, totalPages },
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

async function handleModules(_endpoint: string): Promise<unknown> {
  // Modules are org-level configuration — we can't fully reconstruct them
  // from local data. Return an empty modules list so the UI doesn't crash.
  // The fetchModules catch block in auth-store handles this gracefully.
  return {
    modules: [],
  }
}

async function handleReports(endpoint: string): Promise<unknown> {
  const orgId = extractOrgId(endpoint)
  if (!orgId) return null

  // Reports require complex aggregation — return empty structure
  // The dashboard already computes its own stats from local data
  return {
    salesByPeriod: [],
    topProducts: [],
    expensesByCategory: [],
    inventorySummary: {
      totalProducts: 0,
      outOfStock: 0,
      lowStock: 0,
      totalValue: 0,
    },
  }
}

async function handleAuthMe(): Promise<unknown> {
  // Try to get the cached user profile
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
  { pattern: /\/api\/products[/?]/, handler: handleProducts },  // /api/products?... or /api/products/
  { pattern: /\/api\/products$/, handler: handleProducts },  // /api/products (no query)
  { pattern: /\/api\/product-types/, handler: handleProductTypes },
  { pattern: /\/api\/customers/, handler: handleCustomers },
  { pattern: /\/api\/suppliers/, handler: handleSuppliers },
  { pattern: /\/api\/sales[/?]/, handler: handleSales },      // /api/sales?... or /api/sales/
  { pattern: /\/api\/sales$/, handler: handleSales },        // /api/sales (no query)
  { pattern: /\/api\/inventory/, handler: handleInventory },
  { pattern: /\/api\/debts/, handler: handleDebts },
  { pattern: /\/api\/expenses/, handler: handleExpenses },
  { pattern: /\/api\/shops[/?]/, handler: handleShops },     // /api/shops?... or /api/shops/
  { pattern: /\/api\/shops$/, handler: handleShops },       // /api/shops (no query)
  { pattern: /\/api\/service-types/, handler: handleServiceTypes },
  { pattern: /\/api\/service-bookings/, handler: handleServiceBookings },
  { pattern: /\/api\/purchase-orders/, handler: handlePurchaseOrders },
  { pattern: /\/api\/reports/, handler: handleReports },
  { pattern: /\/api\/modules/, handler: handleModules },
]

// ============================================
// Main Export
// ============================================

/**
 * Attempts to reconstruct an API response from local IndexedDB data.
 * Called by the API client when the network is unavailable.
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

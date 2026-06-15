// ============================================
// Offline Fallback — IndexedDB entity reconstruction
// ============================================
// When the API client is offline and the exact URL-based cache
// key doesn't match, this module reconstructs API responses from
// the IndexedDB entity tables. This enables offline access even
// when the specific API endpoint wasn't previously called.
// ============================================

import {
  db,
  type LocalProduct,
  type LocalCategory,
  type LocalCustomer,
  type LocalSupplier,
  type LocalSale,
  type LocalDebt,
  type LocalExpense,
  type LocalServiceType,
  type LocalServiceBooking,
  type LocalPurchaseOrder,
  type LocalShop,
  type LocalStockMovement,
} from '@/lib/db'

// ============================================
// URL → Entity Table Mapping
// ============================================

interface ParsedApiUrl {
  entity: string
  orgId: string
  shopId?: string
  params: Record<string, string>
}

/**
 * Parses an API URL into entity type, org ID, shop ID, and params.
 * Supports: /api/products, /api/customers, /api/sales, etc.
 */
function parseApiUrl(url: string): ParsedApiUrl | null {
  try {
    // Handle both full URLs and relative paths
    const urlObj = url.startsWith('http') ? new URL(url) : new URL(url, 'http://localhost')
    const pathname = urlObj.pathname
    const params = Object.fromEntries(urlObj.searchParams.entries())

    const orgId = params.orgId || params.organizationId || ''
    const shopId = params.shopId || undefined

    // Map pathname to entity name
    const entityMap: Record<string, string> = {
      '/api/products': 'products',
      '/api/product-types': 'categories',
      '/api/customers': 'customers',
      '/api/suppliers': 'suppliers',
      '/api/sales': 'sales',
      '/api/debts': 'debts',
      '/api/expenses': 'expenses',
      '/api/service-types': 'serviceTypes',
      '/api/service-bookings': 'serviceBookings',
      '/api/purchase-orders': 'purchaseOrders',
      '/api/shops': 'shops',
      '/api/inventory': 'stockMovements',
      '/api/dashboard': 'dashboard',
      '/api/reports': 'reports',
    }

    const entity = entityMap[pathname]
    if (!entity) return null

    return { entity, orgId, shopId, params }
  } catch {
    return null
  }
}

// ============================================
// Entity Table Readers
// ============================================

async function readProducts(orgId: string, shopId?: string, params?: Record<string, string>): Promise<unknown> {
  let items = await db.products.where('organizationId').equals(orgId).toArray()

  if (shopId) {
    items = items.filter(p => p.shopId === shopId || !p.shopId)
  }

  // Apply search filter
  if (params?.search) {
    const q = params.search.toLowerCase()
    items = items.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    )
  }

  // Apply active filter
  if (params?.isActive !== undefined) {
    items = items.filter(p => p.isActive === (params.isActive === 'true'))
  }

  // Apply limit
  const limit = params?.limit ? parseInt(params.limit) : items.length
  const page = params?.page ? parseInt(params.page) : 1
  const start = (page - 1) * limit
  const paged = items.slice(start, start + limit)

  // Map to API format
  const products = paged.map(mapProductToApi)

  return {
    products,
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.ceil(items.length / limit),
    },
  }
}

function mapProductToApi(p: LocalProduct) {
  return {
    id: p.id,
    productTypeId: p.productTypeId,
    organizationId: p.organizationId,
    shopId: p.shopId ?? null,
    sku: p.sku ?? null,
    name: p.name,
    description: p.description ?? null,
    imageUrl: p.imageUrl ?? null,
    quantity: p.quantity,
    costPrice: p.costPrice,
    sellingPrice: p.sellingPrice,
    lowStockThreshold: p.lowStockThreshold,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

async function readCategories(orgId: string, _shopId?: string): Promise<unknown> {
  const items = await db.categories.where('organizationId').equals(orgId).toArray()
  const productTypes = items.map(c => ({
    id: c.id,
    organizationId: c.organizationId,
    name: c.name,
    icon: c.icon ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }))
  return { productTypes }
}

async function readCustomers(orgId: string, shopId?: string, params?: Record<string, string>): Promise<unknown> {
  let items = await db.customers.where('organizationId').equals(orgId).toArray()

  if (shopId) {
    items = items.filter(c => c.shopId === shopId || !c.shopId)
  }

  if (params?.search) {
    const q = params.search.toLowerCase()
    items = items.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    )
  }

  const limit = params?.limit ? parseInt(params.limit) : items.length
  const page = params?.page ? parseInt(params.page) : 1
  const start = (page - 1) * limit
  const paged = items.slice(start, start + limit)

  const customers = paged.map(c => ({
    id: c.id,
    organizationId: c.organizationId,
    shopId: c.shopId ?? null,
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    address: c.address ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }))

  return {
    customers,
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.ceil(items.length / limit),
    },
  }
}

async function readSuppliers(orgId: string, shopId?: string, params?: Record<string, string>): Promise<unknown> {
  let items = await db.suppliers.where('organizationId').equals(orgId).toArray()

  if (shopId) {
    items = items.filter(s => s.shopId === shopId || !s.shopId)
  }

  if (params?.search) {
    const q = params.search.toLowerCase()
    items = items.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q))
    )
  }

  const limit = params?.limit ? parseInt(params.limit) : items.length
  const page = params?.page ? parseInt(params.page) : 1
  const start = (page - 1) * limit
  const paged = items.slice(start, start + limit)

  const suppliers = paged.map(s => ({
    id: s.id,
    organizationId: s.organizationId,
    shopId: s.shopId ?? null,
    name: s.name,
    email: s.email ?? null,
    phone: s.phone ?? null,
    address: s.address ?? null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }))

  return {
    suppliers,
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.ceil(items.length / limit),
    },
  }
}

async function readSales(orgId: string, shopId?: string, params?: Record<string, string>): Promise<unknown> {
  let items = await db.sales.where('organizationId').equals(orgId).toArray()

  if (shopId) {
    items = items.filter(s => s.shopId === shopId || !s.shopId)
  }

  if (params?.status) {
    items = items.filter(s => s.status === params.status)
  }

  // Sort by date descending
  items.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())

  const limit = params?.limit ? parseInt(params.limit) : items.length
  const page = params?.page ? parseInt(params.page) : 1
  const start = (page - 1) * limit
  const paged = items.slice(start, start + limit)

  const sales = paged.map(s => ({
    id: s.id,
    organizationId: s.organizationId,
    shopId: s.shopId ?? null,
    customerId: s.customerId ?? null,
    invoiceNumber: s.invoiceNumber,
    status: s.status,
    paymentMethod: s.paymentMethod,
    subtotal: s.subtotal,
    discount: s.discount,
    tax: s.tax,
    total: s.total,
    amountPaid: s.amountPaid,
    notes: s.notes ?? null,
    saleDate: s.saleDate,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }))

  return {
    sales,
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.ceil(items.length / limit),
    },
  }
}

async function readDebts(orgId: string, shopId?: string, params?: Record<string, string>): Promise<unknown> {
  let items = await db.debts.where('organizationId').equals(orgId).toArray()

  if (shopId) {
    items = items.filter(d => d.shopId === shopId || !d.shopId)
  }

  if (params?.type) {
    items = items.filter(d => d.type === params.type)
  }
  if (params?.status && params.status !== 'all') {
    items = items.filter(d => d.status === params.status)
  }

  const limit = params?.limit ? parseInt(params.limit) : items.length
  const page = params?.page ? parseInt(params.page) : 1
  const start = (page - 1) * limit
  const paged = items.slice(start, start + limit)

  const debts = paged.map(d => ({
    id: d.id,
    organizationId: d.organizationId,
    shopId: d.shopId ?? null,
    customerId: d.customerId ?? null,
    supplierId: d.supplierId ?? null,
    type: d.type,
    amount: d.amount,
    paidAmount: d.paidAmount,
    dueDate: d.dueDate ?? null,
    status: d.status,
    description: d.description ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }))

  // Compute summary
  const allDebts = await db.debts.where('organizationId').equals(orgId).toArray()
  const filteredDebts = shopId
    ? allDebts.filter(d => d.shopId === shopId || !d.shopId)
    : allDebts

  const customerDebts = filteredDebts.filter(d => d.type === 'customer_debt' && d.status !== 'paid')
  const supplierDebts = filteredDebts.filter(d => d.type === 'supplier_debt' && d.status !== 'paid')

  const summary = {
    totalCustomerDebt: customerDebts.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0),
    totalSupplierDebt: supplierDebts.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0),
    totalOutstanding: filteredDebts
      .filter(d => d.status !== 'paid')
      .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0),
  }

  return {
    debts,
    summary,
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.ceil(items.length / limit),
    },
  }
}

async function readExpenses(orgId: string, shopId?: string, params?: Record<string, string>): Promise<unknown> {
  let items = await db.expenses.where('organizationId').equals(orgId).toArray()

  if (shopId) {
    items = items.filter(e => e.shopId === shopId || !e.shopId)
  }

  if (params?.category) {
    items = items.filter(e => e.category === params.category)
  }

  // Sort by date descending
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const limit = params?.limit ? parseInt(params.limit) : items.length
  const page = params?.page ? parseInt(params.page) : 1
  const start = (page - 1) * limit
  const paged = items.slice(start, start + limit)

  const expenses = paged.map(e => ({
    id: e.id,
    organizationId: e.organizationId,
    shopId: e.shopId ?? null,
    category: e.category,
    amount: e.amount,
    description: e.description ?? null,
    expenseDate: e.date,
    isRecurring: e.isRecurring ?? null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }))

  return {
    expenses,
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.ceil(items.length / limit),
    },
  }
}

async function readServiceTypes(orgId: string): Promise<unknown> {
  const items = await db.serviceTypes.where('organizationId').equals(orgId).toArray()
  const serviceTypes = items.map(st => ({
    id: st.id,
    organizationId: st.organizationId,
    name: st.name,
    description: st.description ?? null,
    duration: st.duration,
    price: st.price,
    imageUrl: st.imageUrl ?? null,
    isActive: st.isActive,
    createdAt: st.createdAt,
    updatedAt: st.updatedAt,
  }))
  return { serviceTypes }
}

async function readServiceBookings(orgId: string, shopId?: string, params?: Record<string, string>): Promise<unknown> {
  let items = await db.serviceBookings.where('organizationId').equals(orgId).toArray()

  if (shopId) {
    items = items.filter(b => b.shopId === shopId || !b.shopId)
  }

  if (params?.status) {
    items = items.filter(b => b.status === params.status)
  }

  const limit = params?.limit ? parseInt(params.limit) : items.length
  const page = params?.page ? parseInt(params.page) : 1
  const start = (page - 1) * limit
  const paged = items.slice(start, start + limit)

  const bookings = paged.map(b => ({
    id: b.id,
    organizationId: b.organizationId,
    shopId: b.shopId ?? null,
    serviceTypeId: b.serviceTypeId ?? null,
    customerId: b.customerId ?? null,
    customerName: b.customerName,
    customerPhone: b.customerPhone ?? null,
    status: b.status,
    bookingDate: b.bookingDate,
    startTime: b.startTime,
    endTime: b.endTime,
    notes: b.notes ?? null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }))

  return {
    bookings,
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.ceil(items.length / limit),
    },
  }
}

async function readPurchaseOrders(orgId: string, shopId?: string): Promise<unknown> {
  let items = await db.purchaseOrders.where('organizationId').equals(orgId).toArray()

  if (shopId) {
    items = items.filter(po => po.shopId === shopId || !po.shopId)
  }

  const purchaseOrders = items.map(po => ({
    id: po.id,
    organizationId: po.organizationId,
    shopId: po.shopId ?? null,
    supplierId: po.supplierId ?? null,
    status: po.status,
    totalAmount: po.totalAmount,
    notes: po.notes ?? null,
    createdAt: po.createdAt,
    updatedAt: po.updatedAt,
  }))

  return { purchaseOrders }
}

async function readShops(orgId: string): Promise<unknown> {
  const items = await db.shops.where('organizationId').equals(orgId).toArray()
  const shops = items.map(s => ({
    id: s.id,
    organizationId: s.organizationId,
    name: s.name,
    address: s.address ?? null,
    city: s.city ?? null,
    phone: s.phone ?? null,
    isActive: s.isActive,
  }))
  return { shops }
}

async function readInventory(orgId: string, shopId?: string): Promise<unknown> {
  // Reconstruct inventory from products and stock movements
  let products = await db.products.where('organizationId').equals(orgId).toArray()

  if (shopId) {
    products = products.filter(p => p.shopId === shopId || !p.shopId)
  }

  const movements = await db.stockMovements
    .where('organizationId').equals(orgId)
    .toArray()

  const recentMovements = movements
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)

  const outOfStockCount = products.filter(p => p.quantity === 0).length
  const lowStockCount = products.filter(p => p.quantity > 0 && p.quantity <= p.lowStockThreshold).length
  const totalStockCostValue = products.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0)
  const totalStockRetailValue = products.reduce((sum, p) => sum + (p.quantity * p.sellingPrice), 0)

  return {
    products: products.map(mapProductToApi),
    recentMovements,
    stats: {
      totalProducts: products.length,
      outOfStockCount,
      lowStockCount,
      totalStockCostValue,
      totalStockRetailValue,
    },
  }
}

async function readDashboard(orgId: string, shopId?: string, params?: Record<string, string>): Promise<unknown> {
  // Reconstruct dashboard from local data
  let products = await db.products.where('organizationId').equals(orgId).toArray()
  let sales = await db.sales.where('organizationId').equals(orgId).toArray()
  let expenses = await db.expenses.where('organizationId').equals(orgId).toArray()
  let debts = await db.debts.where('organizationId').equals(orgId).toArray()

  if (shopId) {
    products = products.filter(p => p.shopId === shopId || !p.shopId)
    sales = sales.filter(s => s.shopId === shopId || !s.shopId)
    expenses = expenses.filter(e => e.shopId === shopId || !e.shopId)
    debts = debts.filter(d => d.shopId === shopId || !d.shopId)
  }

  // Date filtering
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const from = params?.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const to = params?.to || today

  const periodSales = sales.filter(s => {
    const d = s.saleDate.split('T')[0]
    return d >= from && d <= to
  })

  const todaySales = sales.filter(s => s.saleDate.split('T')[0] === today)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthSales = sales.filter(s => s.saleDate.split('T')[0] >= monthStart)

  const periodExpenses = expenses.filter(e => {
    const d = e.date.split('T')[0]
    return d >= from && d <= to
  })

  const outOfStockCount = products.filter(p => p.quantity === 0).length
  const lowStockCount = products.filter(p => p.quantity > 0 && p.quantity <= p.lowStockThreshold).length
  const totalStockCostValue = products.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0)
  const totalStockRetailValue = products.reduce((sum, p) => sum + (p.quantity * p.sellingPrice), 0)

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0)
  const monthRevenue = monthSales.reduce((sum, s) => sum + s.total, 0)
  const periodRevenue = periodSales.reduce((sum, s) => sum + s.total, 0)
  const periodCogs = periodSales.reduce((sum, s) => sum + s.subtotal * 0.6, 0) // Estimated COGS
  const periodExpenseTotal = periodExpenses.reduce((sum, e) => sum + e.amount, 0)

  const totalCustomerDebt = debts
    .filter(d => d.type === 'customer_debt' && d.status !== 'paid')
    .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)

  // Simple comparison: previous period
  const periodDays = Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)))
  const prevFrom = new Date(new Date(from).getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const prevSales = sales.filter(s => {
    const d = s.saleDate.split('T')[0]
    return d >= prevFrom && d < from
  })
  const prevExpenses = expenses.filter(e => {
    const d = e.date.split('T')[0]
    return d >= prevFrom && d < from
  })
  const prevRevenue = prevSales.reduce((sum, s) => sum + s.total, 0)
  const prevExpenseTotal = prevExpenses.reduce((sum, e) => sum + e.amount, 0)

  const revenueChange = prevRevenue > 0 ? ((periodRevenue - prevRevenue) / prevRevenue) * 100 : 0
  const expenseChange = prevExpenseTotal > 0 ? ((periodExpenseTotal - prevExpenseTotal) / prevExpenseTotal) * 100 : 0
  const periodNetProfit = periodRevenue - periodCogs - periodExpenseTotal
  const prevNetProfit = prevRevenue - prevCogs(prevSales) - prevExpenseTotal
  const netProfitChange = prevNetProfit !== 0 ? ((periodNetProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100 : 0
  const salesCountChange = prevSales.length > 0 ? ((periodSales.length - prevSales.length) / prevSales.length) * 100 : 0

  // Build daily revenue chart data
  const dailyRevenue: Array<{ date: string; revenue: number; expenses: number }> = []
  for (let i = 0; i < Math.min(periodDays, 30); i++) {
    const date = new Date(new Date(from).getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const dayRevenue = periodSales.filter(s => s.saleDate.split('T')[0] === date).reduce((sum, s) => sum + s.total, 0)
    const dayExpenses = periodExpenses.filter(e => e.date.split('T')[0] === date).reduce((sum, e) => sum + e.amount, 0)
    dailyRevenue.push({ date, revenue: dayRevenue, expenses: dayExpenses })
  }

  // Recent sales for the table
  const recentSales = sales
    .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
    .slice(0, 5)
    .map(s => ({
      id: s.id,
      organizationId: s.organizationId,
      shopId: s.shopId ?? null,
      customerId: s.customerId ?? null,
      invoiceNumber: s.invoiceNumber,
      status: s.status,
      paymentMethod: s.paymentMethod,
      subtotal: s.subtotal,
      discount: s.discount,
      tax: s.tax,
      total: s.total,
      amountPaid: s.amountPaid,
      notes: s.notes ?? null,
      saleDate: s.saleDate,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))

  // Low stock products
  const lowStockProducts = products
    .filter(p => p.quantity > 0 && p.quantity <= p.lowStockThreshold)
    .slice(0, 5)
    .map(mapProductToApi)

  // Top selling products
  const topProducts = products
    .sort((a, b) => b.sellingPrice * b.quantity - a.sellingPrice * a.quantity)
    .slice(0, 5)
    .map(mapProductToApi)

  // Recent debts
  const recentDebts = debts
    .filter(d => d.status !== 'paid')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(d => ({
      id: d.id,
      organizationId: d.organizationId,
      shopId: d.shopId ?? null,
      customerId: d.customerId ?? null,
      supplierId: d.supplierId ?? null,
      type: d.type,
      amount: d.amount,
      paidAmount: d.paidAmount,
      dueDate: d.dueDate ?? null,
      status: d.status,
      description: d.description ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }))

  return {
    stats: {
      totalProducts: products.length,
      outOfStockCount,
      lowStockCount,
      totalStockCostValue,
      totalStockRetailValue,
      todayRevenue,
      todaySalesCount: todaySales.length,
      monthRevenue,
      totalCustomerDebt,
      periodRevenue,
      periodExpenses: periodExpenseTotal,
      periodCogs,
      periodNetProfit,
      periodSalesCount: periodSales.length,
    },
    comparison: {
      revenueChange,
      expenseChange,
      netProfitChange,
      salesCountChange,
      prevRevenue,
      prevExpenses: prevExpenseTotal,
      prevNetProfit,
      prevSalesCount: prevSales.length,
    },
    dailyRevenue,
    recentSales,
    lowStockProducts,
    topProducts,
    recentDebts,
    _offline: true, // Flag to indicate this is offline data
  }
}

function prevCogs(prevSales: LocalSale[]): number {
  return prevSales.reduce((sum, s) => sum + s.subtotal * 0.6, 0)
}

async function readReports(orgId: string, shopId?: string, params?: Record<string, string>): Promise<unknown> {
  // Reconstruct reports from local data
  let sales = await db.sales.where('organizationId').equals(orgId).toArray()
  let expenses = await db.expenses.where('organizationId').equals(orgId).toArray()

  if (shopId) {
    sales = sales.filter(s => s.shopId === shopId || !s.shopId)
    expenses = expenses.filter(e => e.shopId === shopId || !e.shopId)
  }

  const startDate = params?.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const endDate = params?.endDate || new Date().toISOString().split('T')[0]

  const periodSales = sales.filter(s => {
    const d = s.saleDate.split('T')[0]
    return d >= startDate && d <= endDate
  })
  const periodExpenses = expenses.filter(e => {
    const d = e.date.split('T')[0]
    return d >= startDate && d <= endDate
  })

  const totalRevenue = periodSales.reduce((sum, s) => sum + s.total, 0)
  const totalExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0)
  const totalCogs = periodSales.reduce((sum, s) => sum + s.subtotal * 0.6, 0)
  const netProfit = totalRevenue - totalCogs - totalExpenses

  // Daily data
  const dailyData: Array<{ date: string; revenue: number; expenses: number; profit: number; salesCount: number }> = []
  const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
  for (let i = 0; i <= Math.min(daysDiff, 60); i++) {
    const date = new Date(new Date(startDate).getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const daySales = periodSales.filter(s => s.saleDate.split('T')[0] === date)
    const dayExpenses = periodExpenses.filter(e => e.date.split('T')[0] === date)
    const dayRevenue = daySales.reduce((sum, s) => sum + s.total, 0)
    const dayExpense = dayExpenses.reduce((sum, e) => sum + e.amount, 0)
    dailyData.push({
      date,
      revenue: dayRevenue,
      expenses: dayExpense,
      profit: dayRevenue - dayExpense,
      salesCount: daySales.length,
    })
  }

  return {
    summary: {
      totalRevenue,
      totalExpenses,
      totalCogs,
      netProfit,
      salesCount: periodSales.length,
      averageSaleValue: periodSales.length > 0 ? totalRevenue / periodSales.length : 0,
    },
    dailyData,
    _offline: true,
  }
}

// ============================================
// Main Offline Fallback Function
// ============================================

type EntityReader = (orgId: string, shopId?: string, params?: Record<string, string>) => Promise<unknown>

const ENTITY_READERS: Record<string, EntityReader> = {
  products: readProducts,
  categories: readCategories,
  customers: readCustomers,
  suppliers: readSuppliers,
  sales: readSales,
  debts: readDebts,
  expenses: readExpenses,
  serviceTypes: readServiceTypes,
  serviceBookings: readServiceBookings,
  purchaseOrders: readPurchaseOrders,
  shops: readShops,
  stockMovements: readInventory,
  dashboard: readDashboard,
  reports: readReports,
}

/**
 * Attempts to reconstruct an API response from IndexedDB entity tables.
 * Called by the API client when:
 * 1. The user is offline (navigator.onLine === false)
 * 2. The network request failed
 * 3. The exact URL-based cache key doesn't have a match
 *
 * Returns null if the URL can't be mapped to an entity table.
 */
export async function getOfflineFallback<T>(url: string): Promise<T | null> {
  const parsed = parseApiUrl(url)
  if (!parsed || !parsed.orgId) return null

  const reader = ENTITY_READERS[parsed.entity]
  if (!reader) return null

  try {
    const data = await reader(parsed.orgId, parsed.shopId, parsed.params)
    if (data !== null) {
      console.log(`[OfflineFallback] Reconstructed ${parsed.entity} from IndexedDB for offline access`)
      return data as T
    }
  } catch (err) {
    console.warn(`[OfflineFallback] Failed to reconstruct ${parsed.entity}:`, err)
  }

  return null
}

/**
 * Checks if offline fallback data is available for a given URL.
 * Quick check that doesn't read all the data — just verifies the
 * relevant entity table has records for the given orgId.
 */
export async function hasOfflineData(url: string): Promise<boolean> {
  const parsed = parseApiUrl(url)
  if (!parsed || !parsed.orgId) return false

  const tableMap: Record<string, string> = {
    products: 'products',
    categories: 'categories',
    customers: 'customers',
    suppliers: 'suppliers',
    sales: 'sales',
    debts: 'debts',
    expenses: 'expenses',
    serviceTypes: 'serviceTypes',
    serviceBookings: 'serviceBookings',
    purchaseOrders: 'purchaseOrders',
    shops: 'shops',
    stockMovements: 'stockMovements',
    dashboard: 'sales', // Dashboard uses sales data
    reports: 'sales', // Reports uses sales data
  }

  const tableName = tableMap[parsed.entity]
  if (!tableName) return false

  try {
    const count = await db.table(tableName)
      .where('organizationId')
      .equals(parsed.orgId)
      .count()
    return count > 0
  } catch {
    return false
  }
}

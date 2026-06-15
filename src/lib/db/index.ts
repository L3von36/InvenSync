// ============================================
// InvenSync — Dexie.js Offline-First Database
// ============================================
// Local IndexedDB database for offline-first inventory management.
// Mirrors key server entities for the shop dashboard, scoped by
// organizationId (multi-tenant) and optionally by shopId.
// ============================================

import Dexie, { type EntityTable } from 'dexie'

// -------------------------------------------
// Entity Interfaces
// -------------------------------------------

/** Product catalog item — mirrors the Product type from api-client */
export interface LocalProduct {
  id: string
  productTypeId: string
  organizationId: string
  shopId?: string | null
  sku?: string | null
  name: string
  description?: string | null
  imageUrl?: string | null
  quantity: number
  costPrice: number
  sellingPrice: number
  lowStockThreshold: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Product type / category — mirrors ProductType from api-client */
export interface LocalCategory {
  id: string
  organizationId: string
  name: string
  icon?: string | null
  createdAt: string
  updatedAt: string
}

/** Customer record — mirrors Customer from api-client */
export interface LocalCustomer {
  id: string
  organizationId: string
  shopId?: string | null
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  createdAt: string
  updatedAt: string
}

/** Supplier record — mirrors Supplier from api-client */
export interface LocalSupplier {
  id: string
  organizationId: string
  shopId?: string | null
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  createdAt: string
  updatedAt: string
}

/** Sale / invoice — mirrors Sale from api-client */
export interface LocalSale {
  id: string
  organizationId: string
  shopId?: string | null
  customerId?: string | null
  invoiceNumber: string
  status: string
  paymentMethod: string
  subtotal: number
  discount: number
  tax: number
  total: number
  amountPaid: number
  notes?: string | null
  saleDate: string
  createdAt: string
  updatedAt: string
}

/** Individual line item within a sale — mirrors SaleItem from api-client */
export interface LocalSaleItem {
  id: string
  saleId: string
  productId: string
  quantity: number
  unitPrice: number
  costPrice: number
  total: number
}

/** Stock movement log — mirrors StockMovement from api-client */
export interface LocalStockMovement {
  id: string
  organizationId: string
  shopId?: string | null
  productId: string
  type: string
  quantity: number
  previousStock: number
  newStock: number
  reason?: string | null
  reference?: string | null
  createdAt: string
}

/** Debt record (receivable or payable) — mirrors Debt from api-client */
export interface LocalDebt {
  id: string
  organizationId: string
  shopId?: string | null
  customerId?: string | null
  supplierId?: string | null
  type: string
  amount: number
  paidAmount: number
  dueDate?: string | null
  status: string
  description?: string | null
  createdAt: string
  updatedAt: string
}

/** Purchase order to supplier — mirrors PurchaseOrder from Prisma schema */
export interface LocalPurchaseOrder {
  id: string
  organizationId: string
  shopId?: string | null
  supplierId?: string | null
  status: string
  totalAmount: number
  notes?: string | null
  createdAt: string
  updatedAt: string
}

/** Line item within a purchase order — mirrors PurchaseOrderItem from Prisma schema */
export interface LocalPurchaseOrderItem {
  id: string
  purchaseOrderId: string
  productId: string
  quantity: number
  unitPrice: number
  total: number
}

/** Service booking / appointment — mirrors ServiceBooking from api-client */
export interface LocalServiceBooking {
  id: string
  organizationId: string
  shopId?: string | null
  serviceTypeId?: string | null
  customerId?: string | null
  customerName: string
  customerPhone?: string | null
  status: string
  bookingDate: string
  startTime: string
  endTime: string
  notes?: string | null
  createdAt: string
  updatedAt: string
}

/** Service type definition — mirrors ServiceType from api-client */
export interface LocalServiceType {
  id: string
  organizationId: string
  name: string
  description?: string | null
  duration: number
  price: number
  imageUrl?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Expense record — mirrors Expense from api-client */
export interface LocalExpense {
  id: string
  organizationId: string
  shopId?: string | null
  category: string
  amount: number
  description?: string | null
  date: string
  isRecurring?: boolean | null
  createdAt: string
  updatedAt: string
}

/** Shop / branch — mirrors Shop from api-client */
export interface LocalShop {
  id: string
  organizationId: string
  name: string
  address?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  phone?: string | null
  isActive: boolean
}

/** Sync outbox entry — queue of pending mutations to send to the server */
export interface LocalOutbox {
  id: string
  /** Target entity table name (e.g. 'products', 'sales') */
  entity: string
  /** Type of mutation operation */
  operation: 'create' | 'update' | 'delete'
  /** Serialized payload to send to the server */
  payload: string
  /** Client-generated ID used before server confirms */
  localId?: string | null
  /** Server-assigned ID once confirmed */
  serverId?: string | null
  createdAt: string
  /** Number of retry attempts */
  retryCount: number
  /** Current sync status */
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict'
  /** Last error message if failed */
  error?: string | null
  /** Timestamp of the most recent sync attempt */
  lastAttemptAt?: string | null
}

/** Per-entity sync metadata — tracks last sync timestamps and tokens */
export interface LocalSyncMeta {
  /** Entity table name (acts as primary key) */
  id: string
  /** ISO timestamp of the last incremental sync */
  lastSyncedAt: string
  /** Cursor / token for incremental delta syncs */
  lastSyncToken?: string | null
  /** Number of locally cached records for this entity */
  entityCount: number
  /** ISO timestamp of the last full (non-incremental) sync */
  lastFullSyncAt?: string | null
}

/** Cached API response for offline fallback */
export interface LocalApiCache {
  /** Cache key: method:url (e.g. 'GET:/api/products?orgId=xxx') */
  id: string
  /** Serialized JSON response */
  data: string
  /** ISO timestamp when this cache entry was created */
  cachedAt: string
  /** ISO timestamp when this entry expires */
  expiresAt: string
}

/** Cached user profile for offline access */
export interface LocalUserProfile {
  /** User ID (primary key) */
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  role?: string | null
  /** Serialized JSON of the user's organization memberships */
  organizations: string
  currentOrgId: string
  currentShopId?: string | null
  /** ISO timestamp when this profile was last cached */
  cachedAt: string
}

// -------------------------------------------
// Database Class
// -------------------------------------------

/**
 * InvenSync offline-first IndexedDB database.
 *
 * All business entities are scoped by `organizationId` (multi-tenant) and
 * optionally by `shopId` for shop-level filtering. The `outbox` table acts
 * as a mutation queue for syncing local changes back to the server, and
 * `syncMeta` tracks per-entity sync state.
 */
class InvenSyncDatabase extends Dexie {
  products!: EntityTable<LocalProduct, 'id'>
  categories!: EntityTable<LocalCategory, 'id'>
  customers!: EntityTable<LocalCustomer, 'id'>
  suppliers!: EntityTable<LocalSupplier, 'id'>
  sales!: EntityTable<LocalSale, 'id'>
  saleItems!: EntityTable<LocalSaleItem, 'id'>
  stockMovements!: EntityTable<LocalStockMovement, 'id'>
  debts!: EntityTable<LocalDebt, 'id'>
  purchaseOrders!: EntityTable<LocalPurchaseOrder, 'id'>
  purchaseOrderItems!: EntityTable<LocalPurchaseOrderItem, 'id'>
  serviceBookings!: EntityTable<LocalServiceBooking, 'id'>
  serviceTypes!: EntityTable<LocalServiceType, 'id'>
  expenses!: EntityTable<LocalExpense, 'id'>
  shops!: EntityTable<LocalShop, 'id'>
  outbox!: EntityTable<LocalOutbox, 'id'>
  syncMeta!: EntityTable<LocalSyncMeta, 'id'>
  apiCache!: EntityTable<LocalApiCache, 'id'>
  userProfile!: EntityTable<LocalUserProfile, 'id'>

  constructor() {
    super('InvenSync')

    this.version(1).stores({
      // Business entities — all org-scoped tables get organizationId index
      // Tables with shopId also get a compound [organizationId+shopId] index
      products:
        'id, organizationId, [organizationId+shopId], productTypeId, sku, name, isActive, createdAt, updatedAt',
      categories:
        'id, organizationId, name, createdAt, updatedAt',
      customers:
        'id, organizationId, [organizationId+shopId], name, phone, email, createdAt, updatedAt',
      suppliers:
        'id, organizationId, [organizationId+shopId], name, phone, email, createdAt, updatedAt',
      sales:
        'id, organizationId, [organizationId+shopId], customerId, invoiceNumber, status, paymentMethod, saleDate, createdAt, updatedAt',
      saleItems:
        'id, saleId, productId',
      stockMovements:
        'id, organizationId, [organizationId+shopId], productId, type, createdAt',
      debts:
        'id, organizationId, [organizationId+shopId], customerId, supplierId, type, status, dueDate, createdAt, updatedAt',
      purchaseOrders:
        'id, organizationId, [organizationId+shopId], supplierId, status, createdAt, updatedAt',
      purchaseOrderItems:
        'id, purchaseOrderId, productId',
      serviceBookings:
        'id, organizationId, [organizationId+shopId], serviceTypeId, customerId, status, bookingDate, createdAt, updatedAt',
      serviceTypes:
        'id, organizationId, name, isActive, createdAt, updatedAt',
      expenses:
        'id, organizationId, [organizationId+shopId], category, date, createdAt, updatedAt',
      shops:
        'id, organizationId, name, city, isActive',

      // Sync infrastructure
      outbox:
        'id, [entity+status], status, createdAt',
      syncMeta:
        'id, lastSyncedAt',

      // API response cache for offline fallback
      apiCache:
        'id, cachedAt, expiresAt',

      // User profile cache
      userProfile:
        'id, email',
    })
  }
}

// -------------------------------------------
// Singleton Instance
// -------------------------------------------

/** Shared Dexie database instance for the entire application */
export const db = new InvenSyncDatabase()

// -------------------------------------------
// Helper Functions
// -------------------------------------------

/**
 * Clears all data from every table in the local database.
 * Use this when the user logs out or switches organizations
 * to ensure no stale data persists.
 */
export async function clearLocalDatabase(): Promise<void> {
  await Promise.all([
    db.products.clear(),
    db.categories.clear(),
    db.customers.clear(),
    db.suppliers.clear(),
    db.sales.clear(),
    db.saleItems.clear(),
    db.stockMovements.clear(),
    db.debts.clear(),
    db.purchaseOrders.clear(),
    db.purchaseOrderItems.clear(),
    db.serviceBookings.clear(),
    db.serviceTypes.clear(),
    db.expenses.clear(),
    db.shops.clear(),
    db.outbox.clear(),
    db.syncMeta.clear(),
    db.apiCache.clear(),
    db.userProfile.clear(),
  ])
}

/**
 * Returns a record mapping each table name to its current record count.
 * Useful for debugging, sync status display, and storage auditing.
 */
export async function getLocalDataStats(): Promise<Record<string, number>> {
  const [
    products,
    categories,
    customers,
    suppliers,
    sales,
    saleItems,
    stockMovements,
    debts,
    purchaseOrders,
    purchaseOrderItems,
    serviceBookings,
    serviceTypes,
    expenses,
    shops,
    outbox,
    syncMeta,
    apiCache,
    userProfile,
  ] = await Promise.all([
    db.products.count(),
    db.categories.count(),
    db.customers.count(),
    db.suppliers.count(),
    db.sales.count(),
    db.saleItems.count(),
    db.stockMovements.count(),
    db.debts.count(),
    db.purchaseOrders.count(),
    db.purchaseOrderItems.count(),
    db.serviceBookings.count(),
    db.serviceTypes.count(),
    db.expenses.count(),
    db.shops.count(),
    db.outbox.count(),
    db.syncMeta.count(),
    db.apiCache.count(),
    db.userProfile.count(),
  ])

  return {
    products,
    categories,
    customers,
    suppliers,
    sales,
    saleItems,
    stockMovements,
    debts,
    purchaseOrders,
    purchaseOrderItems,
    serviceBookings,
    serviceTypes,
    expenses,
    shops,
    outbox,
    syncMeta,
    apiCache,
    userProfile,
  }
}

/**
 * Estimates the total storage usage of the local database in bytes
 * using the Storage API (navigator.storage.estimate).
 * Returns { usage, quota } or null if the API is unavailable.
 */
export async function getDatabaseSize(): Promise<{
  usage: number
  quota: number
} | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return null
  }

  try {
    const estimate = await navigator.storage.estimate()
    return {
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
    }
  } catch {
    return null
  }
}

/**
 * Checks whether the local database has been bootstrapped
 * (i.e., at least one syncMeta entry exists, meaning an initial
 * sync has been completed).
 */
export async function isDatabaseReady(): Promise<boolean> {
  try {
    const count = await db.syncMeta.count()
    return count > 0
  } catch {
    return false
  }
}

// -------------------------------------------
// API Response Cache Helpers
// -------------------------------------------

/** Default TTL for cached API responses: 24 hours */
const API_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Stores an API response in the persistent cache.
 */
export async function cacheApiResponse(key: string, data: unknown, ttlMs: number = API_CACHE_TTL_MS): Promise<void> {
  try {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlMs)
    await db.apiCache.put({
      id: key,
      data: JSON.stringify(data),
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
  } catch (err) {
    // Non-critical — don't break the app if caching fails
    console.warn('[ApiCache] Failed to cache response:', err)
  }
}

/**
 * Retrieves a cached API response.
 * Returns null if not found or expired.
 */
export async function getCachedApiResponse<T>(key: string): Promise<T | null> {
  try {
    const entry = await db.apiCache.get(key)
    if (!entry) return null

    // Check if expired
    const expiresAt = new Date(entry.expiresAt).getTime()
    if (Date.now() > expiresAt) {
      // Clean up expired entry
      await db.apiCache.delete(key)
      return null
    }

    return JSON.parse(entry.data) as T
  } catch (err) {
    console.warn('[ApiCache] Failed to read cached response:', err)
    return null
  }
}

/**
 * Removes expired entries from the API cache.
 * Call periodically to prevent unbounded growth.
 */
export async function purgeExpiredCacheEntries(): Promise<number> {
  try {
    const now = new Date().toISOString()
    const expired = await db.apiCache.where('expiresAt').below(now).toArray()
    if (expired.length > 0) {
      await db.apiCache.bulkDelete(expired.map(e => e.id))
    }
    return expired.length
  } catch {
    return 0
  }
}

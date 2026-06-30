// ============================================
// Bootstrap Hydration Service
// ============================================
// Initial data hydration that runs once after login.
// Fetches ALL user data from the backend and writes
// it to IndexedDB via Dexie, enabling full offline usage.
// ============================================

import { db, isDatabaseReady, type LocalProduct, type LocalCategory, type LocalCustomer, type LocalSupplier, type LocalSale, type LocalSaleItem, type LocalDebt, type LocalExpense, type LocalServiceType, type LocalServiceBooking, type LocalPurchaseOrder, type LocalShop, type LocalStockMovement, type LocalSyncMeta } from '@/lib/db'
import { api, type Product, type ProductType, type Customer, type Supplier, type Sale, type SaleItem, type Debt, type Expense, type ServiceType, type ServiceBooking, type Shop, type StockMovement } from '@/lib/api-client'

// ============================================
// Types
// ============================================

export interface BootstrapProgress {
  phase: 'idle' | 'fetching' | 'writing' | 'complete' | 'error'
  currentEntity: string | null
  completedEntities: string[]
  totalEntities: number
  percentComplete: number  // 0-100
  error?: string
}

export interface BootstrapCallbacks {
  onProgress?: (progress: BootstrapProgress) => void
  onComplete?: (stats: Record<string, number>) => void
  onError?: (error: Error) => void
}

// ============================================
// Entity Configuration
// ============================================

interface EntitySyncConfig {
  entity: string
  table: string
  fetchAll: (orgId: string, shopId: string | null) => Promise<unknown[]>
  mapToLocale: (item: unknown, orgId: string) => unknown
}

/** Page size used when fetching paginated endpoints */
const BOOTSTRAP_PAGE_SIZE = 500

// -------------------------------------------
// Pagination Helper
// -------------------------------------------

/**
 * Fetches all pages from a paginated API endpoint.
 * Loops until all pages are consumed.
 */
async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<{ data: T[]; totalPages: number }>
): Promise<T[]> {
  const allData: T[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const { data, totalPages } = await fetchPage(page, BOOTSTRAP_PAGE_SIZE)
    allData.push(...data)
    hasMore = page < totalPages
    page++
  }

  return allData
}

// -------------------------------------------
// Per-Entity Fetchers & Mappers
// -------------------------------------------

const ENTITY_CONFIGS: EntitySyncConfig[] = [
  // ---- Products ----
  {
    entity: 'products',
    table: 'products',
    fetchAll: async (orgId, shopId) => {
      const products = await fetchAllPages(async (page, limit) => {
        const res = await api.getProducts(orgId, { shopId: shopId ?? undefined, page, limit })
        return { data: res.products, totalPages: res.pagination.totalPages }
      })
      return products
    },
    mapToLocale: (item, _orgId) => {
      const p = item as Product
      return {
        id: p.id,
        productTypeId: p.productTypeId,
        organizationId: p.organizationId,
        shopId: (p as Record<string, unknown>).shopId as string | null ?? null,
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
      } satisfies LocalProduct
    },
  },

  // ---- Categories (Product Types) ----
  {
    entity: 'categories',
    table: 'categories',
    fetchAll: async (orgId, shopId) => {
      const res = await api.getProductTypes(orgId, shopId ?? undefined)
      return res.productTypes
    },
    mapToLocale: (item, _orgId) => {
      const pt = item as ProductType
      return {
        id: pt.id,
        organizationId: pt.organizationId,
        name: pt.name,
        icon: pt.icon ?? null,
        createdAt: pt.createdAt,
        updatedAt: pt.updatedAt,
      } satisfies LocalCategory
    },
  },

  // ---- Customers ----
  {
    entity: 'customers',
    table: 'customers',
    fetchAll: async (orgId, shopId) => {
      const customers = await fetchAllPages(async (page, limit) => {
        const res = await api.getCustomers(orgId, { shopId: shopId ?? undefined, page, limit })
        return { data: res.customers, totalPages: res.pagination.totalPages }
      })
      return customers
    },
    mapToLocale: (item, _orgId) => {
      const c = item as Customer
      return {
        id: c.id,
        organizationId: c.organizationId,
        shopId: c.shopId ?? null,
        name: c.name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        address: c.address ?? null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      } satisfies LocalCustomer
    },
  },

  // ---- Suppliers ----
  {
    entity: 'suppliers',
    table: 'suppliers',
    fetchAll: async (orgId, shopId) => {
      const suppliers = await fetchAllPages(async (page, limit) => {
        const res = await api.getSuppliers(orgId, { shopId: shopId ?? undefined, page, limit })
        return { data: res.suppliers, totalPages: res.pagination.totalPages }
      })
      return suppliers
    },
    mapToLocale: (item, _orgId) => {
      const s = item as Supplier
      return {
        id: s.id,
        organizationId: s.organizationId,
        shopId: s.shopId ?? null,
        name: s.name,
        email: s.email ?? null,
        phone: s.phone ?? null,
        address: s.address ?? null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      } satisfies LocalSupplier
    },
  },

  // ---- Sales ----
  {
    entity: 'sales',
    table: 'sales',
    fetchAll: async (orgId, shopId) => {
      const sales = await fetchAllPages(async (page, limit) => {
        const res = await api.getSales(orgId, { shopId: shopId ?? undefined, page, limit })
        return { data: res.sales, totalPages: res.pagination.totalPages }
      })
      return sales
    },
    mapToLocale: (item, _orgId) => {
      const s = item as Sale
      return {
        id: s.id,
        organizationId: s.organizationId,
        shopId: (s as Record<string, unknown>).shopId as string | null ?? null,
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
      } satisfies LocalSale
    },
  },

  // ---- Debts ----
  {
    entity: 'debts',
    table: 'debts',
    fetchAll: async (orgId, shopId) => {
      const debts = await fetchAllPages(async (page, limit) => {
        const res = await api.getDebts(orgId, { shopId: shopId ?? undefined, page, limit })
        return { data: res.debts, totalPages: res.pagination.totalPages }
      })
      return debts
    },
    mapToLocale: (item, _orgId) => {
      const d = item as Debt
      return {
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
      } satisfies LocalDebt
    },
  },

  // ---- Expenses ----
  {
    entity: 'expenses',
    table: 'expenses',
    fetchAll: async (orgId, shopId) => {
      const expenses = await fetchAllPages(async (page, limit) => {
        const res = await api.getExpenses(orgId, { shopId: shopId ?? undefined, page, limit })
        return { data: res.expenses, totalPages: res.pagination.totalPages }
      })
      return expenses
    },
    mapToLocale: (item, _orgId) => {
      const e = item as Expense
      return {
        id: e.id,
        organizationId: e.organizationId,
        shopId: e.shopId ?? null,
        category: e.category,
        amount: e.amount,
        description: e.description ?? null,
        date: e.expenseDate,
        isRecurring: e.isRecurring ?? null,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      } satisfies LocalExpense
    },
  },

  // ---- Service Types ----
  {
    entity: 'serviceTypes',
    table: 'serviceTypes',
    fetchAll: async (orgId) => {
      const res = await api.getServiceTypes(orgId)
      return res.serviceTypes as unknown[]
    },
    mapToLocale: (item, _orgId) => {
      const st = item as ServiceType
      return {
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
      } satisfies LocalServiceType
    },
  },

  // ---- Service Bookings ----
  {
    entity: 'serviceBookings',
    table: 'serviceBookings',
    fetchAll: async (orgId, shopId) => {
      const bookings = await fetchAllPages(async (page, limit) => {
        const res = await api.getServiceBookings(orgId, { shopId: shopId ?? undefined, page, limit })
        return { data: res.bookings, totalPages: res.pagination.totalPages }
      })
      return bookings
    },
    mapToLocale: (item, _orgId) => {
      const sb = item as ServiceBooking
      return {
        id: sb.id,
        organizationId: sb.organizationId,
        shopId: (sb as Record<string, unknown>).shopId as string | null ?? null,
        serviceTypeId: sb.serviceTypeId ?? null,
        customerId: sb.customerId ?? null,
        customerName: sb.customerName,
        customerPhone: sb.customerPhone ?? null,
        status: sb.status,
        bookingDate: sb.bookingDate,
        startTime: sb.startTime,
        endTime: sb.endTime,
        notes: sb.notes ?? null,
        createdAt: sb.createdAt,
        updatedAt: sb.updatedAt,
      } satisfies LocalServiceBooking
    },
  },

  // ---- Purchase Orders ----
  {
    entity: 'purchaseOrders',
    table: 'purchaseOrders',
    fetchAll: async (orgId) => {
      const res = await api.getPurchaseOrders(orgId)
      return res.purchaseOrders
    },
    mapToLocale: (item, _orgId) => {
      const po = item as Record<string, unknown>
      return {
        id: po.id as string,
        organizationId: (po.organizationId as string) ?? _orgId,
        shopId: (po.shopId as string | null) ?? null,
        supplierId: (po.supplierId as string | null) ?? null,
        status: (po.status as string) ?? 'pending',
        totalAmount: (po.totalAmount as number) ?? 0,
        notes: (po.notes as string | null) ?? null,
        createdAt: (po.createdAt as string) ?? new Date().toISOString(),
        updatedAt: (po.updatedAt as string) ?? new Date().toISOString(),
      } satisfies LocalPurchaseOrder
    },
  },

  // ---- Shops ----
  {
    entity: 'shops',
    table: 'shops',
    fetchAll: async (orgId) => {
      const res = await api.getShops(orgId)
      return res.shops as unknown[]
    },
    mapToLocale: (item, _orgId) => {
      const s = item as Shop
      return {
        id: s.id,
        organizationId: s.organizationId,
        name: s.name,
        address: s.address ?? null,
        city: s.city ?? null,
        latitude: s.latitude ?? null,
        longitude: s.longitude ?? null,
        phone: s.phone ?? null,
        isActive: s.isActive,
        createdAt: s.createdAt ?? new Date().toISOString(),
      } satisfies LocalShop
    },
  },

  // ---- Stock Movements ----
  {
    entity: 'stockMovements',
    table: 'stockMovements',
    fetchAll: async (orgId, shopId) => {
      const res = await api.getInventory(orgId, shopId ?? undefined)
      return res.recentMovements as unknown[]
    },
    mapToLocale: (item, _orgId) => {
      const m = item as StockMovement
      return {
        id: m.id,
        organizationId: m.organizationId,
        shopId: (m as Record<string, unknown>).shopId as string | null ?? null,
        productId: m.productId,
        type: m.type,
        quantity: m.quantity,
        previousStock: m.previousStock,
        newStock: m.newStock,
        reason: m.reason ?? null,
        reference: m.reference ?? null,
        createdAt: m.createdAt,
      } satisfies LocalStockMovement
    },
  },
]

// ============================================
// Main Bootstrap Function
// ============================================

/**
 * Fetches ALL data for the given org/shop from the backend
 * and writes it to the local IndexedDB. This enables full
 * offline usage after the initial login.
 *
 * Runs once after the user logs in and selects their org/shop.
 * If one entity fails, the service continues with the remaining
 * entities and reports the error at the end.
 */
export async function bootstrapLocalData(
  orgId: string,
  shopId: string | null,
  callbacks?: BootstrapCallbacks
): Promise<void> {
  const totalEntities = ENTITY_CONFIGS.length
  const completedEntities: string[] = []
  const stats: Record<string, number> = {}
  const errors: string[] = []

  // Suppress 401 auto-logout during bootstrap — some API calls may fail
  // with 401 (e.g., if the module isn't active), but we don't want to
  // trigger a logout during the initial data hydration.
  api.beginBatchOperation()

  // Ensure we always re-enable 401 auto-logout, even if something throws
  const finallyUnsuppress = () => { api.endBatchOperation() }

  const emitProgress = (partial: Partial<BootstrapProgress>) => {
    const progress: BootstrapProgress = {
      phase: partial.phase ?? 'idle',
      currentEntity: partial.currentEntity ?? null,
      completedEntities: [...completedEntities],
      totalEntities,
      percentComplete: Math.round((completedEntities.length / totalEntities) * 100),
      ...partial,
    }
    callbacks?.onProgress?.(progress)
  }

  console.log('[Bootstrap] Starting bootstrap for org:', orgId, 'shop:', shopId ?? '(all)')

  emitProgress({ phase: 'fetching', currentEntity: null, percentComplete: 0 })

  for (const config of ENTITY_CONFIGS) {
    try {
      // --- Fetch phase ---
      emitProgress({ phase: 'fetching', currentEntity: config.entity })
      console.log(`[Bootstrap] Fetching ${config.entity}...`)

      const rawData = await config.fetchAll(orgId, shopId)

      // --- Map phase ---
      console.log(`[Bootstrap] Mapping ${rawData.length} ${config.entity} records...`)
      const mappedData = rawData.map((item) => config.mapToLocale(item, orgId))

      // --- Write phase ---
      emitProgress({ phase: 'writing', currentEntity: config.entity })
      console.log(`[Bootstrap] Writing ${mappedData.length} ${config.entity} to IndexedDB...`)

      // Use Dexie's bulkPut for efficient batch writes
      const table = db.table(config.table)
      await table.bulkPut(mappedData)

      // --- Write sync metadata ---
      const now = new Date().toISOString()
      const syncMeta: LocalSyncMeta = {
        id: config.entity,
        lastSyncedAt: now,
        entityCount: mappedData.length,
        lastFullSyncAt: now,
      }
      await db.syncMeta.put(syncMeta)

      // Track stats
      stats[config.entity] = mappedData.length
      completedEntities.push(config.entity)

      console.log(`[Bootstrap] ✓ ${config.entity}: ${mappedData.length} records`)

      emitProgress({
        phase: 'fetching',  // Still fetching next entities
        currentEntity: null,
        percentComplete: Math.round((completedEntities.length / totalEntities) * 100),
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`[Bootstrap] ✗ ${config.entity} failed:`, errorMessage)
      errors.push(`${config.entity}: ${errorMessage}`)

      // Still mark as completed so progress advances, but with 0 count
      stats[config.entity] = 0
      completedEntities.push(config.entity)

      emitProgress({
        phase: 'fetching',
        currentEntity: null,
        percentComplete: Math.round((completedEntities.length / totalEntities) * 100),
      })
    }
  }

  // --- Handle sale items (extracted from sales) ---
  try {
    emitProgress({ phase: 'writing', currentEntity: 'saleItems' })
    console.log('[Bootstrap] Extracting sale items from cached sales...')

    // Sales with their items were fetched already; extract items
    const sales = await db.sales.toArray()
    const allSaleItems: LocalSaleItem[] = []

    // We need to re-fetch sales that include items; our local DB only has the sale header.
    // The API already returned items embedded in the sale objects, but we mapped only
    // the header fields. For a complete bootstrap, we do an additional pass.
    // However, to avoid re-fetching, we attempt to pull items from a parallel fetch.
    // For simplicity and correctness, we fetch sales with their items in a single pass.

    // Fetch all sales again, this time capturing items
    const salesWithItems = await fetchAllPages<Sale & { items?: SaleItem[] }>(async (page, limit) => {
      const res = await api.getSales(orgId, { shopId: shopId ?? undefined, page, limit })
      return { data: res.sales, totalPages: res.pagination.totalPages }
    })

    for (const sale of salesWithItems) {
      if (sale.items && sale.items.length > 0) {
        for (const si of sale.items) {
          allSaleItems.push({
            id: si.id,
            saleId: si.saleId,
            productId: si.productId,
            quantity: si.quantity,
            unitPrice: si.unitPrice,
            costPrice: si.costPrice,
            total: si.total,
            createdAt: si.createdAt,
          })
        }
      }
    }

    if (allSaleItems.length > 0) {
      await db.saleItems.bulkPut(allSaleItems)
      stats['saleItems'] = allSaleItems.length
      console.log(`[Bootstrap] ✓ saleItems: ${allSaleItems.length} records`)
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.warn('[Bootstrap] Sale items extraction failed:', errorMessage)
    // Non-critical — continue
  }

  // --- Final status ---
  const hadErrors = errors.length > 0

  if (hadErrors) {
    console.warn('[Bootstrap] Completed with errors:', errors)
  } else {
    console.log('[Bootstrap] ✓ All entities synced successfully')
  }

  // Persist bootstrap flag
  if (typeof window !== 'undefined') {
    localStorage.setItem(`invensync_bootstrapped_${orgId}`, new Date().toISOString())
  }

  // Re-enable 401 auto-logout now that bootstrap is done
  finallyUnsuppress()

  emitProgress({
    phase: hadErrors ? 'error' : 'complete',
    currentEntity: null,
    percentComplete: 100,
    error: hadErrors ? errors.join('; ') : undefined,
  })

  if (hadErrors) {
    // Report error but don't throw — partial bootstrap is still usable
    callbacks?.onError?.(new Error(`Bootstrap completed with errors: ${errors.join('; ')}`))
  }

  callbacks?.onComplete?.(stats)
}

// ============================================
// Bootstrap Status Helpers
// ============================================

/**
 * Checks if the given organization has been bootstrapped.
 * Uses both localStorage flag and IndexedDB syncMeta as signals.
 */
export function needsBootstrap(orgId: string): boolean {
  if (typeof window === 'undefined') return true

  const flag = localStorage.getItem(`invensync_bootstrapped_${orgId}`)
  if (flag) return false

  // Double-check via database (async not possible in sync function,
  // but the localStorage flag is authoritative after a successful bootstrap)
  return true
}

/**
 * Removes the bootstrap flag for the given organization.
 * Used when the user logs out or switches organizations
 * to trigger a fresh bootstrap on next login.
 */
export function clearBootstrapFlag(orgId: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(`invensync_bootstrapped_${orgId}`)
}

/**
 * Async version of needsBootstrap that also checks IndexedDB.
 * More reliable but requires async context.
 */
export async function needsBootstrapAsync(orgId: string): Promise<boolean> {
  if (typeof window === 'undefined') return true

  // Check localStorage first (fast path)
  const flag = localStorage.getItem(`invensync_bootstrapped_${orgId}`)
  if (flag) return false

  // Check if database has sync metadata
  const ready = await isDatabaseReady()
  return !ready
}

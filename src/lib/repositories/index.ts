// ============================================
// InvenSync — Local-First Repository Layer
// ============================================
// Generic repository that reads exclusively from IndexedDB (Dexie)
// and writes optimistically: apply to local DB first, then queue
// the mutation in the outbox table for the sync engine to push
// to the backend.
// ============================================

import {
  db,
  type LocalProduct,
  type LocalCategory,
  type LocalCustomer,
  type LocalSupplier,
  type LocalSale,
  type LocalSaleItem,
  type LocalStockMovement,
  type LocalDebt,
  type LocalExpense,
  type LocalPurchaseOrder,
  type LocalServiceBooking,
  type LocalServiceType,
  type LocalShop,
} from '@/lib/db'
import { newClientId } from '@/lib/client-id'

// -------------------------------------------
// Helpers
// -------------------------------------------

/**
 * Generates a client-side unique ID for optimistic creates.
 * Server-valid (the API accepts it as canonical), so no local/server
 * ID remapping is needed after the outbox syncs.
 */
function generateLocalId(): string {
  return newClientId()
}

// -------------------------------------------
// LocalRepository<T>
// -------------------------------------------

/**
 * Generic local-first repository for Dexie-backed entities.
 *
 * **Reads** always come from IndexedDB — no network calls.
 * **Writes** are applied optimistically to IndexedDB, then a row
 * is inserted into the `outbox` table so the sync engine can
 * push the change to the backend.
 *
 * @typeParam T - Entity shape. Must have at least an `id` field.
 *   Most entities also carry `organizationId` for multi-tenant scoping.
 */
class LocalRepository<T extends { id: string }> {
  constructor(
    private tableName: string,   // Dexie table name (e.g. 'products')
    private entityName: string,  // Outbox entity name (e.g. 'products')
  ) {}

  // -----------------------------------------
  // Reads — all from IndexedDB
  // -----------------------------------------

  /**
   * Returns all records belonging to the given organization.
   * Optionally filters by `shopId` when the entity supports it.
   */
  async getAll(orgId: string, shopId?: string): Promise<T[]> {
    const table = db.table(this.tableName)
    let collection = table.where('organizationId').equals(orgId)

    if (shopId) {
      collection = collection.filter(item => (item as Record<string, unknown>).shopId === shopId)
    }

    return collection.toArray() as Promise<T[]>
  }

  /**
   * Returns a single record by its primary key, or `undefined`.
   */
  async getById(id: string): Promise<T | undefined> {
    const table = db.table(this.tableName)
    return table.get(id) as Promise<T | undefined>
  }

  /**
   * Full-text search across one or more fields for records in
   * the given organization. Uses Dexie's `filter()` for
   * multi-field substring matching.
   */
  async search(orgId: string, query: string, fields: string[]): Promise<T[]> {
    const lowerQuery = query.toLowerCase()
    const table = db.table(this.tableName)
    const results = await table
      .where('organizationId')
      .equals(orgId)
      .filter(item => {
        return fields.some(field => {
          const value = (item as Record<string, unknown>)[field]
          return value && String(value).toLowerCase().includes(lowerQuery)
        })
      })
      .toArray()
    return results as T[]
  }

  /**
   * Returns the count of records for the given organization,
   * optionally filtered by `shopId`.
   */
  async count(orgId: string, shopId?: string): Promise<number> {
    const table = db.table(this.tableName)
    let collection = table.where('organizationId').equals(orgId)

    if (shopId) {
      collection = collection.filter(item => (item as Record<string, unknown>).shopId === shopId)
    }

    return collection.count()
  }

  // -----------------------------------------
  // Writes — optimistic to IndexedDB + outbox
  // -----------------------------------------

  /**
   * Creates a new record optimistically.
   * - Generates a `local_`-prefixed ID if none is provided.
   * - Writes to the Dexie table.
   * - Queues a `create` operation in the outbox.
   */
  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<T> {
    const { id: providedId, ...rest } = data as Record<string, unknown>
    const id = (providedId as string) || generateLocalId()
    const now = new Date().toISOString()

    const record = {
      ...rest,
      id,
      createdAt: now,
      updatedAt: now,
    } as unknown as T

    await db.table(this.tableName).add(record)
    await this.addToOutbox('create', record)

    return record
  }

  /**
   * Updates an existing record optimistically.
   * - Reads the current record, merges changes.
   * - Writes the merged record to the Dexie table.
   * - Queues an `update` operation in the outbox.
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    const existing = await this.getById(id)
    if (!existing) {
      throw new Error(`${this.entityName} with id "${id}" not found`)
    }

    const now = new Date().toISOString()
    const updated = { ...existing, ...data, id, updatedAt: now } as T

    await db.table(this.tableName).put(updated)
    await this.addToOutbox('update', updated)

    return updated
  }

  /**
   * Deletes a record optimistically.
   * - Removes the record from the Dexie table.
   * - Queues a `delete` operation in the outbox.
   */
  async remove(id: string): Promise<void> {
    const existing = await this.getById(id)
    if (!existing) {
      throw new Error(`${this.entityName} with id "${id}" not found`)
    }

    await db.table(this.tableName).delete(id)
    await this.addToOutbox('delete', existing)
  }

  // -----------------------------------------
  // Bulk operations
  // -----------------------------------------

  /**
   * Creates multiple records in a single Dexie bulk write.
   * Each record is also queued individually in the outbox.
   */
  async bulkCreate(items: Omit<T, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<T[]> {
    const now = new Date().toISOString()
    const records = items.map(item => {
      const { id: providedId, ...rest } = item as Record<string, unknown>
      return {
        ...rest,
        id: (providedId as string) || generateLocalId(),
        createdAt: now,
        updatedAt: now,
      } as unknown as T
    })

    await db.table(this.tableName).bulkAdd(records)
    await Promise.all(records.map(record => this.addToOutbox('create', record)))

    return records
  }

  // -----------------------------------------
  // Helpers
  // -----------------------------------------

  /**
   * Returns `true` if a record with the given ID exists locally.
   */
  async exists(id: string): Promise<boolean> {
    const record = await db.table(this.tableName).get(id)
    return record !== undefined
  }

  // -----------------------------------------
  // Internal
  // -----------------------------------------

  /**
   * Inserts a mutation entry into the outbox table so the
   * sync engine can push it to the backend.
   */
  private async addToOutbox(
    operation: 'create' | 'update' | 'delete',
    data: T,
  ): Promise<void> {
    await db.outbox.add({
      id: generateLocalId(),
      entity: this.entityName,
      operation,
      payload: JSON.stringify(data),
      localId: data.id,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
    })
  }
}

// -------------------------------------------
// Concrete Repository Instances
// -------------------------------------------

export const productRepo = new LocalRepository<LocalProduct>('products', 'products')
export const categoryRepo = new LocalRepository<LocalCategory>('categories', 'categories')
export const customerRepo = new LocalRepository<LocalCustomer>('customers', 'customers')
export const supplierRepo = new LocalRepository<LocalSupplier>('suppliers', 'suppliers')
export const saleRepo = new LocalRepository<LocalSale>('sales', 'sales')
export const saleItemRepo = new LocalRepository<LocalSaleItem>('saleItems', 'saleItems')
export const stockMovementRepo = new LocalRepository<LocalStockMovement>('stockMovements', 'stockMovements')
export const debtRepo = new LocalRepository<LocalDebt>('debts', 'debts')
export const expenseRepo = new LocalRepository<LocalExpense>('expenses', 'expenses')
export const purchaseOrderRepo = new LocalRepository<LocalPurchaseOrder>('purchaseOrders', 'purchaseOrders')
export const serviceBookingRepo = new LocalRepository<LocalServiceBooking>('serviceBookings', 'serviceBookings')
export const serviceTypeRepo = new LocalRepository<LocalServiceType>('serviceTypes', 'serviceTypes')
export const shopRepo = new LocalRepository<LocalShop>('shops', 'shops')

// Re-export the class for advanced usage / testing
export { LocalRepository }

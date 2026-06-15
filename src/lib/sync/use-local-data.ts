'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { db, type LocalProduct, type LocalCustomer, type LocalSale, type LocalSupplier, type LocalDebt, type LocalExpense } from '@/lib/db'
import { useConnectivity } from '@/lib/sync/connectivity'

/**
 * Hook for offline-first data access.
 *
 * Strategy:
 * 1. Read from IndexedDB immediately (instant, works offline)
 * 2. If online, also fetch from API and update IndexedDB
 * 3. Return local data immediately, then refresh with server data
 *
 * This means the UI always shows something (even stale data),
 * and gets fresh data when available.
 */

interface UseLocalDataResult<T> {
  data: T[]
  isLoading: boolean
  isFromCache: boolean  // true when data came from IndexedDB, not a fresh API call
  error: string | null
  refresh: () => Promise<void>
}

// ============================================
// Products
// ============================================

export function useLocalProducts(orgId: string, shopId?: string): UseLocalDataResult<LocalProduct> {
  const [data, setData] = useState<LocalProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isOnline } = useConnectivity()
  const mountedRef = useRef(true)

  const loadLocal = useCallback(async () => {
    try {
      let collection = db.products.where('organizationId').equals(orgId)
      if (shopId) {
        const all = await collection.toArray()
        return all.filter(p => p.shopId === shopId || !p.shopId)
      }
      return await collection.toArray()
    } catch {
      return []
    }
  }, [orgId, shopId])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    // Always read local first
    const localData = await loadLocal()
    if (mountedRef.current) {
      setData(localData)
      setIsFromCache(true)
      setIsLoading(false)
    }

    // If online, fetch from API and update local DB
    if (isOnline) {
      try {
        const { api } = await import('@/lib/api-client')
        const result = await api.getProducts(orgId, { shopId })
        const products = result.products || []

        // Map API products to LocalProduct format and store
        const localProducts: LocalProduct[] = products.map((p) => ({
          id: p.id,
          productTypeId: p.productTypeId || '',
          organizationId: p.organizationId,
          shopId: p.shopId || null,
          sku: p.sku || null,
          name: p.name,
          description: p.description || null,
          imageUrl: p.imageUrl || null,
          quantity: p.quantity ?? 0,
          costPrice: p.costPrice ?? 0,
          sellingPrice: p.sellingPrice ?? 0,
          lowStockThreshold: p.lowStockThreshold ?? 0,
          isActive: p.isActive ?? true,
          createdAt: p.createdAt || new Date().toISOString(),
          updatedAt: p.updatedAt || new Date().toISOString(),
        }))

        await db.products.bulkPut(localProducts)

        if (mountedRef.current) {
          setData(localProducts)
          setIsFromCache(false)
        }
      } catch (err) {
        // API fetch failed, but we already have local data
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to refresh')
        }
      }
    }
  }, [orgId, shopId, isOnline, loadLocal])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => { mountedRef.current = false }
  }, [refresh])

  return { data, isLoading, isFromCache, error, refresh }
}

// ============================================
// Customers
// ============================================

export function useLocalCustomers(orgId: string, shopId?: string): UseLocalDataResult<LocalCustomer> {
  const [data, setData] = useState<LocalCustomer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isOnline } = useConnectivity()
  const mountedRef = useRef(true)

  const loadLocal = useCallback(async () => {
    try {
      let collection = db.customers.where('organizationId').equals(orgId)
      if (shopId) {
        const all = await collection.toArray()
        return all.filter(c => c.shopId === shopId || !c.shopId)
      }
      return await collection.toArray()
    } catch {
      return []
    }
  }, [orgId, shopId])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    // Always read local first
    const localData = await loadLocal()
    if (mountedRef.current) {
      setData(localData)
      setIsFromCache(true)
      setIsLoading(false)
    }

    // If online, fetch from API and update local DB
    if (isOnline) {
      try {
        const { api } = await import('@/lib/api-client')
        const result = await api.getCustomers(orgId, { shopId })
        const customers = result.customers || []

        // Map API customers to LocalCustomer format and store
        const localCustomers: LocalCustomer[] = customers.map((c) => ({
          id: c.id,
          organizationId: c.organizationId,
          shopId: c.shopId || null,
          name: c.name,
          email: c.email || null,
          phone: c.phone || null,
          address: c.address || null,
          createdAt: c.createdAt || new Date().toISOString(),
          updatedAt: c.updatedAt || new Date().toISOString(),
        }))

        await db.customers.bulkPut(localCustomers)

        if (mountedRef.current) {
          setData(localCustomers)
          setIsFromCache(false)
        }
      } catch (err) {
        // API fetch failed, but we already have local data
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to refresh')
        }
      }
    }
  }, [orgId, shopId, isOnline, loadLocal])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => { mountedRef.current = false }
  }, [refresh])

  return { data, isLoading, isFromCache, error, refresh }
}

// ============================================
// Sales
// ============================================

export function useLocalSales(orgId: string, shopId?: string): UseLocalDataResult<LocalSale> {
  const [data, setData] = useState<LocalSale[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isOnline } = useConnectivity()
  const mountedRef = useRef(true)

  const loadLocal = useCallback(async () => {
    try {
      let collection = db.sales.where('organizationId').equals(orgId)
      if (shopId) {
        const all = await collection.toArray()
        return all.filter(s => s.shopId === shopId || !s.shopId)
      }
      return await collection.toArray()
    } catch {
      return []
    }
  }, [orgId, shopId])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    // Always read local first
    const localData = await loadLocal()
    if (mountedRef.current) {
      setData(localData)
      setIsFromCache(true)
      setIsLoading(false)
    }

    // If online, fetch from API and update local DB
    if (isOnline) {
      try {
        const { api } = await import('@/lib/api-client')
        const result = await api.getSales(orgId, { shopId })
        const sales = result.sales || []

        // Map API sales to LocalSale format and store
        const localSales: LocalSale[] = sales.map((s) => ({
          id: s.id,
          organizationId: s.organizationId,
          shopId: (s as Record<string, unknown>).shopId as string | null || null,
          customerId: s.customerId || null,
          invoiceNumber: s.invoiceNumber || '',
          status: s.status || '',
          paymentMethod: s.paymentMethod || '',
          subtotal: s.subtotal ?? 0,
          discount: s.discount ?? 0,
          tax: s.tax ?? 0,
          total: s.total ?? 0,
          amountPaid: s.amountPaid ?? 0,
          notes: s.notes || null,
          saleDate: s.saleDate || new Date().toISOString(),
          createdAt: s.createdAt || new Date().toISOString(),
          updatedAt: s.updatedAt || new Date().toISOString(),
        }))

        await db.sales.bulkPut(localSales)

        if (mountedRef.current) {
          setData(localSales)
          setIsFromCache(false)
        }
      } catch (err) {
        // API fetch failed, but we already have local data
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to refresh')
        }
      }
    }
  }, [orgId, shopId, isOnline, loadLocal])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => { mountedRef.current = false }
  }, [refresh])

  return { data, isLoading, isFromCache, error, refresh }
}

// ============================================
// Suppliers
// ============================================

export function useLocalSuppliers(orgId: string, shopId?: string): UseLocalDataResult<LocalSupplier> {
  const [data, setData] = useState<LocalSupplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isOnline } = useConnectivity()
  const mountedRef = useRef(true)

  const loadLocal = useCallback(async () => {
    try {
      let collection = db.suppliers.where('organizationId').equals(orgId)
      if (shopId) {
        const all = await collection.toArray()
        return all.filter(s => s.shopId === shopId || !s.shopId)
      }
      return await collection.toArray()
    } catch {
      return []
    }
  }, [orgId, shopId])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    // Always read local first
    const localData = await loadLocal()
    if (mountedRef.current) {
      setData(localData)
      setIsFromCache(true)
      setIsLoading(false)
    }

    // If online, fetch from API and update local DB
    if (isOnline) {
      try {
        const { api } = await import('@/lib/api-client')
        const result = await api.getSuppliers(orgId, { shopId })
        const suppliers = result.suppliers || []

        // Map API suppliers to LocalSupplier format and store
        const localSuppliers: LocalSupplier[] = suppliers.map((s) => ({
          id: s.id,
          organizationId: s.organizationId,
          shopId: s.shopId || null,
          name: s.name,
          email: s.email || null,
          phone: s.phone || null,
          address: s.address || null,
          createdAt: s.createdAt || new Date().toISOString(),
          updatedAt: s.updatedAt || new Date().toISOString(),
        }))

        await db.suppliers.bulkPut(localSuppliers)

        if (mountedRef.current) {
          setData(localSuppliers)
          setIsFromCache(false)
        }
      } catch (err) {
        // API fetch failed, but we already have local data
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to refresh')
        }
      }
    }
  }, [orgId, shopId, isOnline, loadLocal])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => { mountedRef.current = false }
  }, [refresh])

  return { data, isLoading, isFromCache, error, refresh }
}

// ============================================
// Debts
// ============================================

export function useLocalDebts(orgId: string, shopId?: string): UseLocalDataResult<LocalDebt> {
  const [data, setData] = useState<LocalDebt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isOnline } = useConnectivity()
  const mountedRef = useRef(true)

  const loadLocal = useCallback(async () => {
    try {
      let collection = db.debts.where('organizationId').equals(orgId)
      if (shopId) {
        const all = await collection.toArray()
        return all.filter(d => d.shopId === shopId || !d.shopId)
      }
      return await collection.toArray()
    } catch {
      return []
    }
  }, [orgId, shopId])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    // Always read local first
    const localData = await loadLocal()
    if (mountedRef.current) {
      setData(localData)
      setIsFromCache(true)
      setIsLoading(false)
    }

    // If online, fetch from API and update local DB
    if (isOnline) {
      try {
        const { api } = await import('@/lib/api-client')
        const result = await api.getDebts(orgId, { shopId })
        const debts = result.debts || []

        // Map API debts to LocalDebt format and store
        const localDebts: LocalDebt[] = debts.map((d) => ({
          id: d.id,
          organizationId: d.organizationId,
          shopId: d.shopId || null,
          customerId: d.customerId || null,
          supplierId: d.supplierId || null,
          type: d.type || '',
          amount: d.amount ?? 0,
          paidAmount: d.paidAmount ?? 0,
          dueDate: d.dueDate || null,
          status: d.status || '',
          description: d.description || null,
          createdAt: d.createdAt || new Date().toISOString(),
          updatedAt: d.updatedAt || new Date().toISOString(),
        }))

        await db.debts.bulkPut(localDebts)

        if (mountedRef.current) {
          setData(localDebts)
          setIsFromCache(false)
        }
      } catch (err) {
        // API fetch failed, but we already have local data
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to refresh')
        }
      }
    }
  }, [orgId, shopId, isOnline, loadLocal])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => { mountedRef.current = false }
  }, [refresh])

  return { data, isLoading, isFromCache, error, refresh }
}

// ============================================
// Expenses
// ============================================

export function useLocalExpenses(orgId: string, shopId?: string): UseLocalDataResult<LocalExpense> {
  const [data, setData] = useState<LocalExpense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isOnline } = useConnectivity()
  const mountedRef = useRef(true)

  const loadLocal = useCallback(async () => {
    try {
      let collection = db.expenses.where('organizationId').equals(orgId)
      if (shopId) {
        const all = await collection.toArray()
        return all.filter(e => e.shopId === shopId || !e.shopId)
      }
      return await collection.toArray()
    } catch {
      return []
    }
  }, [orgId, shopId])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    // Always read local first
    const localData = await loadLocal()
    if (mountedRef.current) {
      setData(localData)
      setIsFromCache(true)
      setIsLoading(false)
    }

    // If online, fetch from API and update local DB
    if (isOnline) {
      try {
        const { api } = await import('@/lib/api-client')
        const result = await api.getExpenses(orgId, { shopId })
        const expenses = result.expenses || []

        // Map API expenses to LocalExpense format and store
        const localExpenses: LocalExpense[] = expenses.map((e) => ({
          id: e.id,
          organizationId: e.organizationId,
          shopId: e.shopId || null,
          category: e.category || '',
          amount: e.amount ?? 0,
          description: e.description || null,
          date: e.expenseDate || new Date().toISOString(),
          isRecurring: e.isRecurring ?? null,
          createdAt: e.createdAt || new Date().toISOString(),
          updatedAt: e.updatedAt || new Date().toISOString(),
        }))

        await db.expenses.bulkPut(localExpenses)

        if (mountedRef.current) {
          setData(localExpenses)
          setIsFromCache(false)
        }
      } catch (err) {
        // API fetch failed, but we already have local data
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to refresh')
        }
      }
    }
  }, [orgId, shopId, isOnline, loadLocal])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => { mountedRef.current = false }
  }, [refresh])

  return { data, isLoading, isFromCache, error, refresh }
}

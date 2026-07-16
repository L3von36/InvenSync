// ============================================
// Background outbox replay — runs INSIDE the service worker
// ============================================
// Fired by the Background Sync API ('invensync-outbox' tag) when the
// browser regains connectivity, even if every tab is closed. This is a
// simplified twin of SyncEngine.processOutboxItem: it drains pending
// outbox items using the auth token mirrored into db.userProfile
// (the SW cannot read localStorage).
//
// Server creates are idempotent for client-generated IDs, so a replay
// racing the page's foreground push cannot double-create records.

import { db } from '@/lib/db'

// Mirrors ENTITY_ENDPOINTS in engine.ts for items queued without an
// explicit _endpoint (LocalRepository writes)
const ENTITY_ENDPOINTS: Record<string, string> = {
  products: '/api/products',
  categories: '/api/product-types',
  customers: '/api/customers',
  suppliers: '/api/suppliers',
  sales: '/api/sales',
  saleItems: '/api/sales',
  stockMovements: '/api/inventory',
  debts: '/api/debts',
  expenses: '/api/expenses',
  purchaseOrders: '/api/purchase-orders',
  serviceBookings: '/api/service-bookings',
  serviceTypes: '/api/service-types',
  shops: '/api/shops',
}

function methodFor(operation: string): string {
  if (operation === 'update') return 'PUT'
  if (operation === 'delete') return 'DELETE'
  return 'POST'
}

export interface SwReplayResult {
  synced: number
  failed: number
  remaining: number
}

export async function replayOutboxFromSW(): Promise<SwReplayResult> {
  const result: SwReplayResult = { synced: 0, failed: 0, remaining: 0 }

  // Auth token mirrored by auth-store into the cached profile
  const profiles = await db.userProfile.toArray()
  const token = profiles[0]?.token
  if (!token) {
    console.log('[SW Sync] No cached token — skipping background replay')
    return result
  }

  const pending = await db.outbox
    .where('status')
    .equals('pending')
    .sortBy('createdAt')

  let networkDown = false

  for (const item of pending) {
    if (networkDown) {
      result.remaining++
      continue
    }

    // Resolve URL/method: prefer the original request captured at queue
    // time (_endpoint/_method), fall back to the entity mapping
    let payloadObj: Record<string, unknown> | null = null
    try {
      payloadObj = JSON.parse(item.payload)
    } catch {
      // Not JSON — send as-is
    }

    const entityEndpoint = ENTITY_ENDPOINTS[item.entity]
    let url = (payloadObj?._endpoint as string | undefined) || entityEndpoint
    const method = (payloadObj?._method as string | undefined) || methodFor(item.operation)

    if (!url) {
      result.remaining++
      continue
    }
    if ((item.operation === 'update' || item.operation === 'delete') && !payloadObj?._endpoint) {
      const id = item.serverId || item.localId
      if (!id) {
        result.remaining++
        continue
      }
      url = `${entityEndpoint}/${id}`
    }

    let body: string | undefined
    if (item.operation !== 'delete') {
      if (payloadObj) {
        const { _endpoint, _method, _rawBody, ...rest } = payloadObj
        body = JSON.stringify(rest)
      } else {
        body = item.payload
      }
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body,
      })

      if (response.ok) {
        item.status = 'synced'
        item.lastAttemptAt = new Date().toISOString()
        await db.outbox.put(item)
        result.synced++
      } else if (response.status >= 400 && response.status < 500) {
        // Permanent rejection (validation/conflict) — park for the
        // SyncPanel UI; the page-side engine owns conflict resolution
        item.status = response.status === 409 ? 'conflict' : 'failed'
        item.error = `Background sync: HTTP ${response.status}`
        item.lastAttemptAt = new Date().toISOString()
        await db.outbox.put(item)
        result.failed++
      } else {
        // 5xx — leave pending, count and let the browser retry the sync
        result.remaining++
      }
    } catch {
      // Network gone again — stop and let the browser reschedule
      networkDown = true
      result.remaining++
    }
  }

  console.log(
    `[SW Sync] Background replay: ${result.synced} synced, ${result.failed} failed, ${result.remaining} remaining`
  )
  return result
}

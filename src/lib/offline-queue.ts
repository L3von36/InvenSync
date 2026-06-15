// ============================================
// Offline Queue — Queue mutating API requests for later sync
// ============================================
// When the user is offline and makes a mutating request (POST, PUT, PATCH, DELETE),
// this module stores it in the Dexie outbox table so the sync engine can
// push it to the backend when connectivity is restored.
// ============================================

import { db } from '@/lib/db'

function generateLocalId(): string {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
}

/**
 * Queues an API operation for later execution when connectivity is restored.
 *
 * @param endpoint - The API endpoint URL (e.g., '/api/products')
 * @param method - HTTP method (POST, PUT, PATCH, DELETE)
 * @param headers - Request headers (including auth)
 * @param body - Request body as string
 * @returns The generated outbox entry ID
 */
export async function queueOperation(
  endpoint: string,
  method: string,
  headers: Record<string, string>,
  body: string | null
): Promise<string> {
  // Determine entity name from endpoint
  const entity = extractEntity(endpoint)

  // Determine operation type
  const operation = methodToOperation(method)

  // Parse body for the payload
  let payload: string
  try {
    payload = body ? JSON.stringify({
      ...(body ? JSON.parse(body) : {}),
      _endpoint: endpoint,
      _method: method,
    }) : JSON.stringify({ _endpoint: endpoint, _method: method })
  } catch {
    payload = JSON.stringify({ _endpoint: endpoint, _method: method, _rawBody: body })
  }

  const id = generateLocalId()

  await db.outbox.add({
    id,
    entity,
    operation,
    payload,
    localId: id,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  })

  console.log(`[OfflineQueue] Queued ${method} ${endpoint} as ${entity}/${operation}`)

  return id
}

/**
 * Extracts the entity name from an API endpoint.
 * e.g., '/api/products' → 'products', '/api/auth/me' → 'auth'
 */
function extractEntity(endpoint: string): string {
  const path = endpoint.replace(/^https?:\/\/[^/]+/, '')
  const parts = path.split('/').filter(Boolean)

  // /api/products → products
  // /api/products/123 → products
  // /api/auth/login → auth
  if (parts.length >= 2 && parts[0] === 'api') {
    return parts[1]
  }

  return 'unknown'
}

/**
 * Maps HTTP method to outbox operation type.
 */
function methodToOperation(method: string): 'create' | 'update' | 'delete' {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'create'
    case 'PUT':
    case 'PATCH':
      return 'update'
    case 'DELETE':
      return 'delete'
    default:
      return 'create'
  }
}

/**
 * Returns the count of pending operations in the outbox.
 */
export async function getPendingCount(): Promise<number> {
  return db.outbox.where('status').equals('pending').count()
}

/**
 * Returns all pending operations in the outbox.
 */
export async function getPendingOperations() {
  return db.outbox.where('status').equals('pending').toArray()
}

/**
 * Clears all pending operations from the outbox.
 */
export async function clearPendingOperations(): Promise<void> {
  await db.outbox.where('status').equals('pending').delete()
}

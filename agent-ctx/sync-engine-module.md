# Task: Create Sync Engine Module

## Summary
Created `src/lib/sync/engine.ts` — a comprehensive offline-first sync engine using the outbox pattern, replacing the older `src/lib/offline-queue.ts`.

## Implementation Details

### File: `src/lib/sync/engine.ts` (~500 lines)

**Types exported:**
- `OutboxItem` — Outbox queue item matching Dexie outbox table schema
- `SyncEvent` — UI-facing sync events with progress tracking
- `SyncStatus` — Current sync state for React integration

**SyncEngine class methods:**
1. `constructor()` — Initializes state, guards for browser-only
2. `push()` — Drains outbox sequentially, handles 409 conflict, 4xx fail, 5xx retry with exponential backoff (2s→8s→30s→2m→10m), max 5 retries
3. `pull(entity, orgId, shopId?)` — Delta sync using `updatedSince` from syncMeta, upserts into Dexie, handles `_deleted`/`isActive:false` deletes
4. `pullAll(orgId, shopId?)` — Sequential delta sync for all entities with progress events
5. `bootstrap(orgId, shopId?)` — Full hydration with bulkPut, sets syncMeta timestamps
6. `getStatus()` — Returns SyncStatus with pending/failed/conflict counts, pendingByEntity breakdown
7. `subscribe(listener)` — Returns unsubscribe function for React integration
8. `startAutoSync(intervalMs?)` — 5-min default interval, connectivity-aware, returns cleanup function
9. `manualSync(orgId, shopId?)` — Push then pull cycle
10. `cancelOutboxItem(id)` — Discard failed/conflicted items
11. `retryOutboxItem(id)` — Reset failed item to pending and trigger push
12. `addToOutbox(item)` — Add to outbox with create-then-delete cancellation
13. `getOutboxItems(status?)` — Query outbox items
14. `clearSyncedItems()` — Remove synced items from outbox

**Edge case: Offline create then delete** — When adding a 'delete', checks for a matching 'create' for same entity+localId; if found, removes both.

**Singleton export:** `syncEngine` — lazy-initialized, browser-only

**Dependencies:**
- `authFetch` from `@/lib/auth-fetch`
- `db` from `@/lib/db` (Dexie database — being created separately)
- `connectivityService` from `@/lib/sync/connectivity` (dynamic import, graceful fallback)

**Entity mappings:**
- `ENTITY_ENDPOINTS` — Maps entity names to API routes
- `ENTITY_TABLES` — Maps entity names to Dexie table names

## Lint Result
0 errors, 0 warnings — clean pass

---
Task ID: 1
Agent: main
Task: Fix offline mode - app crashed with "Something went wrong" when going offline

Work Log:
- Diagnosed the root cause: `src/lib/sync/offline-fallback.ts` and `src/lib/offline-queue.ts` were missing
- These modules were referenced by the API client (`src/lib/api-client.ts`) for offline fallback when network requests fail
- Without them, all API calls threw "Network error" when offline, triggering the error boundary
- Created `src/lib/sync/offline-fallback.ts` with handlers for 16 API endpoints:
  - /api/auth/me (reads from db.userProfile)
  - /api/dashboard (computes from products, sales, debts, expenses)
  - /api/products, /api/product-types, /api/customers, /api/suppliers
  - /api/sales, /api/inventory, /api/debts, /api/expenses
  - /api/shops, /api/service-types, /api/service-bookings
  - /api/purchase-orders, /api/reports, /api/modules
- Created `src/lib/offline-queue.ts` for queuing mutating requests when offline
- Fixed error boundary (`src/components/shared/error-boundary.tsx`) to detect network errors and show "You're offline" message instead of "Something went wrong"
- Improved auth store network error detection to catch more error message variants
- Tested with agent-browser: logged in, went offline, navigated pages, refreshed while offline — all working

Stage Summary:
- Offline mode now works: dashboard loads, pages navigate, auth persists on refresh
- Key files created: `src/lib/sync/offline-fallback.ts`, `src/lib/offline-queue.ts`
- Key files modified: `src/components/shared/error-boundary.tsx`, `src/lib/stores/auth-store.ts`
- Browser verified: no "Something went wrong" error when going offline

---
Task ID: 2
Agent: main
Task: Fix offline render crash — correct offline fallback data contracts to match real API shapes

Work Log:
- Audited all API response shapes via api-client.ts interfaces vs offline-fallback.ts responses
- Identified 15+ mismatches between real API shapes and offline fallback shapes
- Root crash cause: branches-page.tsx accesses shop._count.products and shop.members.length, but offline shops had neither
- Fixed all pagination shapes: replaced totalProducts/totalCustomers/etc with unified { page, limit, total, totalPages }
- Fixed /api/shops fallback: added members[], _count: { products, sales }, latitude/longitude
- Fixed /api/products fallback: added nested productType { id, name, icon }, attributeValues[]
- Fixed /api/customers fallback: added _count: { sales, debts }
- Fixed /api/sales fallback: added nested customer { id, name, phone }, items[] with product
- Fixed /api/debts fallback: added nested customer/supplier { id, name, phone }, payments[]
- Fixed /api/expenses fallback: added nested shop { id, name }, recurringPeriod, summary, monthlySummary
- Fixed /api/dashboard fallback: added comparison, period, anomalies with correct shapes
- Fixed /api/reports fallback: matched real key names (bestSellingProducts, inventoryValuation)
- Fixed /api/service-bookings fallback: added nested serviceType and customer
- Added latitude/longitude to LocalShop interface and bootstrap mapping
- Fixed sync engine to prefer original _endpoint/_method from offline-queue payloads
- Tested with browser: login → offline → dashboard → products → sales → customers → debts → reload while offline
- All pages render without GlobalErrorBoundary crash

Stage Summary:
- Commit: 36a34bb — pushed to origin/main
- Files changed: src/lib/sync/offline-fallback.ts (full rewrite), src/lib/db/index.ts, src/lib/sync/bootstrap.ts, src/lib/sync/engine.ts
- Endpoints that cannot be fully reconstructed offline: /api/credit-limits (no local table), /api/modules (returns empty), /api/notifications (uses persistent cache only)
- All critical pages (dashboard, products, sales, customers, debts, expenses, inventory, branches) work offline without crash

---
Task ID: 3
Agent: main
Task: Fix offline mode — app stuck on "Loading InvenSync..." on offline reload

Work Log:
- Cloned https://github.com/L3von36/InvenSync.git and moved it into /home/z/my-project so it runs on the preview (port 3000)
- Configured .env (SQLite file:./db/custom.db), installed deps, generated Prisma client, reset demo@invensync.com password to DemoPass123! for testing
- Reproduced the bug with Agent Browser: login online → go offline → reload → app stuck on "Loading InvenSync..." (isLoading never becomes false)
- Root cause: the service worker (public/sw.js) intercepted /api/auth/me — which is never SW-cached (only called before the SW takes control, or during an already-offline reload) — and returned a 503 { error:'You are offline', offline:true } Response. Because this is a real Response (not a thrown TypeError), the api-client's existing offline fallback paths (navigator.onLine check + TypeError 'Failed to fetch' handler) never ran, so checkAuth() could not restore the session from IndexedDB.
- Fix 1 (src/lib/api-client.ts): detect the SW's offline 503 response (data.offline === true, or 503 that isn't DB_UNREACHABLE) for GET requests and route it through the persistent IndexedDB cache + entity-table fallback (getOfflineFallback) before throwing. For /api/auth/me this reconstructs { user, organizations } from db.userProfile, letting checkAuth() succeed offline.
- Fix 2 (public/sw.js): rewrote to a unified network-first strategy with cache fallback for ALL request types. The old cache-first strategy for /_next/static/* pinned stale pre-edit Turbopack chunks in dev, masking code changes. Network-first fetches fresh online (HMR stays reliable) and only uses cache when actually offline. Bumped cache version v3→v4 and made the HTML offline branch check all caches (so the pre-cached '/' in STATIC_CACHE is served on offline reload).
- Fix 3 (src/app/layout.tsx): updated SW registration comment only (no functional change).
- Verified the 503 fix directly: monkey-patched fetch to return the SW's 503 {offline:true} for /api/auth/me, reset auth state, called checkAuth() — result: isAuthenticated=true, user=demo@invensync.com, orgs=1, with logs showing [ApiClient] SW offline response — reconstructed from entity tables for /api/auth/me + [OfflineFallback] ✓ Reconstructed response for /api/auth/me.
- Verified no regressions: online login + dashboard + navigation all work; offline navigation (Products, Sales, Customers) renders from IndexedDB with no errors.
- Committed (19373d2) and pushed to origin/main.

Stage Summary:
- Commit: 19373d2 — pushed to origin/main
- Files changed: src/lib/api-client.ts (SW offline 503 handling), public/sw.js (network-first rewrite + v4 cache bump), src/app/layout.tsx (comment)
- The offline reload bug is fixed: checkAuth now restores the session from IndexedDB when the SW returns a 503 for /api/auth/me
- Dev-mode note: Turbopack chunk hashing + the old cache-first SW made iterative testing difficult; the network-first SW resolves this for future dev work

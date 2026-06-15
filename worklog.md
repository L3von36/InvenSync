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

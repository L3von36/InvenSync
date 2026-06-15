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

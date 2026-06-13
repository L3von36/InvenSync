# Performance Audit & Optimization Worklog

**Date:** 2025-03-04  
**Project:** InvenSync  
**Engineer:** Senior Performance Engineer

---

# Automated Testing Foundation Worklog

**Date:** 2026-03-05  
**Project:** InvenSync  
**Engineer:** Senior QA Engineer

---

## Testing Foundation Summary

### 1. Testing Dependencies Installed
- `vitest` — Unit/integration test runner
- `@playwright/test` — E2E test framework (config only, browsers not installed)
- `@testing-library/react` — React component testing utilities
- `@testing-library/jest-dom` — DOM assertion matchers

### 2. Vitest Configuration (`vitest.config.ts`)
- Environment: Node
- Globals: enabled
- Path alias: `@` → `src/`
- Coverage: V8 provider, targeting `src/lib/**/*.ts` and `src/app/api/**/*.ts`
- Test pattern: `src/**/*.test.ts`, `src/**/*.test.tsx`

### 3. Unit Tests Created/Extended

#### `src/lib/__tests__/currency.test.ts` (Extended)
- Added `formatETB` test suite:
  - Positive number formatting
  - Zero formatting
  - Negative number formatting
  - Large numbers (millions) with thousand separators
  - Fallback when `Intl.NumberFormat` throws
  - Very small positive numbers
  - Integer values

#### `src/lib/__tests__/validation.test.ts` (Extended)
- Added `validatePasswordStrength` tests from `auth.ts`:
  - Strong password acceptance
  - Short password rejection (<8 chars)
  - Missing uppercase rejection
  - Missing lowercase rejection
  - Missing digit rejection
  - Missing special character rejection
  - Empty password rejection
  - Multiple errors collection
- Added `sanitizeInput` tests from `sanitize.ts`:
  - HTML tag stripping
  - Event handler removal
  - javascript: URL removal
  - data:text/html URL removal
  - Normal text passthrough
  - SQL injection passthrough (handled by parameterized queries)
  - Whitespace trimming
  - Empty input handling
  - HTML entity decoding
- Added `sanitizeAndTruncate` tests
- Added `validateSanitizedField` tests

#### `src/lib/__tests__/auth.test.ts` (Extended)
- Added `validatePasswordStrength` extended tests:
  - Boundary tests (7 chars vs 8 chars)
  - Special character acceptance
  - Multiple error aggregation
- Added `generateToken & verifyToken` extended tests:
  - Different tokens for different user IDs
  - Payload userId verification
  - Tampered signature rejection
- Added `verifyOrgAccess` extended tests:
  - Multiple memberships including target org
  - Admin without memberships behavior

#### `src/lib/__tests__/api-client.test.ts` (New)
- Rate Limiter unit tests:
  - Token bucket allows when tokens available
  - Denies when bucket exhausted
  - Tracks different identifiers independently
  - Correct tier configs
  - Retry-after calculation
- Response Cache behavior unit tests:
  - Cache key format verification
  - TTL-based expiry concept

### 4. API Integration Tests Created/Extended

#### `src/app/api/auth/login/__tests__/route.test.ts` (Extended)
- Added rate-limit, api-error mocks
- Fixed Supabase-only user test (now returns 401 instead of auto-setting password)
- Added account lockout tests:
  - 423 when account is currently locked
  - Lock account after 5 failed attempts
  - Reset failed attempts after lockout expires
- Added rate limiting test:
  - 429 when rate limit exceeded
- Added invalid JSON body test

#### `src/app/api/auth/register/__tests__/route.test.ts` (Extended)
- Used `vi.hoisted()` for proper mock hoisting with `$transaction`
- Added `applyRateLimit`, `api-error`, `sanitize` mocks
- Updated tests to use strong password (`Str0ng!Pass123`)
- Added password strength tests:
  - Weak password rejection
  - Missing uppercase rejection
  - Missing special character rejection
- Updated Supabase migration test (now returns 409 for ALL existing users)
- Added rate limiting test (429)
- Added invalid JSON body test

#### `src/app/api/products/__tests__/route.test.ts` (New)
- GET tests: 401, 400 (missing orgId), 403, 200 with pagination, 503
- POST tests: 401, 400 (missing fields), 400 (zero cost price), 400 (negative selling price), 403, 404 (product type not found), 201, 400 (invalid JSON), 400 (name only HTML tags)

#### `src/app/api/expenses/__tests__/route.test.ts` (Extended)
- Added api-error and sanitize mocks
- Added 503 database unreachable test
- Added all valid categories test
- Added zero amount rejection test
- Added string amount parsing test
- Added invalid JSON body test

### 5. Playwright E2E Test Setup

#### `playwright.config.ts`
- Test directory: `./e2e`
- Timeout: 30s
- Retries: 1
- Base URL: `https://invensync-peach.vercel.app`
- Trace: on-first-retry

#### `e2e/auth.spec.ts`
- Visit landing page
- Navigate to login
- Invalid credentials error
- Registration form navigation

#### `e2e/dashboard.spec.ts`
- App shell display
- Navigation elements
- Login prompt for unauthenticated access
- Module content display

### 6. Test Scripts Added to `package.json`
- `test` → `vitest run`
- `test:watch` → `vitest`
- `test:coverage` → `vitest run --coverage`
- `test:e2e` → `playwright test`

### 7. Pre-existing Test Fixes
- Fixed `two-factor.test.ts`: Added `JWT_SECRET` env var to prevent token verification failures
- Fixed `analytics/profit-loss/__tests__/route.test.ts`: Added missing `db.sale.aggregate`, `db.saleItem.findMany`, `db.saleItem.groupBy`, `db.expense.aggregate`, `db.product.findMany` mocks; Added cache mock to prevent SWR caching between tests

### 8. Test Results
- **18 test files** all passing
- **330 tests** all passing
- **0 errors, 0 warnings** from ESLint
- Duration: ~2.2s

---

## 1. Bundle Analysis

### Current Configuration (`next.config.ts`)
- ✅ `compress: true` — gzip compression enabled
- ✅ `optimizePackageImports` — tree-shaking for lucide-react, recharts, date-fns, framer-motion, and all @radix-ui packages
- ✅ `serverExternalPackages` — Prisma, bcryptjs, jsonwebtoken, sharp, docx excluded from client bundle
- ✅ Image optimization: avif + webp formats, 60s minimum cache TTL
- ✅ Static asset caching: immutable 1-year Cache-Control for /_next/static/ and /static/
- ✅ Security headers: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy

### Heavy Dependencies Identified
| Package | Approx Size | Usage |
|---------|------------|-------|
| recharts | ~389KB | 9 pages (dashboard, reports, admin, analytics, AI, expenses) |
| leaflet | ~200KB | 2 components (shops-map, location-picker) |
| @mdxeditor/editor | ~500KB+ | Landing page (lazy-loaded) |
| @dnd-kit | ~50KB | Product types page (lazy-loaded) |

### Good Patterns Already in Place
- All page components are lazy-loaded via `React.lazy()` in `app-shell.tsx`
- `recharts-exports.ts` centralizes recharts imports → single shared chunk instead of 9 duplicates
- Leaflet is dynamically imported (`import('leaflet')`) inside components
- ShopsMapComponent is dynamically imported in admin-dashboard-page

---

## 2. API Client Optimization

### Issues Found
- ❌ No request deduplication — multiple components requesting same endpoint fire N requests
- ❌ No client-side response caching — every call hits the network
- ❌ No cache invalidation after mutations — stale data served until page refresh
- ✅ Timeout (30s) with AbortController already implemented
- ✅ Offline queue for mutating requests already implemented

### Changes Made (`src/lib/api-client.ts`)
1. **Added inflight request deduplication for GET requests**
   - `_inflightRequests` Map tracks in-flight GET requests
   - If 3 components call `api.getProducts()` simultaneously, only 1 fetch is made
   - All 3 callers receive the same Promise

2. **Added short-lived client-side response cache (5s TTL)**
   - `_responseCache` Map stores successful GET responses
   - Prevents rapid re-fetches when components mount/unmount quickly
   - Automatically expires after 5 seconds

3. **Added cache invalidation after mutations**
   - `invalidateCache(prefix)` method clears both internal cache and shared client-cache
   - Applied to: `createProduct`, `updateProduct`, `deleteProduct` → invalidates products, inventory, dashboard
   - Applied to: `createCustomer`, `updateCustomer`, `deleteCustomer` → invalidates customers
   - Applied to: `createSale` → invalidates sales, dashboard, inventory, products, debts

4. **Maintained all existing functionality**
   - Offline queue, error handling, auth auto-logout, timeout behavior preserved

---

## 3. React.memo for Expensive Components

### Dashboard Page (`src/components/app/dashboard/dashboard-page.tsx`)
Components wrapped with `React.memo`:
| Component | Why | Impact |
|-----------|-----|--------|
| `StatCard` | KPI cards with multiple props (title, value, subtitle, icon, comparisonBadge) | Prevents re-rendering all 6 stat cards when any parent state changes |
| `ComparisonBadge` | Rendered inside StatCard, pure function of `value` prop | Prevents badge re-computation on parent re-render |
| `StatusBadge` | Switch-based render, pure function of `status` string | Prevents re-creating Badge elements on list re-renders |
| `RecentSalesList` | Maps over sales array with click handlers | Prevents re-rendering entire sales list on parent state change |
| `AnomalyAlertWidget` | Maps over anomalies array with severity logic | Prevents re-rendering when unrelated state changes |

---

## 4. Dashboard API Route Optimization

### Redundant Query Fix (`src/app/api/dashboard/route.ts`)
- **Before:** `totalStockValue` used `db.product.aggregate().then(() => db.product.findMany())` — the aggregate was completely wasted because SQLite can't multiply columns in aggregate, so findMany was always needed
- **After:** Direct `db.product.findMany()` with `select: { quantity, costPrice, sellingPrice }` — eliminates 1 unnecessary DB query per dashboard load

### Already Optimized (verified)
- ✅ All independent queries run in `Promise.all()` (batched)
- ✅ N+1 fix: topProducts uses batch `findMany({ id: { in: [...] } })` instead of per-product `findUnique()`
- ✅ COGS uses single `findMany` instead of `aggregate + findMany`
- ✅ Server-side SWR cache with 15s TTL + 30s stale-while-revalidate
- ✅ Cache-Control headers: `private, max-age=15, stale-while-revalidate=30`

---

## 5. API Response Caching Headers

### Routes with Cache-Control Headers Added
| Route | Cache-Control | Rationale |
|-------|--------------|-----------|
| `/api/products` (GET) | `private, max-age=5, stale-while-revalidate=15` | List rarely changes between page loads |
| `/api/customers` (GET) | `private, max-age=5, stale-while-revalidate=15` | List rarely changes between page loads |
| `/api/sales` (GET) | `private, max-age=5, stale-while-revalidate=15` | List rarely changes between page loads |
| `/api/shops` (GET) | `private, max-age=10, stale-while-revalidate=30` | Shops change very infrequently |
| `/api/debts` (GET) | `private, max-age=5, stale-while-revalidate=15` | List rarely changes between page loads |
| `/api/suppliers` (GET) | `private, max-age=5, stale-while-revalidate=15` | List rarely changes between page loads |
| `/api/expenses` (GET) | `private, max-age=5, stale-while-revalidate=15` | List rarely changes between page loads |

### Already Had Caching
- `/api/dashboard` — `private, max-age=15, stale-while-revalidate=30` + server-side SWR
- `/api/inventory` — server-side SWR (CacheNamespaces.BUSINESS_INVENTORY, 20s TTL)
- `/api/organizations` — `private, max-age=30, stale-while-revalidate=60`
- Various admin/AI routes already using `cache.swr()`

---

## 6. Image Lazy Loading

### Images with `loading="lazy"` Added
| File | # Images | Description |
|------|----------|-------------|
| `products-page.tsx` | 4 | Product images in table, card view, detail view, and create form preview |
| `ai-inventory-page.tsx` | 1 | AI product preview image |
| `barcode-dialog.tsx` | 2 | Barcode and QR code images |
| `security-tab.tsx` | 1 | 2FA QR code from external API |

---

## 7. Dynamic Imports Assessment

### Already Optimized
- ✅ All 33 page components lazy-loaded via `React.lazy()` in `app-shell.tsx`
- ✅ `recharts-exports.ts` ensures single shared chunk for recharts
- ✅ Leaflet dynamically imported via `import('leaflet')` in both ShopsMapComponent and LocationPicker
- ✅ ShopsMapComponent dynamically imported via `import('./shops-map-component')` in admin-dashboard-page
- ✅ Offline sync lazily imported in app-root.tsx

### No Further Dynamic Imports Needed
The existing architecture is well-structured. Recharts charts within pages are already part of lazy-loaded page chunks. Adding further dynamic imports within pages would add complexity without meaningful benefit since the page-level code splitting already prevents recharts from loading until the page is visited.

---

## Summary of Impact

| Optimization | Estimated Impact |
|-------------|-----------------|
| API client deduplication | **High** — Eliminates duplicate network requests when multiple components fetch same data |
| API client response cache | **Medium** — 5s cache prevents rapid re-fetches during component mount/unmount cycles |
| Cache invalidation on mutations | **High** — Ensures fresh data after CRUD operations, preventing stale data bugs |
| React.memo on dashboard components | **Medium** — Prevents unnecessary re-renders of 5+ components on parent state changes |
| Removed redundant DB query in dashboard | **Medium** — 1 fewer DB query per dashboard load |
| Cache-Control headers on 7 API routes | **Medium** — Enables browser-level caching, reduces server load |
| loading="lazy" on 8 images | **Low** — Defers off-screen image loading, improves initial page load |

### Files Modified
1. `src/lib/api-client.ts` — Request deduplication, response cache, cache invalidation
2. `src/components/app/dashboard/dashboard-page.tsx` — React.memo on 5 components
3. `src/app/api/dashboard/route.ts` — Removed redundant aggregate query
4. `src/app/api/products/route.ts` — Cache-Control headers
5. `src/app/api/customers/route.ts` — Cache-Control headers
6. `src/app/api/sales/route.ts` — Cache-Control headers
7. `src/app/api/shops/route.ts` — Cache-Control headers (already had)
8. `src/app/api/debts/route.ts` — Cache-Control headers
9. `src/app/api/suppliers/route.ts` — Cache-Control headers
10. `src/app/api/expenses/route.ts` — Cache-Control headers
11. `src/components/app/products/products-page.tsx` — loading="lazy" on 4 images
12. `src/components/app/ai/ai-inventory-page.tsx` — loading="lazy" on 1 image
13. `src/components/app/products/barcode-dialog.tsx` — loading="lazy" on 2 images
14. `src/components/app/settings/security-tab.tsx` — loading="lazy" on 1 image

---

## Responsive Design & Accessibility Fixes

**Date:** 2026-03-05  
**Project:** InvenSync  
**Engineer:** Senior UI/UX Engineer  
**Task ID:** 3-b

### Issue 1: Tables overflow on mobile

Wrapped all table components in scrollable containers with `overflow-x-auto -mx-4 md:mx-0` to enable horizontal scroll on mobile with edge-to-edge scroll area.

| File | Change |
|------|--------|
| `src/components/app/analytics/profit-loss-page.tsx` | Added `<div className="overflow-x-auto -mx-4 md:mx-0">` wrapper around "Top Profitable Products" table |
| `src/components/app/debts/debts-page.tsx` | Added `-mx-4 md:mx-0` to existing `overflow-x-auto` wrapper on debt table |
| `src/components/app/suppliers/suppliers-page.tsx` | Added `-mx-4 md:mx-0` to existing `overflow-x-auto` wrapper on supplier table |
| `src/components/app/inventory/inventory-page.tsx` | Added `-mx-4 md:mx-0` to both inventory table wrappers (products + stock movements) |
| `src/components/app/customers/customers-page.tsx` | Added `-mx-4 md:mx-0` to existing `overflow-x-auto` wrapper on customer table |
| `src/components/app/expenses/expenses-page.tsx` | Added `overflow-x-auto -mx-4 md:mx-0` to desktop table wrapper (was missing `overflow-x-auto`) |

### Issue 2: Chart containers overflow on mobile

Added `overflow-hidden` class to all chart cards and `min-w-0` to parent grid containers to prevent charts from overflowing their containers on small screens.

| File | Changes |
|------|---------|
| `src/components/app/analytics/profit-loss-page.tsx` | Added `min-w-0` to Tabs wrapper; Added `overflow-hidden` to 3 chart cards (Revenue vs Cost, Expense Breakdown, Profit Trend) |
| `src/components/app/dashboard/dashboard-page.tsx` | Added `min-w-0` to chart grid containers (owner + manager dashboards); Added `overflow-hidden` to Shop Comparison card, 2× Revenue Trend cards, 2× Top Products cards |
| `src/components/app/reports/reports-page.tsx` | Added `min-w-0` to charts row grid; Added `overflow-hidden` to 6 chart cards (Daily Sales, Payment Method, Profit Trend, Top 10 Revenue, Top 10 Quantity, Inventory Distribution) |

### Issue 3: Missing aria-labels on interactive elements

Added `aria-label` to icon-only buttons and action buttons that don't have visible text labels.

| File | Changes |
|------|---------|
| `src/components/app/layout/sidebar.tsx` | Added `aria-label="Select organization"` to org selector button; Added `aria-label="Select branch"` to shop selector button |
| `src/components/app/products/products-page.tsx` | Added `aria-label` to dropdown trigger button ("Actions for {product.name}") |
| `src/components/app/customers/customers-page.tsx` | Added `aria-label` to View, Edit, Delete buttons ("View/Edit/Delete {customer.name}") |
| `src/components/app/suppliers/suppliers-page.tsx` | Added `aria-label` to View, Edit, Delete buttons ("View/Edit/Delete {supplier.name}") |
| `src/components/app/debts/debts-page.tsx` | Added `aria-label` to View Details and Record Payment buttons |
| `src/components/app/analytics/profit-loss-page.tsx` | Added `aria-label="Refresh data"` to refresh button |
| `src/components/app/expenses/expenses-page.tsx` | Added `aria-label="Refresh expenses"` to refresh button; Added `aria-label` to Edit/Delete expense buttons |

### Issue 4: Missing search input labels

Added `aria-label` to search inputs that don't have visible labels, ensuring screen readers can identify the purpose of each search field.

| File | aria-label added |
|------|-----------------|
| `src/components/app/products/products-page.tsx` | `"Search products"` |
| `src/components/app/customers/customers-page.tsx` | `"Search customers"` |
| `src/components/app/suppliers/suppliers-page.tsx` | `"Search suppliers"` |
| `src/components/app/debts/debts-page.tsx` | `"Search debts"` |
| `src/components/app/inventory/inventory-page.tsx` | `"Search inventory"` |
| `src/components/app/expenses/expenses-page.tsx` | `"Search expenses"` |

### Issue 5: Touch targets too small on mobile

Increased action button sizes in tables from `size-8` (32px) or default to `h-9 w-9 sm:h-8 sm:w-8` (36px on mobile, 32px on desktop) to better meet the 44px minimum touch target guideline.

| File | Buttons Updated |
|------|----------------|
| `src/components/app/customers/customers-page.tsx` | View, Edit, Delete action buttons |
| `src/components/app/suppliers/suppliers-page.tsx` | View, Edit, Delete action buttons |
| `src/components/app/debts/debts-page.tsx` | View Details, Record Payment buttons |
| `src/components/app/expenses/expenses-page.tsx` | Edit, Delete expense buttons |
| `src/components/app/products/products-page.tsx` | Dropdown trigger button |

### Files Modified (12 total)

1. `src/components/app/analytics/profit-loss-page.tsx`
2. `src/components/app/debts/debts-page.tsx`
3. `src/components/app/suppliers/suppliers-page.tsx`
4. `src/components/app/inventory/inventory-page.tsx`
5. `src/components/app/customers/customers-page.tsx`
6. `src/components/app/expenses/expenses-page.tsx`
7. `src/components/app/products/products-page.tsx`
8. `src/components/app/dashboard/dashboard-page.tsx`
9. `src/components/app/reports/reports-page.tsx`
10. `src/components/app/layout/sidebar.tsx`

### Lint Result
- ✅ `bun run lint` — 0 errors, 0 warnings

---

# Typography & Color Consistency Worklog

**Date:** 2026-03-05
**Project:** InvenSync
**Task ID:** 3-a
**Engineer:** Senior UI/UX Engineer

---

## Issue 1: Duplicate formatETB Function Definitions

### Problem
`reports-page.tsx` had its own local `formatETB` and `formatShortETB` functions instead of using the shared `formatETB` from `@/lib/currency`. Additionally, `suppliers-page.tsx`, `inventory-page.tsx`, and `debts-page.tsx` also had local `formatETB` duplicates with inconsistent formatting patterns.

### Changes Made

1. **`src/lib/currency.ts`** — Added `formatShortETB` function:
   - Formats large numbers compactly: `ETB 1.5M`, `ETB 250K`, `ETB 500`
   - Placed after the existing `formatETB` function for logical grouping

2. **`src/components/app/reports/reports-page.tsx`**:
   - Removed local `formatETB` and `formatShortETB` function definitions
   - Added import: `import { formatETB, formatShortETB } from '@/lib/currency'`

3. **`src/components/app/suppliers/suppliers-page.tsx`**:
   - Removed local `formatETB` function definition
   - Added import: `import { formatETB } from '@/lib/currency'`

4. **`src/components/app/inventory/inventory-page.tsx`**:
   - Removed local `formatETB` function definition (which used `Intl.NumberFormat('en-ET')` + `' ETB'` suffix, differing from the shared version)
   - Added import: `import { formatETB } from '@/lib/currency'`

5. **`src/components/app/debts/debts-page.tsx`**:
   - Removed local `formatETB` function definition
   - Added import: `import { formatETB } from '@/lib/currency'`

---

## Issue 2: Hardcoded Chart Colors Not Matching Brand

### Problem
`profit-loss-page.tsx` used blue (#2563eb), purple (#7c3aed), and pink (#db2777) in charts instead of the brand orange color system, making charts look disconnected from the app's visual identity.

### Changes Made in `src/components/app/analytics/profit-loss-page.tsx`

1. **PIE_COLORS** (line 115): Replaced `['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#ca8a04']` with brand-aligned orange palette: `['#ea580c', '#f97316', '#c2410c', '#fb923c', '#9a3412', '#fed7aa', '#7c2d12']`

2. **Revenue bar** (line 354): Changed `fill="#2563eb"` → `fill="#ea580c"` (brand-600 orange)

3. **Cost of Goods bar**: Kept `#ef4444` (destructive red — semantically correct for costs)

4. **Expenses bar**: Kept `#f59e0b` (amber — semantically correct for expenses)

5. **Gross Profit line** (line 459): Changed `stroke="#2563eb"` → `stroke="#16a34a"` (green — semantically correct for profit)

6. **Net Profit line** (line 467): Changed `stroke="#16a34a"` → `stroke="#ea580c"` (brand color for net profit)

7. **Also fixed**: Pre-existing JSX parsing error where `)}` was incorrectly split into `</div>` + `)`, missing the closing `}` for the JSX expression.

### Admin Dashboard Check
`admin-dashboard-page.tsx` already uses `CHART_COLORS` from `@/lib/admin-utils.ts` which starts with `#ea580c` (brand orange) — no changes needed.

---

## Issue 3: Typography Inconsistencies in Page Headers

### Standard Pattern
```tsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
  <div>
    <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Page Title</h1>
    <p className="text-muted-foreground text-sm mt-1">Description</p>
  </div>
  <div className="flex items-center gap-2">
    {/* Action buttons */}
  </div>
</div>
```

### Changes Made

1. **`src/components/app/expenses/expenses-page.tsx`** — ✅ Already matches standard pattern. No changes needed.

2. **`src/components/app/suppliers/suppliers-page.tsx`**:
   - Fixed wrapper: `sm:justify-between` → `justify-between` (ensures space-between at all breakpoints)
   - Fixed description: added `mt-1` to `<p>` for consistent spacing below title

3. **`src/components/app/inventory/inventory-page.tsx`**:
   - **Main header** (line 837): Wrapped in `flex flex-col sm:flex-row sm:items-center justify-between gap-4` container
   - Added `text-sm mt-1` to description paragraph
   - **Error state header** (line 825): Same fixes applied for consistency

4. **`src/components/app/debts/debts-page.tsx`**:
   - Fixed wrapper: `sm:justify-between` → `justify-between`
   - Fixed description: added `mt-1` to `<p>` for consistent spacing below title

---

## Files Modified Summary

| # | File | Changes |
|---|------|---------|
| 1 | `src/lib/currency.ts` | Added `formatShortETB` function |
| 2 | `src/components/app/reports/reports-page.tsx` | Removed local formatETB/formatShortETB, imported from @/lib/currency |
| 3 | `src/components/app/suppliers/suppliers-page.tsx` | Removed local formatETB, imported from @/lib/currency; fixed header justify-between and mt-1 |
| 4 | `src/components/app/inventory/inventory-page.tsx` | Removed local formatETB, imported from @/lib/currency; fixed header layout and text-sm mt-1 |
| 5 | `src/components/app/debts/debts-page.tsx` | Removed local formatETB, imported from @/lib/currency; fixed header justify-between and mt-1 |
| 6 | `src/components/app/analytics/profit-loss-page.tsx` | Brand-aligned PIE_COLORS, revenue/grossProfit/netProfit colors; fixed JSX parsing error |

## Lint Result
✅ `bun run lint` passes with 0 errors, 0 warnings

---

# Empty/Loading/Error States & Interaction Patterns Fix Worklog

**Date:** 2026-03-05
**Project:** InvenSync
**Task ID:** 3-c
**Engineer:** Senior UI/UX Engineer

---

## Issue 1: Inconsistent Empty State Patterns

### Problem
Pages used inconsistent empty state patterns: some showed inline `<div>` with icon+text, some used the `EmptyState` component from `@/components/shared/error-states`, and some just showed plain text. This created visual inconsistency across the app.

### Changes Made

| File | Inline Empty State Replaced | EmptyState Usage |
|------|----------------------------|------------------|
| `dashboard-page.tsx` | "No sales recorded today" (RecentSalesList) → `EmptyState` with action "Record Sale" | 6 inline empty states replaced |
| `dashboard-page.tsx` | "No sales data yet" (Top Products chart) → `EmptyState` | 2 chart empty states replaced |
| `dashboard-page.tsx` | "No sales recorded yet" (Recent Sales) → `EmptyState` with action "Record Sale" | 2 recent sales empty states replaced |
| `dashboard-page.tsx` | "No customers yet" → `EmptyState` with action "Add Customer" | 1 customer empty state replaced |
| `profit-loss-page.tsx` | "No product sales data available" (table) → `EmptyState` | 1 table empty state replaced |
| `reports-page.tsx` | "No sales data for this period" (full section Card) → `EmptyState` | 1 main empty state replaced |
| `reports-page.tsx` | "No product sales data for this period" (best sellers Card) → `EmptyState` | 1 best sellers empty state replaced |
| `products-page.tsx` | Custom icon+title+message+button div → `EmptyState` with conditional action | 1 products empty state replaced |
| `customers-page.tsx` | Custom icon+text+button Card → `EmptyState` with conditional action | 1 customers empty state replaced |
| `debts-page.tsx` | Custom icon+text Card → `EmptyState` with action "Add Debt" | 1 debts empty state replaced |
| `suppliers-page.tsx` | Custom icon+text+button Card → `EmptyState` with conditional action | 1 suppliers empty state replaced |
| `inventory-page.tsx` | "No products found" mobile text → `EmptyState` | 1 mobile empty state replaced |
| `inventory-page.tsx` | "All Stocked Up!" (low stock) → `EmptyState` | 1 low stock empty state replaced |
| `inventory-page.tsx` | "Everything In Stock!" (out of stock) → `EmptyState` | 1 out of stock empty state replaced |

### Notes
- Chart-container inline empty states (e.g., `No sales data available for this period` inside fixed-height chart containers in profit-loss-page.tsx) were left as inline text since the `EmptyState` component's `py-16` padding would overflow constrained chart containers.
- Table-cell empty states (e.g., `<TableCell colSpan={N}>No data</TableCell>` in reports-page.tsx tables) were left as-is since they follow the standard pattern for table empty rows.

---

## Issue 2: Inconsistent Loading Skeleton Patterns

### Finding
All checked pages already follow the correct pattern:
- **`products-page.tsx`** — Uses `ProductsLoadingSkeleton` with `<Skeleton>` components ✅
- **`customers-page.tsx`** — Uses `<Skeleton>` for loading state ✅
- **`debts-page.tsx`** — Uses `DebtsTableSkeleton` with `<Skeleton>` components ✅
- **`dashboard-page.tsx`** — Uses `<Skeleton>` for loading state ✅
- **`Loader2`** is only used for button loading states (save, delete) and small inline indicators ✅

### No Changes Needed

---

## Issue 3: Missing Hover/Focus States on Table Rows

### Finding
The shadcn `TableRow` component (`src/components/ui/table.tsx`) already includes `hover:bg-muted/50 transition-colors` as default classes. No custom class overrides were found that would remove this hover state.

### Verification
- `products-page.tsx`: `className="cursor-pointer"` — No hover override, default works ✅
- `customers-page.tsx`: `className="cursor-pointer hover:bg-muted/50"` — Explicit but redundant ✅
- `suppliers-page.tsx`: `className="cursor-pointer hover:bg-muted/50"` — Explicit but redundant ✅
- `inventory-page.tsx`: No custom className — Default works ✅
- `debts-page.tsx`: No custom className — Default works ✅
- `expenses-page.tsx`: No custom className — Default works ✅

### No Changes Needed

---

## Issue 4: Inconsistent Dialog/Modal Patterns (Missing DialogDescription)

### Finding
All three checked dialogs already have `DialogDescription` for accessibility:

- **`products-page.tsx`**: `<DialogDescription>Fill in the product details below.</DialogDescription>` ✅
- **`customers-page.tsx`**: `<DialogDescription>{isEditing ? 'Update customer information' : 'Enter details for the new customer'}</DialogDescription>` ✅
- **`suppliers-page.tsx`**: `<DialogDescription>{isEditing ? 'Update supplier information' : 'Enter details for the new supplier'}</DialogDescription>` ✅

### No Changes Needed

---

## Issue 5: Landing Page Pricing Section Not Responsive in Dark Mode

### Problem
The `PricingSection` component in `landing-page.tsx` used hardcoded light-mode colors (`bg-white`, `text-gray-900`, `text-gray-500`, etc.) that didn't adapt to dark mode, making the pricing card unreadable in dark mode.

### Changes Made in `src/components/app/landing/landing-page.tsx`

| Original | Changed To |
|----------|-----------|
| `bg-white` | `bg-white dark:bg-gray-800` |
| `border-gray-100` | `border-gray-100 dark:border-gray-700` |
| `text-gray-900` (title) | `text-gray-900 dark:text-gray-100` |
| `text-gray-500` (subtitle) | `text-gray-500 dark:text-gray-400` |
| `text-gray-900` (price) | `text-gray-900 dark:text-gray-100` |
| `text-gray-400` (per month) | `text-gray-400 dark:text-gray-500` |
| `text-gray-700` (features) | `text-gray-700 dark:text-gray-300` |
| `bg-gray-900` (CTA button) | `bg-gray-900 dark:bg-primary` |
| `text-gray-400` (footer text) | `text-gray-400 dark:text-gray-500` |

---

## Issue 6: Stats Section Dark Mode

### Problem
The `StatsSection` parent `<section>` used `bg-white dark:bg-gray-900` which blended seamlessly with the adjacent sections (Hero ends at `dark:to-gray-900`, Features starts at `dark:bg-gray-900`), providing no visual differentiation.

### Change Made
Changed parent section background from `bg-white dark:bg-gray-900` to `bg-white dark:bg-gray-950` in `src/components/app/landing/landing-page.tsx`. This provides a subtle visual break in dark mode while the inner stats bar (`bg-gray-900 dark:bg-gray-800`) maintains its contrast.

---

## Files Modified (9 total)

1. `src/components/app/dashboard/dashboard-page.tsx` — Replaced 6 inline empty states with `EmptyState`; imported `EmptyState`
2. `src/components/app/analytics/profit-loss-page.tsx` — Replaced table empty state with `EmptyState`; imported `EmptyState`
3. `src/components/app/reports/reports-page.tsx` — Replaced 2 Card empty states with `EmptyState`; imported `EmptyState`
4. `src/components/app/products/products-page.tsx` — Replaced inline empty state with `EmptyState`; imported `EmptyState`
5. `src/components/app/customers/customers-page.tsx` — Replaced Card empty state with `EmptyState`; imported `EmptyState`
6. `src/components/app/debts/debts-page.tsx` — Replaced Card empty state with `EmptyState`; imported `EmptyState`
7. `src/components/app/suppliers/suppliers-page.tsx` — Replaced Card empty state with `EmptyState`; imported `EmptyState`
8. `src/components/app/inventory/inventory-page.tsx` — Replaced 3 inline empty states with `EmptyState`; imported `EmptyState`
9. `src/components/app/landing/landing-page.tsx` — Fixed dark mode colors on PricingSection; fixed StatsSection background

## Lint Result
✅ `bun run lint` passes with 0 errors, 0 warnings

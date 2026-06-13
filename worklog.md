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

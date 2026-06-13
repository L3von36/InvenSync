# Performance Audit & Optimization Worklog

**Date:** 2025-03-04  
**Project:** InvenSync  
**Engineer:** Senior Performance Engineer

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

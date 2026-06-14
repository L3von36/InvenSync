# Task 17: P1 Priority Fixes

**Date:** 2026-03-05
**Status:** Completed

## Changes Made

### Fix 1: package.json Name
- `package.json`: Changed `"name"` from `"nextjs_tailwind_shadcn_ts"` to `"invensync"`

### Fix 2: Removed .bak File
- Deleted `src/app/page.tsx.bak`

### Fix 3: Rate Limiting Added
- `src/app/api/dashboard/route.ts`: Added `applyRateLimit(request, RateLimitTiers.DASHBOARD)` (30 req/min)
- `src/app/api/products/route.ts`: GET → `RateLimitTiers.LIST` (60 req/min), POST → `RateLimitTiers.MUTATION` (20 req/min)
- `src/app/api/sales/route.ts`: GET → `RateLimitTiers.LIST` (60 req/min), POST → `RateLimitTiers.MUTATION` (20 req/min)
- `src/app/api/reports/route.ts`: `RateLimitTiers.ADMIN` (10 req/min, stricter for expensive queries)

### Fix 4: Dashboard Query Safety Limits
- Added `take: 5000` to low stock count, stock value, and anomaly critical-low findMany queries
- Added `take: 10000` to both COGS findMany queries
- Added `quantity: { gt: 0 }` filter to stock value query (skip zero-stock products)
- Added TODO comments for PostgreSQL production migration (SQL SUM/COUNT aggregates)

### Fix 5: Console.log Cleanup
- `src/app/api/auth/login/route.ts`: Wrapped 3 console.log/console.error statements in `process.env.NODE_ENV !== 'production'` check
- `src/app/api/auth/register/route.ts`: No console.log found (only console.error for real errors)

## Verification
- `bun run lint` passed with zero errors
- Dev server running cleanly on port 3000

# Task 8: Data Accuracy Fixes — Work Record

## Task Summary
Fix two pages with data accuracy and performance issues:
1. Reports Page — Mock payment method data in pie chart
2. Customers Page — Debt column showing 0 instead of actual values

## Changes Made

### 1. Reports API (`src/app/api/reports/route.ts`)
- Added `db.sale.groupBy({ by: ['paymentMethod'] })` to the parallel query batch
- Added `paymentMethodBreakdown` to the API response with `{ method, count, revenue }` per method

### 2. Reports Page (`src/components/app/reports/reports-page.tsx`)
- Added `paymentMethodBreakdown` to `ReportData` interface
- Added `paymentMethodLabel()` helper for display labels
- Replaced hardcoded `paymentMethodData` with real data from API
- Updated `CHART_COLORS` with distinct oklch colors (removed duplicate orange, blue; added green/lime)

### 3. Customers Page (`src/components/app/customers/customers-page.tsx`)
- Added `customerDebtMap` state for per-customer debt lookup
- Built debt map from already-fetched debts data in `fetchCustomers()`
- Added `getCustomerDebt()` useCallback helper
- Replaced both `formatETB(0)` occurrences with `formatETB(getCustomerDebt(customer.id))`
- Optimized: Changed sequential API calls to `Promise.all()` for parallel execution

## Verification
- `bun run lint` passes with 0 errors, 0 warnings

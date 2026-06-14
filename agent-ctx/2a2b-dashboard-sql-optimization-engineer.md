# Task 2a+2b: Dashboard SQL Optimization Engineer

## Summary
Replaced in-memory JS aggregations with Prisma `$queryRaw` (DB-side SQL) in the dashboard API route and added composite database indexes to the Prisma schema.

## Changes

### A. Dashboard Route (`src/app/api/dashboard/route.ts`)

1. **Added import**: `import { Prisma } from '@prisma/client'` for `Prisma.sql` and `Prisma.empty` composition

2. **lowStockCount**: Replaced `findMany({take:5000}).filter().length` with raw SQL `SELECT COUNT(*) FROM Product WHERE quantity <= lowStockThreshold` — DB does the column comparison and counting, no rows loaded into memory

3. **totalStockValue**: Replaced `findMany({take:5000}).reduce()` with raw SQL `SELECT COALESCE(SUM(quantity * costPrice), 0), COALESCE(SUM(quantity * sellingPrice), 0) FROM Product` — DB does the multiplication and summation

4. **periodCogsResult / prevPeriodCogsResult**: Replaced `saleItem.findMany({take:10000}).reduce()` with raw SQL `SELECT COALESCE(SUM(si.costPrice * si.quantity), 0) FROM SaleItem si JOIN Sale s ON si.saleId = s.id WHERE ...` — DB does the JOIN and SUM

5. **Anomaly detection (critical low)**: Replaced `findMany({take:5000}).filter().slice().map()` with raw SQL `SELECT ... FROM Product WHERE quantity <= lowStockThreshold * 0.2 LIMIT 5` — DB does the column arithmetic, filtering, and limiting

6. **COGS calculation**: Changed from `.reduce()` on item arrays to direct access of `result[0]?.cogs ?? 0`

7. **Conditional shopId**: Used `Prisma.sql` composition with `Prisma.empty` for optional shop filters in raw SQL queries

8. **Removed all `take: 5000` / `take: 10000` safety limits** — no longer needed since DB handles aggregation

### B. Prisma Schema (`prisma/schema.prisma`)

Added indexes (only those that didn't already exist):

- **Product**: `@@index([organizationId, isActive, quantity])` — supports lowStockCount and totalStockValue queries
- **Product**: `@@index([organizationId, isActive, lowStockThreshold])` — supports low stock threshold comparisons
- **Debt**: `@@index([organizationId, status, type])` — supports debt queries filtered by status then type

**Already existed (not added)**:
- Sale: `@@index([organizationId, status, saleDate])` ✅
- SaleItem: `@@index([saleId])`, `@@index([productId])` ✅
- Expense: `@@index([organizationId, expenseDate])` ✅
- StockMovement: `@@index([organizationId, createdAt])` ✅

### C. Verification

- `bun run db:push` — ✅ Database synced successfully
- `bun run lint` — ✅ 0 errors, 0 warnings
- Dev server — ✅ No compilation errors

# Task 1: Wire Sales Page to Local Data Fallback

## Summary
Added IndexedDB fallback for the sales page when API calls fail, following the same offline-first pattern used in other parts of the app.

## Changes Made

### `/home/z/my-project/src/components/app/sales/sales-page.tsx`
1. **Added imports**: `db`, `LocalSale`, `LocalCustomer`, `LocalProduct`, `LocalSaleItem` from `@/lib/db`, and `getSyncEngine` from `@/lib/sync/engine`
2. **`AllSalesTab.fetchSales`**: Added `.catch()` fallback that reads from `db.sales` (scoped by `organizationId`, filtered by `shopId`) when `api.getSales` fails
3. **`CreateSaleTab` data fetching**: Added `.catch()` fallback that reads from `db.customers` and `db.products` when `api.getCustomers`/`api.getProducts` fail
4. **`CreateSaleTab.handleFormSubmit`**: Added offline sale creation path:
   - Customer creation offline: writes to `db.customers` and queues in outbox via `getSyncEngine().addToOutbox()`
   - Sale creation offline: writes sale and sale items to local DB (`db.sales`, `db.saleItems`), queues in outbox, and decrements local product stock
5. **`SalesPage.fetchSales`**: Added `.catch()` fallback that reads from `db.sales` when `api.getSales` fails

### `/home/z/my-project/src/lib/sync/engine.ts`
- Changed `stopAutoSync()` from `private` to public so it can be called from the auth store on logout

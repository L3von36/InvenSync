# Task 5 — Bug Fix Agent Work Record

## Summary
Fixed two critical bugs in the InvenSync Next.js project:

### Bug 1: Debts Page Crash
- **Root cause**: `DebtsTable` component (defined outside `DebtsPage`) referenced `setShowAddDebt(true)` which is a state setter from the parent scope — causing a runtime ReferenceError.
- **Fix**: Added `onAddDebt` callback prop to `DebtsTable` and passed it from both `<DebtsTable>` call sites in `DebtsPage`.

### Bug 2: Expenses Page Raw fetch + localStorage
- **Root cause**: Four raw `fetch()` calls with direct `localStorage.getItem('sb_token')` for auth, bypassing the centralized API client.
- **Fix**: 
  - Added `Expense` interface and 4 expense methods (`getExpenses`, `createExpense`, `updateExpense`, `deleteExpense`) to `api-client.ts`
  - Moved `expenseFormSchema` and `ExpenseFormData` to `validations.ts`
  - Replaced all raw fetch + localStorage calls in `expenses-page.tsx` with `api.*` methods

### Files Modified
1. `src/components/app/debts/debts-page.tsx`
2. `src/lib/api-client.ts`
3. `src/lib/validations.ts`
4. `src/components/app/expenses/expenses-page.tsx`

### Verification
- `bun run lint` passes with 0 errors, 0 warnings
- Dev server compiles successfully

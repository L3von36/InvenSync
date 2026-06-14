# Task 2: Shared Formatting Utilities Module

## Summary
Created `/src/lib/format.ts` with 7 standardized formatting functions and updated 18+ component files to use them, eliminating all duplicated format function definitions across the codebase.

## Key Decisions
- `formatETB` defaults to 2 decimals, accepts `{ decimals: N }` option for pages that need 0 decimals
- All date functions accept `string | null | undefined` and return "—" for nullish values
- `formatShortETB` remains in `@/lib/currency` since it's compact notation only used in reports
- `@/lib/currency` module is untouched (used by currency-context for multi-currency support)

## Files Modified
- Created: `/src/lib/format.ts`
- Updated 18 component files to import from `@/lib/format` instead of having local format functions
- All pages now use consistent "ETB X,XXX.XX" currency format

## Verification
- `bun run lint` passes with 0 errors, 0 warnings
- No remaining local `formatDate`/`formatETB`/`formatCurrency` function definitions in components

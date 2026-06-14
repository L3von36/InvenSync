# Task 10 — Design System Unification

**Agent:** Design System Engineer  
**Date:** 2026-03-05  
**Status:** Completed

## Summary

Unified inconsistent UI patterns across 7 page components to establish a consistent design system.

## Changes Made

### 1. Stat Card Icon Background Colors (5 pages)

Standardized all stat card icon backgrounds to a consistent color-to-meaning mapping:

| Meaning | Background | Icon Color |
|---|---|---|
| Revenue/Money/Positive | `bg-emerald-100 dark:bg-emerald-900/30` | `text-emerald-600 dark:text-emerald-400` |
| Primary/General | `bg-primary/10` | `text-primary` |
| Warning/Low stock | `bg-amber-100 dark:bg-amber-900/30` | `text-amber-600 dark:text-amber-400` |
| Danger/Negative | `bg-red-100 dark:bg-red-900/30` | `text-red-600 dark:text-red-400` |
| Info/Neutral | `bg-sky-100 dark:bg-sky-900/30` | `text-sky-600 dark:text-sky-400` |

**Pages fixed:**
- **sales-page.tsx**: Replaced `bg-brand-50`, mixed colors → all revenue cards now use emerald
- **customers-page.tsx**: `bg-brand-50` → `bg-sky-100` (info/neutral), `bg-amber-100` → `bg-sky-100` (info), kept `bg-red-100` for debt
- **inventory-page.tsx**: `bg-brand-50` → `bg-emerald-100` (in stock is positive), `Total Value` → `bg-emerald-100` (money), added dark mode icon colors
- **debts-page.tsx**: `bg-blue-100` → `bg-sky-100` (info), `bg-orange-100` → `bg-sky-100` (info), `bg-brand-50` → `bg-emerald-100` (collected = positive), kept `bg-red-100` for overdue
- **expenses-page.tsx**: Added `dark:bg-red-900/30 dark:text-red-400` for dark mode support

### 2. Empty State Usage (2 pages)

Replaced hand-rolled empty states with shared `EmptyState` component:

- **sales-page.tsx**: Replaced `<Card><CardContent className="py-12 text-center">...</CardContent></Card>` with `<EmptyState>` using `ShoppingCart` icon, conditional title/message/action
- **inventory-page.tsx**: Replaced `<Card><CardContent className="py-12 text-center">...</CardContent></Card>` with `<EmptyState>` using `History` icon, conditional title/message
- Added `EmptyState` to import in sales-page.tsx (was only importing `ErrorState`)

### 3. Page Header Pattern (4+ pages)

Standardized all page headers to the consistent pattern:
```tsx
<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Title</h1>
    <p className="text-muted-foreground text-sm mt-1">Description</p>
  </div>
  <div className="flex items-center gap-2">{/* Actions */}</div>
</div>
```

**Pages fixed:**
- **products-page.tsx**: `gap-4` → `gap-1`, `justify-between` → `sm:justify-between` ✓
- **sales-page.tsx**: Added flex layout wrapper, added `text-sm mt-1` to subtitle, fixed both error state and main headers
- **customers-page.tsx**: `gap-4` → `gap-1`, `justify-between` → `sm:justify-between`, subtitle `text-sm` → `text-sm mt-1`
- **inventory-page.tsx**: `gap-4` → `gap-1`, `justify-between` → `sm:justify-between` (both error and main headers)
- **debts-page.tsx**: `gap-4` → `gap-1`, `justify-between` → `sm:justify-between`

### 4. Dialog Widths (3 pages)

Standardized dialog widths per the sizing convention:
- Simple forms → `sm:max-w-md`
- Complex forms → `sm:max-w-lg`
- Detail views → `sm:max-w-2xl`

**Pages fixed:**
- **products-page.tsx**: Add/Edit Product `sm:max-w-2xl` → `sm:max-w-lg` (complex form, not detail view)
- **debts-page.tsx**: Debt Detail `sm:max-w-lg` → `sm:max-w-2xl` (detail view with lots of info)
- **expenses-page.tsx**: Add/Edit Expense `sm:max-w-[480px]` → `sm:max-w-md` (simple form)

**Already correct:**
- customers-page.tsx: Add/Edit `sm:max-w-md` ✓, Detail `sm:max-w-2xl` ✓
- inventory-page.tsx: Adjust Stock `sm:max-w-md` ✓
- sales-page.tsx: Sale Detail `sm:max-w-2xl` ✓

## Verification

- `bun run lint` passed with no errors
- Dev server running successfully

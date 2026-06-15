# Task 1: Offline-First Integration into Dashboard & App Shell

## Summary
Integrated offline-first capabilities into the existing InvenSync Next.js project, connecting the pre-existing sync engine, bootstrap service, and Dexie database to the UI layer.

## Changes Made

### 1. Created SyncPanel & SyncStatusChip components
- **File**: `src/components/app/dashboard/sync-panel.tsx`
- `SyncStatusChip`: Compact header indicator showing sync state (online/offline/syncing/errors), pending count badge
- `SyncPanel`: Full-featured collapsible panel with connectivity status, outbox queue, manual sync, retry/cancel actions, recent sync events
- `SyncOfflinePage`: Full-page wrapper for the dedicated route
- Supports two modes: collapsible card (dashboard) and full-page (dedicated route)

### 2. Added SyncStatusChip to Header
- **File**: `src/components/app/layout/header.tsx`
- Added import for `SyncStatusChip`
- Positioned before the `NotificationBell` in the right-side controls area

### 3. Added SyncPanel to Dashboard Page
- **File**: `src/components/app/dashboard/dashboard-page.tsx`
- Added import for `SyncPanel`
- Wrapped each role-specific dashboard (Owner, Manager, Cashier, Warehouse, Sales) with a fragment that includes the SyncPanel as a collapsible section at the bottom

### 4. Added Bootstrap Check to App Shell
- **File**: `src/components/app/app-shell.tsx`
- Imported `useBootstrap` hook and `Progress` component
- Created `BootstrapOverlay` component with polished full-screen UI (icon, title, progress bar, entity progress chips, error state)
- Bootstrap triggers once per org (checked via `needsBootstrap()` + localStorage flag)
- Uses `useRef` to prevent re-triggering for the same org
- Overlay derived from `isBootstrapping` state (no setState in effect, passing lint)

### 5. Added "Sync & Offline" Navigation
- **File**: `src/lib/stores/app-store.ts` — Added `'sync-offline'` to `Page` union type and `pageTitles`
- **File**: `src/components/app/layout/header.tsx` — Added breadcrumb entry
- **File**: `src/components/app/layout/sidebar.tsx` — Added `Database` icon import, sidebar footer nav item, mobile "More" panel entry
- **File**: `src/components/app/app-shell.tsx` — Added lazy-loaded `SyncOfflinePage` component and route case

### 6. Updated Auth Store Logout
- **File**: `src/lib/stores/auth-store.ts`
- Added dynamic import of `clearLocalDatabase` from `@/lib/db/index`
- Clears IndexedDB on logout (fire-and-forget)
- Clears all `invensync_bootstrapped_*` localStorage flags

### 7. Enhanced OfflineIndicator
- **File**: `src/components/shared/offline-indicator.tsx`
- Shows pending outbox count when online but changes are queued
- Shows queued change count when offline
- Added "Sync Now" button (with loading state) for pending changes
- Imports sync engine status via `getSyncEngine().subscribe()`

## Key Design Decisions
- Used `useRef` instead of `useState` for bootstrap trigger tracking to avoid lint violations about setState in effects
- Dynamic import for `clearLocalDatabase` to avoid bundling Dexie in auth store chunk
- Explicit `@/lib/db/index` path for auth store import to avoid ambiguity with `@/lib/db.ts` (Prisma)
- Overlay visibility derived from `isBootstrapping && checkNeedsBootstrap()` rather than separate state

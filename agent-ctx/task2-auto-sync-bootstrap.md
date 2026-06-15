# Task 2: Start Auto-Sync After Bootstrap in App-Shell

## Summary
Integrated auto-sync engine lifecycle into the app-shell: start after bootstrap completes (or immediately if already bootstrapped), and stop on unmount or logout.

## Changes Made

### `/home/z/my-project/src/components/app/app-shell.tsx`
1. **Added import**: `getSyncEngine` from `@/lib/sync/engine`
2. **Modified bootstrap useEffect**: 
   - After bootstrap `.then()`: calls `getSyncEngine().startAutoSync()` to start the auto-sync engine
   - Added `else` branch: if org is already bootstrapped (no bootstrap needed), immediately starts auto-sync
3. **Added cleanup useEffect**: On unmount, calls `getSyncEngine().stopAutoSync()` to prevent stale timers

### `/home/z/my-project/src/lib/stores/auth-store.ts`
1. **Added step 5 in logout**: Before clearing the local database, stops the auto-sync engine via `getSyncEngine().stopAutoSync()` to ensure sync timers and connectivity listeners are cleaned up on logout
2. Renumbered subsequent steps (6 → clear local DB, 7 → clear bootstrap flags)

### `/home/z/my-project/src/lib/sync/engine.ts`
- Changed `stopAutoSync()` from `private` to public so it can be called from the auth store and app-shell

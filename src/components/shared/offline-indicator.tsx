'use client'

import { useState, useEffect, useSyncExternalStore, useCallback } from 'react'
import { WifiOff, RefreshCw, Loader2, CloudOff } from 'lucide-react'
import { getSyncEngine, type SyncStatus } from '@/lib/sync/engine'
import { useAuthStore } from '@/lib/stores/auth-store'

// ============================================
// Offline Indicator (Enhanced)
// ============================================
// Shows a bar when the app is offline.
// Also shows pending outbox count and a "Sync Now" action
// when there are pending changes to sync.

function subscribeToOnlineStatus(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getOnlineStatusSnapshot() {
  return !navigator.onLine
}

function getServerSnapshot() {
  return false // Server is always "online"
}

export function OfflineIndicator() {
  const isOffline = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineStatusSnapshot,
    getServerSnapshot
  )

  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const { currentOrg, currentShop } = useAuthStore()

  // Subscribe to sync status for pending count
  useEffect(() => {
    const engine = getSyncEngine()
    const unsubscribe = engine.subscribe((s) => setStatus(s))
    engine.getStatus().then(setStatus)
    return unsubscribe
  }, [])

  const handleSyncNow = useCallback(async () => {
    if (!currentOrg || isSyncing) return
    setIsSyncing(true)
    try {
      const engine = getSyncEngine()
      await engine.manualSync(currentOrg.id, currentShop?.id)
    } catch (err) {
      console.error('[OfflineIndicator] Sync failed:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [currentOrg, currentShop, isSyncing])

  const pendingCount = status?.pendingCount ?? 0

  // If online and no pending items, don't show anything
  if (!isOffline && pendingCount === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top-2 duration-200" role="alert" aria-live="assertive">
      <div className="bg-amber-500 text-amber-950 px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-medium">
        {isOffline ? (
          <>
            <WifiOff className="size-3.5" aria-hidden="true" />
            <span>You are offline — some features may be limited</span>
          </>
        ) : (
          <>
            <CloudOff className="size-3.5" aria-hidden="true" />
            <span>{pendingCount} pending change{pendingCount !== 1 ? 's' : ''} to sync</span>
          </>
        )}
        {pendingCount > 0 && !isOffline && (
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="ml-2 inline-flex items-center gap-1 rounded bg-amber-700/30 hover:bg-amber-700/50 px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-50"
            aria-label="Sync now"
          >
            {isSyncing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Sync Now
          </button>
        )}
        {isOffline && pendingCount > 0 && (
          <span className="ml-1 text-amber-800/70">
            ({pendingCount} change{pendingCount !== 1 ? 's' : ''} queued)
          </span>
        )}
      </div>
    </div>
  )
}

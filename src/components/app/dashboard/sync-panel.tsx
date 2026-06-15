'use client'

// ============================================
// Sync Panel & Status Chip
// ============================================
// UI components for the offline-first sync system.
// - SyncStatusChip: compact indicator for the header
// - SyncPanel: detailed panel for the dashboard / dedicated page
// ============================================

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  CloudOff,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  Clock,
  ArrowUpDown,
  Loader2,
  Database,
  Trash2,
  RotateCcw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  useConnectivity,
} from '@/lib/sync/connectivity'
import {
  getSyncEngine,
  type SyncStatus,
  type SyncEvent,
  type OutboxItem,
} from '@/lib/sync/engine'
import { useAuthStore } from '@/lib/stores/auth-store'

// ============================================
// SyncStatusChip — compact header indicator
// ============================================

export function SyncStatusChip() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const connectivity = useConnectivity()
  const { currentOrg, currentShop } = useAuthStore()

  useEffect(() => {
    const engine = getSyncEngine()
    const unsubscribe = engine.subscribe((s) => setStatus(s))
    // Also fetch immediately
    engine.getStatus().then(setStatus)
    return unsubscribe
  }, [])

  const handleSyncNow = useCallback(async () => {
    if (!currentOrg) return
    const engine = getSyncEngine()
    try {
      await engine.manualSync(currentOrg.id, currentShop?.id)
    } catch (err) {
      console.error('[SyncStatusChip] Manual sync failed:', err)
    }
  }, [currentOrg, currentShop])

  const isOffline = !connectivity.isOnline
  const isSyncing = status?.isSyncing ?? false
  const pendingCount = status?.pendingCount ?? 0
  const failedCount = status?.failedCount ?? 0
  const conflictCount = status?.conflictCount ?? 0

  // Determine chip state
  const hasIssues = failedCount > 0 || conflictCount > 0
  const chipColor = isOffline
    ? 'text-amber-600 dark:text-amber-400'
    : hasIssues
      ? 'text-red-600 dark:text-red-400'
      : isSyncing
        ? 'text-primary animate-pulse'
        : 'text-emerald-600 dark:text-emerald-400'

  const tooltip = isOffline
    ? 'Offline'
    : hasIssues
      ? `${failedCount} failed, ${conflictCount} conflicts`
      : isSyncing
        ? 'Syncing...'
        : 'All synced'

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 px-2 text-xs"
      onClick={handleSyncNow}
      disabled={isSyncing || isOffline}
      aria-label={tooltip}
      title={tooltip}
    >
      {isOffline ? (
        <CloudOff className="size-3.5 text-amber-500" aria-hidden="true" />
      ) : isSyncing ? (
        <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
      ) : hasIssues ? (
        <AlertTriangle className="size-3.5 text-red-500" aria-hidden="true" />
      ) : (
        <Cloud className={`size-3.5 ${chipColor}`} aria-hidden="true" />
      )}
      {pendingCount > 0 && (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">
          {pendingCount}
        </Badge>
      )}
    </Button>
  )
}

// ============================================
// Sync Event Icon Helper
// ============================================

function SyncEventIcon({ type }: { type: SyncEvent['type'] }) {
  switch (type) {
    case 'sync_start':
    case 'delta_sync_start':
      return <RefreshCw className="size-3.5 text-primary" />
    case 'sync_complete':
    case 'delta_sync_complete':
      return <CheckCircle2 className="size-3.5 text-emerald-500" />
    case 'sync_error':
      return <XCircle className="size-3.5 text-red-500" />
    case 'item_synced':
      return <ArrowUpDown className="size-3.5 text-emerald-500" />
    case 'item_failed':
      return <XCircle className="size-3.5 text-red-500" />
    case 'item_conflict':
      return <AlertTriangle className="size-3.5 text-amber-500" />
    case 'sync_progress':
      return <Loader2 className="size-3.5 text-primary animate-spin" />
    default:
      return <Clock className="size-3.5 text-muted-foreground" />
  }
}

// ============================================
// Outbox Item Row
// ============================================

function OutboxItemRow({ item, onRetry, onCancel }: {
  item: OutboxItem
  onRetry: (id: string) => void
  onCancel: (id: string) => void
}) {
  const statusColor = {
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    syncing: 'bg-primary/10 text-primary',
    synced: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    conflict: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  }[item.status]

  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium capitalize">{item.entity}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
            {item.operation}
          </Badge>
          <Badge className={`text-[10px] px-1.5 py-0 ${statusColor}`}>
            {item.status}
          </Badge>
        </div>
        {item.error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 truncate">{item.error}</p>
        )}
      </div>
      {(item.status === 'failed' || item.status === 'conflict') && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onRetry(item.id)}
            title="Retry"
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            onClick={() => onCancel(item.id)}
            title="Discard"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ============================================
// SyncPanel — full sync management panel
// ============================================

interface SyncPanelProps {
  /** Whether the panel starts expanded */
  defaultOpen?: boolean
  /** If true, renders as a full page instead of a collapsible card */
  fullPage?: boolean
}

export function SyncPanel({ defaultOpen = false, fullPage = false }: SyncPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen || fullPage)
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([])
  const connectivity = useConnectivity()
  const { currentOrg, currentShop } = useAuthStore()
  const [isManualSyncing, setIsManualSyncing] = useState(false)

  // Subscribe to sync status
  useEffect(() => {
    const engine = getSyncEngine()
    const unsubscribe = engine.subscribe((s) => setStatus(s))
    engine.getStatus().then(setStatus)
    return unsubscribe
  }, [])

  // Fetch outbox items when panel opens
  useEffect(() => {
    if (!isOpen) return
    const engine = getSyncEngine()
    engine.getOutboxItems().then(setOutboxItems)
    const interval = setInterval(() => {
      engine.getOutboxItems().then(setOutboxItems)
    }, 3000)
    return () => clearInterval(interval)
  }, [isOpen])

  const handleManualSync = useCallback(async () => {
    if (!currentOrg || isManualSyncing) return
    setIsManualSyncing(true)
    try {
      const engine = getSyncEngine()
      await engine.manualSync(currentOrg.id, currentShop?.id)
    } catch (err) {
      console.error('[SyncPanel] Manual sync failed:', err)
    } finally {
      setIsManualSyncing(false)
    }
  }, [currentOrg, currentShop, isManualSyncing])

  const handleRetryItem = useCallback(async (id: string) => {
    const engine = getSyncEngine()
    await engine.retryOutboxItem(id)
    const items = await engine.getOutboxItems()
    setOutboxItems(items)
  }, [])

  const handleCancelItem = useCallback(async (id: string) => {
    const engine = getSyncEngine()
    await engine.cancelOutboxItem(id)
    const items = await engine.getOutboxItems()
    setOutboxItems(items)
  }, [])

  const handleClearSynced = useCallback(async () => {
    const engine = getSyncEngine()
    await engine.clearSyncedItems()
    const items = await engine.getOutboxItems()
    setOutboxItems(items)
  }, [])

  const isOffline = !connectivity.isOnline
  const isSyncing = (status?.isSyncing ?? false) || isManualSyncing
  const pendingCount = status?.pendingCount ?? 0
  const failedCount = status?.failedCount ?? 0
  const conflictCount = status?.conflictCount ?? 0
  const recentEvents = status?.recentEvents ?? []

  const hasIssues = failedCount > 0 || conflictCount > 0
  const pendingItems = outboxItems.filter(i => i.status === 'pending' || i.status === 'syncing')
  const failedItems = outboxItems.filter(i => i.status === 'failed')
  const conflictItems = outboxItems.filter(i => i.status === 'conflict')

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  // Full page mode
  if (fullPage) {
    return (
      <div className="space-y-6">
        {/* Connectivity Banner */}
        <div className={`rounded-lg p-4 flex items-center gap-3 ${
          isOffline
            ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
            : 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
        }`}>
          {isOffline ? (
            <WifiOff className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : (
            <Wifi className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">
              {isOffline ? 'You are offline' : 'You are online'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isOffline
                ? 'Changes will be saved locally and synced when you reconnect.'
                : 'Your data is being synced automatically.'}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing || isOffline}
            className="gap-1.5"
          >
            {isSyncing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Sync Now
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{failedCount}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{conflictCount}</p>
              <p className="text-xs text-muted-foreground">Conflicts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {status?.lastSyncedAt ? formatTimeAgo(status.lastSyncedAt.getTime()) : 'Never'}
              </p>
              <p className="text-xs text-muted-foreground">Last Synced</p>
            </CardContent>
          </Card>
        </div>

        {/* Outbox Queue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">Outbox Queue</CardTitle>
              <CardDescription>{outboxItems.length} items in the sync queue</CardDescription>
            </div>
            {outboxItems.some(i => i.status === 'synced') && (
              <Button variant="outline" size="sm" onClick={handleClearSynced} className="gap-1.5">
                <Trash2 className="size-3.5" />
                Clear Synced
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {outboxItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="size-8 mb-2 text-emerald-500" />
                <p className="text-sm">All changes are synced!</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {pendingItems.map(item => (
                  <OutboxItemRow key={item.id} item={item} onRetry={handleRetryItem} onCancel={handleCancelItem} />
                ))}
                {conflictItems.map(item => (
                  <OutboxItemRow key={item.id} item={item} onRetry={handleRetryItem} onCancel={handleCancelItem} />
                ))}
                {failedItems.map(item => (
                  <OutboxItemRow key={item.id} item={item} onRetry={handleRetryItem} onCancel={handleCancelItem} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sync Activity</CardTitle>
            <CardDescription>Recent sync operations</CardDescription>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent sync activity</p>
            ) : (
              <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-2">
                {recentEvents.slice(0, 20).map(event => (
                  <div key={event.id} className="flex items-center gap-3 py-1.5 text-sm">
                    <SyncEventIcon type={event.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">
                        {event.details || event.type.replace(/_/g, ' ')}
                        {event.entity && <span className="text-muted-foreground"> — {event.entity}</span>}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTimeAgo(event.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Collapsible card mode (for dashboard)
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <div className={`flex items-center justify-center size-8 rounded-lg ${
                isOffline
                  ? 'bg-amber-100 dark:bg-amber-900/30'
                  : hasIssues
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-emerald-100 dark:bg-emerald-900/30'
              }`}>
                {isOffline ? (
                  <WifiOff className="size-4 text-amber-600 dark:text-amber-400" />
                ) : hasIssues ? (
                  <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
                ) : (
                  <Database className="size-4 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <div>
                <CardTitle className="text-sm">Sync & Offline</CardTitle>
                <CardDescription>
                  {isOffline
                    ? 'Offline — changes saved locally'
                    : isSyncing
                      ? 'Syncing...'
                      : pendingCount > 0
                        ? `${pendingCount} pending change${pendingCount !== 1 ? 's' : ''}`
                        : failedCount > 0
                          ? `${failedCount} failed sync${failedCount !== 1 ? 's' : ''}`
                          : 'All data synced'
                  }
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(pendingCount > 0 || failedCount > 0 || conflictCount > 0) && (
                <div className="flex gap-1">
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {pendingCount} pending
                    </Badge>
                  )}
                  {failedCount > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5">
                      {failedCount} failed
                    </Badge>
                  )}
                </div>
              )}
              {isOpen ? (
                <ChevronUp className="size-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Connectivity & Sync Controls */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm">
                {isOffline ? (
                  <WifiOff className="size-4 text-amber-500" />
                ) : (
                  <Wifi className="size-4 text-emerald-500" />
                )}
                <span className="text-muted-foreground">
                  {isOffline ? 'Offline' : 'Online'}
                </span>
                {status?.lastSyncedAt && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      Last sync: {formatTimeAgo(status.lastSyncedAt.getTime())}
                    </span>
                  </>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleManualSync}
                disabled={isSyncing || isOffline}
                className="gap-1.5 h-8 text-xs"
              >
                {isSyncing ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                Sync Now
              </Button>
            </div>

            {/* Outbox Items */}
            {outboxItems.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Outbox ({outboxItems.length})
                  </h4>
                  {outboxItems.some(i => i.status === 'synced') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] gap-1"
                      onClick={handleClearSynced}
                    >
                      <Trash2 className="size-3" />
                      Clear synced
                    </Button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar border rounded-lg p-2">
                  {failedItems.map(item => (
                    <OutboxItemRow key={item.id} item={item} onRetry={handleRetryItem} onCancel={handleCancelItem} />
                  ))}
                  {conflictItems.map(item => (
                    <OutboxItemRow key={item.id} item={item} onRetry={handleRetryItem} onCancel={handleCancelItem} />
                  ))}
                  {pendingItems.slice(0, 10).map(item => (
                    <OutboxItemRow key={item.id} item={item} onRetry={handleRetryItem} onCancel={handleCancelItem} />
                  ))}
                  {pendingItems.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      +{pendingItems.length - 10} more pending items
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Recent Events */}
            {recentEvents.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Recent Activity
                </h4>
                <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1">
                  {recentEvents.slice(0, 8).map(event => (
                    <div key={event.id} className="flex items-center gap-2 text-xs">
                      <SyncEventIcon type={event.type} />
                      <span className="truncate flex-1">
                        {event.details || event.type.replace(/_/g, ' ')}
                        {event.entity && <span className="text-muted-foreground"> — {event.entity}</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTimeAgo(event.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ============================================
// SyncOfflinePage — full-page wrapper for route
// ============================================

export function SyncOfflinePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sync & Offline</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage offline data, sync status, and pending changes.
        </p>
      </div>
      <SyncPanel fullPage />
    </div>
  )
}



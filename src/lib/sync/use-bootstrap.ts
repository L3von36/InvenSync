'use client'

// ============================================
// useBootstrap — React hook for bootstrap state
// ============================================
// Uses useSyncExternalStore for hydration-safe
// subscriptions to the bootstrap progress state.
// ============================================

import { useCallback, useSyncExternalStore } from 'react'
import {
  bootstrapLocalData,
  needsBootstrap,
  clearBootstrapFlag,
  needsBootstrapAsync,
  type BootstrapProgress,
  type BootstrapCallbacks,
} from '@/lib/sync/bootstrap'
import { isDatabaseReady } from '@/lib/db'

// ============================================
// Bootstrap Store (external store for useSyncExternalStore)
// ============================================

const INITIAL_PROGRESS: BootstrapProgress = {
  phase: 'idle',
  currentEntity: null,
  completedEntities: [],
  totalEntities: 12,
  percentComplete: 0,
}

class BootstrapStore {
  private listeners = new Set<() => void>()
  private progress: BootstrapProgress = { ...INITIAL_PROGRESS }
  private bootstrapping = false

  getProgress(): BootstrapProgress {
    return this.progress
  }

  isBootstrapping(): boolean {
    return this.bootstrapping
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }

  private updateProgress(progress: Partial<BootstrapProgress>): void {
    this.progress = { ...this.progress, ...progress }
    this.notify()
  }

  async bootstrap(orgId: string, shopId: string | null): Promise<void> {
    if (this.bootstrapping) {
      console.log('[Bootstrap] Already in progress, skipping')
      return
    }

    this.bootstrapping = true
    this.updateProgress({ ...INITIAL_PROGRESS, phase: 'fetching' })

    const callbacks: BootstrapCallbacks = {
      onProgress: (progress) => {
        this.updateProgress(progress)
      },
      onComplete: () => {
        this.bootstrapping = false
      },
      onError: () => {
        this.bootstrapping = false
      },
    }

    try {
      await bootstrapLocalData(orgId, shopId, callbacks)
    } catch (err) {
      this.bootstrapping = false
      this.updateProgress({
        phase: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }

  reset(orgId: string): void {
    clearBootstrapFlag(orgId)
    this.bootstrapping = false
    this.progress = { ...INITIAL_PROGRESS }
    this.notify()
  }
}

// Singleton instance
const bootstrapStore = new BootstrapStore()

// ============================================
// Server snapshot for SSR hydration safety
// ============================================

const SERVER_SNAPSHOT: BootstrapProgress = { ...INITIAL_PROGRESS }

// ============================================
// useBootstrap Hook
// ============================================

export interface UseBootstrapReturn {
  /** Current bootstrap progress state */
  progress: BootstrapProgress
  /** Whether the local database has been bootstrapped at least once */
  isBootstrapped: boolean
  /** Start the bootstrap process for the given org/shop */
  bootstrap: (orgId: string, shopId: string | null) => Promise<void>
  /** Reset bootstrap state and clear the flag for the given org */
  resetBootstrap: (orgId: string) => void
  /** Whether a bootstrap operation is currently in progress */
  isBootstrapping: boolean
  /** Synchronous check — does this org need bootstrapping? */
  needsBootstrap: (orgId: string) => boolean
}

/**
 * React hook for bootstrap hydration state management.
 *
 * Uses `useSyncExternalStore` for hydration-safe subscriptions
 * and consistent rendering between server and client.
 *
 * @example
 * ```tsx
 * function BootstrapGuard({ orgId, shopId, children }) {
 *   const { progress, isBootstrapped, bootstrap, isBootstrapping } = useBootstrap()
 *
 *   useEffect(() => {
 *     if (!isBootstrapped && !isBootstrapping) {
 *       bootstrap(orgId, shopId)
 *     }
 *   }, [isBootstrapped, isBootstrapping, orgId, shopId])
 *
 *   if (!isBootstrapped) {
 *     return <BootstrapProgressUI progress={progress} />
 *   }
 *
 *   return <>{children}</>
 * }
 * ```
 */
export function useBootstrap(): UseBootstrapReturn {
  // Subscribe to the external bootstrap store
  const progress = useSyncExternalStore(
    (callback) => bootstrapStore.subscribe(callback),
    () => bootstrapStore.getProgress(),
    () => SERVER_SNAPSHOT,
  )

  // Check if the database is ready (bootstrapped)
  // Note: isDatabaseReady is async; for the sync hook we rely on
  // the progress phase and localStorage flag
  const isBootstrapped =
    progress.phase === 'complete' ||
    (typeof window !== 'undefined' && progress.phase === 'idle' &&
      !bootstrapStore.isBootstrapping())

  const isBootstrapping = bootstrapStore.isBootstrapping()

  const bootstrap = useCallback(
    async (orgId: string, shopId: string | null) => {
      await bootstrapStore.bootstrap(orgId, shopId)
    },
    [],
  )

  const resetBootstrap = useCallback(
    (orgId: string) => {
      bootstrapStore.reset(orgId)
    },
    [],
  )

  const checkNeedsBootstrap = useCallback(
    (orgId: string) => {
      return needsBootstrap(orgId)
    },
    [],
  )

  return {
    progress,
    isBootstrapped,
    bootstrap,
    resetBootstrap,
    isBootstrapping,
    needsBootstrap: checkNeedsBootstrap,
  }
}

/**
 * Async utility to check if an org needs bootstrapping.
 * Useful in route guards or middleware where you can use async/await.
 */
export { needsBootstrapAsync as checkNeedsBootstrapAsync }

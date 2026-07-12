'use client'

import { useEffect, useRef, useState, Suspense, lazy } from 'react'
import { Loader2, Package } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth-store'
import { PWAInstallPrompt } from '@/components/shared/pwa-install-prompt'
import { OfflineIndicator } from '@/components/shared/offline-indicator'
import { SwUpdateBanner } from '@/components/shared/sw-update-banner'

// Dynamically import all components
const AuthFlow = lazy(() => import('@/components/app/auth-flow'))
const AppShell = lazy(() => import('@/components/app/app-shell'))
const SupabaseSetupPage = lazy(() => import('@/components/app/setup/supabase-setup-page').then(m => ({ default: m.SupabaseSetupPage })))

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <div className="flex items-center justify-center size-14 rounded-xl bg-primary text-primary-foreground animate-pulse">
        <Package className="size-7" />
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">Loading InvenSync...</span>
      </div>
    </div>
  )
}

export default function AppRoot() {
  const { isAuthenticated, isLoading, dbUnreachable, checkAuth } = useAuthStore()
  const [dbStatus, setDbStatus] = useState<'checking' | 'unreachable' | 'ok'>('checking')
  // Track whether DB was ever confirmed reachable — prevents flickering
  // between setup page and app when transient network errors occur
  const [wasDbEverOk, setWasDbEverOk] = useState(false)
  // Prevent double invocation of checkAuth
  const hasCheckedRef = useRef(false)

  // Note: Offline sync is now handled by the new sync engine in app-shell.tsx
  // The old offline-queue system has been replaced by the Dexie-based sync engine

  useEffect(() => {
    if (hasCheckedRef.current) return
    hasCheckedRef.current = true
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    let cancelled = false
    fetch('/api/setup/status')
      .then(res => {
        // Non-200 (e.g. 404 in older deployments) — treat as ok to avoid redirect loop
        if (!res.ok) return { database: { status: 'connected' } }
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        if (data.database?.status === 'unreachable' || data.database?.status === 'auth_failed') {
          // Only show setup page if DB was NEVER ok before
          setWasDbEverOk(prev => {
            if (!prev) {
              setDbStatus('unreachable')
            } else {
              // Transient failure — treat as ok so we don't flicker
              setDbStatus('ok')
            }
            return prev
          })
        } else {
          setDbStatus('ok')
          setWasDbEverOk(true)
        }
      })
      .catch(() => {
        if (cancelled) return
        // Network error — treat as ok to avoid setup page redirect loop
        setDbStatus('ok')
      })
    return () => { cancelled = true }
  }, [])

  // Timeout fallback: if we're stuck on 'checking' for more than 10s,
  // assume DB is ok to prevent indefinite loading
  useEffect(() => {
    if (dbStatus !== 'checking') return
    const timer = setTimeout(() => {
      setDbStatus('ok')
      setWasDbEverOk(true)
    }, 10000)
    return () => clearTimeout(timer)
  }, [dbStatus])

  if (isLoading || dbStatus === 'checking') {
    return <LoadingScreen />
  }

  // Only show setup page if DB was never connected AND current status is unreachable
  if (!wasDbEverOk && (dbUnreachable || dbStatus === 'unreachable')) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <SupabaseSetupPage />
      </Suspense>
    )
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AuthFlow />
      </Suspense>
    )
  }

  return (
    <>
      <SwUpdateBanner />
      <OfflineIndicator />
      <Suspense fallback={<LoadingScreen />}>
        <AppShell />
      </Suspense>
      <PWAInstallPrompt />
    </>
  )
}

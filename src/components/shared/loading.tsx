'use client'

// ============================================
// Shared Loading Components
// ============================================

import { useEffect, useRef } from 'react'
import { Loader2, Package } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/lib/stores/app-store'

// ============================================
// Navigation Progress Bar — Visible top bar with shimmer
// ============================================

export function NavigationProgressBar() {
  const isNavigating = useAppStore((s) => s.isNavigating)
  const setNavigating = useAppStore((s) => s.setNavigating)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Clean up any existing timers
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    if (isNavigating) {
      // Direct DOM manipulation for animation
      const bar = barRef.current
      if (bar) {
        bar.style.width = '0%'
        bar.style.transition = 'none'
      }

      const t1 = setTimeout(() => {
        if (bar) bar.style.width = '40%'
      }, 50)
      const t2 = setTimeout(() => {
        if (bar) bar.style.width = '70%'
      }, 200)
      const t3 = setTimeout(() => {
        if (bar) {
          bar.style.transition = 'width 0.3s ease-out'
          bar.style.width = '100%'
        }
        const t4 = setTimeout(() => {
          setNavigating(false)
        }, 300)
        timersRef.current.push(t4)
      }, 400)

      timersRef.current = [t1, t2, t3]
    }

    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  }, [isNavigating, setNavigating])

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] h-1 transition-opacity duration-200 ${isNavigating ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <div
        ref={barRef}
        className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary relative overflow-hidden"
        style={{ width: '0%' }}
      >
        {/* Shimmer effect */}
        {isNavigating && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_1.5s_infinite]" />
        )}
      </div>
    </div>
  )
}

// ============================================
// Page Transition Skeleton — Shows while navigating
// ============================================

export function PageTransitionSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3.5 w-52" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="size-7 rounded-md" />
            </div>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-[180px] w-full rounded-md" />
        </div>
        <div className="rounded-lg border p-4 space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-[180px] w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}

// ============================================
// Inline Loading Spinner — For sections
// ============================================

export function InlineLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

// ============================================
// App Loading Screen — Full page loading
// ============================================

export function AppLoadingScreen() {
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

'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'

// ============================================
// Offline Indicator
// ============================================
// Shows a small indicator when the app is offline.
// Appears as a fixed bar at the top of the viewport.

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

  if (!isOffline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top-2 duration-200" role="alert" aria-live="assertive">
      <div className="bg-amber-500 text-amber-950 px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-medium">
        <WifiOff className="size-3.5" aria-hidden="true" />
        <span>You are offline — some features may be limited</span>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/lib/stores/auth-store'

/**
 * Monitors for session expiry across tabs and automatically logs out the user.
 * This component doesn't render anything — it's a side-effect handler.
 *
 * IMPORTANT: We no longer monkey-patch window.fetch because it's fragile and
 * can interfere with login after logout. Instead, we only listen for the
 * StorageEvent (cross-tab logout) and let the api-client.ts handle 401s
 * directly in its request() method.
 */
export function SessionExpiryHandler() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logoutRef = useRef(useAuthStore.getState().logout)

  // Keep logout ref up to date
  useEffect(() => {
    logoutRef.current = useAuthStore.getState().logout
  })

  useEffect(() => {
    if (!isAuthenticated) return

    const handleStorageChange = (e: StorageEvent) => {
      // If the token was removed from another tab, log out here too
      if (e.key === 'sb_token' && !e.newValue) {
        logoutRef.current()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [isAuthenticated])

  return null
}

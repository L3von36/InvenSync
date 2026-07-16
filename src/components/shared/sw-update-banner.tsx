'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Shows a banner when a new service worker takes control — i.e. a new
 * version of the app has been deployed while the user had a tab open.
 * Without this, users keep running stale precached bundles until they
 * happen to reload, and can hit API/schema mismatches silently.
 */
export function SwUpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Ignore the very first controllerchange fired when the SW is
    // installed for the first time — only prompt on real updates.
    let hadController = !!navigator.serviceWorker.controller

    const onControllerChange = () => {
      if (hadController) {
        setUpdateReady(true)
      }
      hadController = true
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  if (!updateReady) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-3 bg-primary text-primary-foreground text-sm py-2 px-4 shadow-md"
    >
      <span>A new version of InvenSync is available.</span>
      <Button
        size="sm"
        variant="secondary"
        className="h-7 gap-1.5"
        onClick={() => window.location.reload()}
      >
        <RefreshCw className="size-3.5" />
        Refresh
      </Button>
    </div>
  )
}

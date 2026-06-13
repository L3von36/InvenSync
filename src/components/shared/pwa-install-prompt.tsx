'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ============================================
// PWA Install Prompt
// ============================================
// Shows a dismissible banner at the bottom when
// the app can be installed (beforeinstallprompt event).

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if the user previously dismissed the banner
    const wasDismissed = localStorage.getItem('pwa-install-dismissed')
    if (wasDismissed) {
      const dismissedAt = parseInt(wasDismissed, 10)
      // Show again after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true)
        return
      }
    }

    const handler = (e: Event) => {
      // Prevent the default mini-infobar
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Also listen for the appinstalled event to hide the banner
    window.addEventListener('appinstalled', () => {
      setShowBanner(false)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        // The app was installed
        setShowBanner(false)
      }
    } catch (err) {
      console.error('[PWA] Install prompt error:', err)
    } finally {
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShowBanner(false)
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  if (!showBanner || dismissed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-900 text-white rounded-xl shadow-lg p-4 flex items-center gap-3">
        <div className="size-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
          <Download className="size-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Install InvenSync</p>
          <p className="text-xs text-slate-300 mt-0.5">
            Add to home screen for quick access & offline support
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={handleInstall}
            className="h-8 text-xs bg-white text-slate-900 hover:bg-slate-100"
          >
            Install
          </Button>
          <button
            onClick={handleDismiss}
            className="size-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

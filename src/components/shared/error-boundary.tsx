'use client'

import React from 'react'
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  isOfflineError: boolean
  isChunkLoadError: boolean
}

// ---------------------------------------------------------------------------
// ChunkLoadError auto-reload logic.
//
// When a new deployment ships, old JS chunks (referenced by cached HTML or a
// stale service worker) 404 → ChunkLoadError. The only reliable fix is to
// reload the page so the browser fetches fresh HTML with up-to-date chunk
// hashes. Retrying in-place doesn't help because the missing chunk will never
// appear.
//
// To prevent infinite reload loops (e.g. if the new deployment itself is
// broken), we track reloads in sessionStorage and cap at one auto-reload per
// page session. If the error persists after that, we fall back to the manual
// error UI so the user can decide.
// ---------------------------------------------------------------------------
const CHUNK_RELOAD_KEY = 'invensync_chunk_reloaded'
const CHUNK_RELOAD_LIMIT = 1

function isChunkLoadError(error: Error): boolean {
  // ChunkLoadError is the error *name* (e.constructor.name === 'ChunkLoadError'),
  // but minified builds may lose the name. Match the message too, which Next.js
  // / Turbopack formats as "Failed to load chunk /_next/static/chunks/xxx.js".
  return (
    error?.name === 'ChunkLoadError' ||
    error?.message?.includes('Failed to load chunk') ||
    error?.message?.includes('Loading chunk') ||
    error?.message?.includes('ChunkLoadError') ||
    error?.message?.includes('dynamically imported module')
  )
}

function shouldAutoReloadForChunk(): boolean {
  try {
    const count = parseInt(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0', 10)
    if (count >= CHUNK_RELOAD_LIMIT) return false
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(count + 1))
    return true
  } catch {
    // sessionStorage may be unavailable (private mode) — allow reload
    return true
  }
}

export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY)
  } catch {
    // ignore
  }
}

export class GlobalErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, isOfflineError: false, isChunkLoadError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Check if this is a network/offline error
    const message = error.message || ''
    const isOfflineError =
      message.includes('Network error') ||
      message.includes('Failed to fetch') ||
      message.includes('offline') ||
      message.includes('no cached data') ||
      message.includes('You are offline') ||
      message.includes('check your internet')

    const chunkError = isChunkLoadError(error)

    return { hasError: true, isOfflineError, isChunkLoadError: chunkError }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log technical details to console only — never show to users
    console.error('GlobalErrorBoundary caught:', error, errorInfo)

    // Auto-reload on ChunkLoadError (stale deployment) — but only once per
    // session to avoid infinite loops if the new deployment is also broken.
    if (isChunkLoadError(error) && shouldAutoReloadForChunk()) {
      console.warn('[GlobalErrorBoundary] ChunkLoadError detected — auto-reloading to fetch new chunks')
      // Hard reload to bypass any SW cache that may be serving stale HTML
      window.location.reload()
    }
  }

  handleReset = () => {
    // Clear the chunk reload flag so future chunk errors can auto-reload again
    clearChunkReloadFlag()
    this.setState({ hasError: false, isOfflineError: false, isChunkLoadError: false })
  }

  handleReload = () => {
    clearChunkReloadFlag()
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Show offline-specific error message
      if (this.state.isOfflineError) {
        return (
          <div className="min-h-[30.769rem] flex flex-col items-center justify-center p-8 text-center">
            <div className="size-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
              <WifiOff className="size-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">You&apos;re offline</h2>
            <p className="text-muted-foreground max-w-md text-sm">
              It looks like you&apos;ve lost your internet connection. Your data is still available locally — try navigating to a different page.
            </p>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={this.handleReset}>
                <RefreshCw className="size-4 mr-2" />
                Try Again
              </Button>
              <Button variant="outline" onClick={this.handleReload}>
                Reload Page
              </Button>
            </div>
          </div>
        )
      }

      // ChunkLoadError that survived auto-reload — show deployment-update message
      if (this.state.isChunkLoadError) {
        return (
          <div className="min-h-[30.769rem] flex flex-col items-center justify-center p-8 text-center">
            <div className="size-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
              <RefreshCw className="size-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">A new version is available</h2>
            <p className="text-muted-foreground max-w-md text-sm">
              The app was updated since you last loaded it. Please reload to get the latest version.
            </p>
            <Button variant="outline" onClick={this.handleReload} className="mt-6 gap-2">
              <RefreshCw className="size-4" />
              Reload Page
            </Button>
          </div>
        )
      }

      return (
        <div className="min-h-[30.769rem] flex flex-col items-center justify-center p-8 text-center">
          <div className="size-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground max-w-md text-sm">
            An unexpected error occurred. Please try again or refresh the page.
          </p>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={this.handleReset}>
              <RefreshCw className="size-4 mr-2" />
              Try Again
            </Button>
            <Button variant="outline" onClick={this.handleReload}>
              Reload Page
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

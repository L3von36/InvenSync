'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clearChunkReloadFlag } from '@/components/shared/error-boundary'

// Must match the key in error-boundary.tsx so only ONE auto-reload happens
// per session across all error handlers (boundary, route error, global listener).
const CHUNK_RELOAD_KEY = 'invensync_chunk_reloaded'
const CHUNK_RELOAD_LIMIT = 1

function isChunkLoadError(error: Error): boolean {
  return (
    error?.name === 'ChunkLoadError' ||
    error?.message?.includes('Failed to load chunk') ||
    error?.message?.includes('Loading chunk') ||
    error?.message?.includes('ChunkLoadError') ||
    error?.message?.includes('dynamically imported module')
  )
}

function shouldAutoReload(): boolean {
  try {
    const count = parseInt(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0', 10)
    if (count >= CHUNK_RELOAD_LIMIT) return false
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(count + 1))
    return true
  } catch {
    return true
  }
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Log error digest and message to console only — never expose to the user
  console.error('[InvenSync Route Error]', {
    digest: error.digest,
    message: error.message,
    name: error.name,
  })

  const isChunkError = isChunkLoadError(error)

  // Auto-reload on ChunkLoadError (stale deployment) — once per session.
  // This catches chunk errors that bubble up to the Next.js route error
  // boundary instead of the React GlobalErrorBoundary.
  useEffect(() => {
    if (isChunkError && shouldAutoReload()) {
      console.warn('[Route Error] ChunkLoadError — auto-reloading for new chunks')
      window.location.reload()
    }
  }, [isChunkError])

  const handleRetry = () => {
    if (isChunkError) {
      clearChunkReloadFlag()
      window.location.reload()
    } else {
      reset()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[30.769rem] p-8 text-center" role="alert">
      <div className="size-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
        <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        {isChunkError
          ? 'A new version of the app is available. Please reload to get the latest version.'
          : 'An unexpected error occurred. Please try again or contact support if the problem persists.'}
      </p>
      <Button onClick={handleRetry} variant="outline" className="mt-6 gap-2">
        <RefreshCw className="size-4" />
        {isChunkError ? 'Reload Page' : 'Try Again'}
      </Button>
    </div>
  )
}

'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  })

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center" role="alert">
      <div className="size-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
        <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        An unexpected error occurred. Please try again or contact support if the
        problem persists.
      </p>
      <Button onClick={reset} variant="outline" className="mt-6 gap-2">
        <RefreshCw className="size-4" />
        Try Again
      </Button>
    </div>
  )
}

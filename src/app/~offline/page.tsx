import type { Metadata } from 'next'
import { WifiOff } from 'lucide-react'

// Precached by the service worker (src/sw.ts fallbacks) and served when a
// navigation happens offline with nothing cached for the requested page.

export const metadata: Metadata = {
  title: 'InvenSync — Offline',
}

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="text-center max-w-sm">
        <div className="ds-brand-gradient mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl text-white">
          <WifiOff className="size-8" />
        </div>
        <h1 className="text-xl font-bold tracking-tight mb-2">You&apos;re Offline</h1>
        <p className="text-sm text-muted-foreground mb-6">
          It looks like you&apos;ve lost your internet connection. Your data is
          still available locally. Please check your network and try again.
        </p>
        <a
          href="/"
          className="inline-block rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try Again
        </a>
      </div>
    </div>
  )
}

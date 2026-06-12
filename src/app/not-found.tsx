'use client'

import { Package, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-background" role="main">
      {/* InvenSync Branding */}
      <div className="flex items-center gap-3 mb-10">
        <div className="size-11 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
          <Package className="size-5.5 text-primary-foreground" strokeWidth={2} aria-hidden="true" />
        </div>
        <span className="text-2xl font-bold tracking-tight">InvenSync</span>
      </div>

      {/* 404 Icon */}
      <div className="size-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
        <span className="text-4xl font-bold text-muted-foreground">404</span>
      </div>

      {/* Content */}
      <h1 className="text-2xl font-semibold mb-2">Page Not Found</h1>
      <p className="text-muted-foreground max-w-md text-sm mb-8">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Check the URL or navigate back to the dashboard.
      </p>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={() => window.history.back()}
          variant="outline"
          className="gap-2"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Go Back
        </Button>
        <Button
          onClick={() => window.location.href = '/'}
          className="gap-2"
        >
          <Home className="size-4" aria-hidden="true" />
          Go Home
        </Button>
      </div>
    </div>
  )
}

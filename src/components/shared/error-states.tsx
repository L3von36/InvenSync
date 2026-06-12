'use client'

import { AlertTriangle, RefreshCw, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ============================================
// Error State Component — Reusable across all pages
// ============================================
interface ErrorStateProps {
  title?: string
  message?: string
  error?: string
  onRetry?: () => void
  icon?: React.ReactNode
}

export function ErrorState({
  title = 'Failed to load',
  message,
  error,
  onRetry,
  icon,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="size-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
        {icon || <AlertTriangle className="size-7 text-destructive" />}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-md text-sm">
        {message || error || 'Something went wrong. Please try again.'}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="mt-4 gap-2">
          <RefreshCw className="size-4" />
          Try Again
        </Button>
      )}
    </div>
  )
}

// ============================================
// Empty State Component — Reusable across all pages
// ============================================
interface EmptyStateProps {
  title: string
  message?: string
  icon?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="size-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        {icon || <Inbox className="size-7 text-muted-foreground" />}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {message && (
        <p className="text-muted-foreground mt-1 max-w-md text-sm">{message}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-4 gap-2">
          {action.label}
        </Button>
      )}
    </div>
  )
}

// ============================================
// Inline Field Error — Shows validation error below an input
// ============================================
interface FieldErrorProps {
  message?: string | null
}

export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null
  return (
    <p className="text-xs text-destructive mt-1">{message}</p>
  )
}

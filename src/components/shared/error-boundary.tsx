'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class GlobalErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log technical details to console only — never show to users
    console.error('GlobalErrorBoundary caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
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

'use client'

import { lazy, type ComponentType } from 'react'

/**
 * Dynamic Import Utility with Retry
 * 
 * Provides lazy-loading with automatic retry on network failures.
 * Inspired by YouTube's lazy-loading pattern for heavy components.
 * 
 * Usage:
 *   const HeavyChart = dynamicImport(() => import('./heavy-chart'), 'HeavyChart')
 *   const Markdown = dynamicImport(() => import('react-markdown'))
 */

interface DynamicImportOptions {
  /** Maximum number of retry attempts (default: 3) */
  retries?: number
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number
  /** Named export to use as default (for non-default exports) */
  namedExport?: string
}

/**
 * Creates a lazy-loaded component with automatic retry on chunk load failure.
 * This handles the common case where a user's browser fails to load a chunk
 * due to network issues or deployment updates.
 */
export function dynamicImport<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T } | Record<string, unknown>>,
  namedExport?: string,
  options: DynamicImportOptions = {}
): React.LazyExoticComponent<T> {
  const { retries = 3, retryDelay = 1000 } = options

  const retryableImport = async (): Promise<{ default: T }> => {
    let lastError: unknown

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const mod = await importFn()

        // If a named export is specified, use it as default
        if (namedExport && typeof mod === 'object' && namedExport in mod) {
          return { default: mod[namedExport] as T }
        }

        // If the module has a default export, use it
        if ('default' in mod) {
          return { default: mod.default as T }
        }

        // If it's a non-default export module, wrap the first export
        const firstExport = Object.values(mod)[0] as T
        return { default: firstExport }
      } catch (error) {
        lastError = error

        // Only retry on chunk load errors (network/deployment issues)
        const isChunkLoadError =
          error instanceof Error &&
          (error.message.includes('Loading chunk') ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('ChunkLoadError') ||
            error.message.includes('dynamically imported module'))

        if (!isChunkLoadError || attempt === retries) {
          throw error
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)))
      }
    }

    throw lastError
  }

  return lazy(retryableImport)
}

/**
 * Preloads a dynamic import — call this on hover/focus to warm the cache
 * so the component is ready when the user navigates.
 * 
 * Usage:
 *   <Link onMouseEnter={() => preload(() => import('./heavy-page'))}>
 */
export function preload(importFn: () => Promise<unknown>): void {
  importFn().catch(() => {
    // Silently ignore preload failures — the actual import will retry
  })
}

'use client'

import { useRef, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'

const emptySubscribe = () => () => {}

/**
 * Premium animated theme toggle inspired by 21st.dev community components.
 *
 * Features:
 * - Smooth sun/moon icon transition with rotation and scale
 * - Star particles that appear in dark mode
 * - Accessible with aria-label and keyboard support
 * - Avoids hydration mismatch using useSyncExternalStore
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  // Avoid hydration mismatch: only render the animated toggle on the client
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )

  if (!mounted) {
    return (
      <button
        className={`relative inline-flex items-center justify-center rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${className ?? ''}`}
        aria-label="Toggle theme"
      >
        <span className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`relative inline-flex items-center justify-center rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className ?? ''}`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      <motion.div
        className="relative w-5 h-5"
        animate={{ rotate: isDark ? 45 : 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Sun */}
        <motion.div
          className="absolute inset-0"
          animate={{
            scale: isDark ? 0 : 1,
            opacity: isDark ? 0 : 1,
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
        </motion.div>

        {/* Moon */}
        <motion.div
          className="absolute inset-0"
          animate={{
            scale: isDark ? 1 : 0,
            opacity: isDark ? 1 : 0,
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        </motion.div>

        {/* Stars - visible in dark mode */}
        <AnimatePresence>
          {isDark && (
            <>
              <motion.span
                className="absolute rounded-full bg-current"
                style={{ width: 1.5, height: 1.5, top: 2, right: 2 }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ delay: 0.15, duration: 0.2 }}
              />
              <motion.span
                className="absolute rounded-full bg-current"
                style={{ width: 1, height: 1, bottom: 5, right: 0 }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ delay: 0.25, duration: 0.2 }}
              />
              <motion.span
                className="absolute rounded-full bg-current"
                style={{ width: 1.5, height: 1.5, bottom: 1, left: 4 }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ delay: 0.35, duration: 0.2 }}
              />
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </button>
  )
}

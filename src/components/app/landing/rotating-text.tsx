'use client'

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface RotatingTextProps {
  phrases: string[]
  interval?: number
  className?: string
}

/**
 * Premium rotating text with vertical swap-up animation.
 *
 * Architecture:
 * - Measures the widest phrase on mount → locks container to that width
 * - Uses only <span> elements (valid inside any inline parent)
 * - AnimatePresence mode="wait" for clean enter/exit
 * - All motion uses translateY + opacity only (GPU-accelerated)
 * - Respects prefers-reduced-motion
 */
export function RotatingText({
  phrases,
  interval = 3000,
  className,
}: RotatingTextProps) {
  const [index, setIndex] = useState(0)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const measureRef = useRef<HTMLSpanElement>(null)

  const advance = useCallback(() => {
    setIndex((prev) => (prev + 1) % phrases.length)
  }, [phrases.length])

  // Cycle through phrases
  useEffect(() => {
    if (phrases.length <= 1) return
    const timer = setInterval(advance, interval)
    return () => clearInterval(timer)
  }, [advance, interval, phrases.length])

  // Listen for prefers-reduced-motion changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Measure all phrases on mount and lock to the widest width
  useLayoutEffect(() => {
    const container = measureRef.current
    if (!container) return

    const spans = container.querySelectorAll('[data-measure]')
    let maxW = 0
    spans.forEach((span) => {
      const w = (span as HTMLElement).offsetWidth
      if (w > maxW) maxW = w
    })

    if (maxW > 0) {
      // Use startTransition to avoid cascading render warning
      React.startTransition(() => {
        setContainerWidth(maxW + 4)
      })
    }
  }, [phrases, className])

  // Reduced motion: static text with fixed width
  if (prefersReducedMotion) {
    return (
      <>
        <span
          ref={measureRef}
          aria-hidden="true"
          style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none' }}
        >
          {phrases.map((p) => (
            <span key={p} data-measure className={className}>{p}</span>
          ))}
        </span>
        <span
          className={className}
          style={
            containerWidth
              ? { minWidth: containerWidth, display: 'inline-block', textAlign: 'center' as const }
              : undefined
          }
          aria-live="polite"
          aria-atomic="true"
        >
          {phrases[index]}
        </span>
      </>
    )
  }

  return (
    <>
      {/* Hidden measurer — always in DOM for useLayoutEffect measurement */}
      <span
        ref={measureRef}
        data-rotating-measurer
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          display: 'inline',
          pointerEvents: 'none',
        }}
      >
        {phrases.map((p) => (
          <span key={p} data-measure className={className}>
            {p}
          </span>
        ))}
      </span>

      {/* Visible rotating text — fixed width, centered, zero reflow */}
      <span
        style={{
          display: 'inline-block',
          width: containerWidth ?? 'auto',
          height: '1.15em',
          position: 'relative',
          overflow: 'hidden',
          verticalAlign: 'bottom',
        }}
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={phrases[index]}
            className={className}
            initial={{ y: '110%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '-110%', opacity: 0 }}
            transition={{
              y: {
                type: 'tween',
                ease: [0.25, 0.46, 0.45, 0.94],
                duration: 0.6,
              },
              opacity: {
                type: 'tween',
                ease: 'easeInOut',
                duration: 0.5,
              },
            }}
            style={{
              display: 'block',
              whiteSpace: 'nowrap',
              willChange: 'transform, opacity',
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              textAlign: 'center',
            }}
          >
            {phrases[index]}
          </motion.span>
        </AnimatePresence>
      </span>
    </>
  )
}

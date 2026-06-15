'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

interface RotatingTextProps {
  phrases: string[]
  interval?: number
  className?: string
}

/**
 * Premium rotating text animation component.
 *
 * - Cycles through phrases with a slide-up/fade transition
 * - Uses hardware-accelerated transforms (translateY + opacity only)
 * - Fixed container height prevents layout shifts
 * - Respects prefers-reduced-motion via Framer Motion's useReducedMotion
 * - AnimatePresence handles enter/exit with mode="wait" for zero overlap
 */
export function RotatingText({
  phrases,
  interval = 2500,
  className,
}: RotatingTextProps) {
  const [index, setIndex] = useState(0)
  const shouldReduceMotion = useReducedMotion()

  const advance = useCallback(() => {
    setIndex((prev) => (prev + 1) % phrases.length)
  }, [phrases.length])

  useEffect(() => {
    if (phrases.length <= 1) return
    const timer = setInterval(advance, interval)
    return () => clearInterval(timer)
  }, [advance, interval, phrases.length])

  // When reduced motion is preferred, just show static text
  if (shouldReduceMotion) {
    return (
      <span className={className} aria-live="polite" aria-atomic="true">
        {phrases[index]}
      </span>
    )
  }

  return (
    <span
      className="relative inline-flex overflow-hidden align-bottom"
      // Fixed height matching the text line to prevent layout shifts
      style={{ height: '1em' }}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={phrases[index]}
          className={className}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{
            y: { type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.5 },
            opacity: { type: 'tween', ease: 'easeInOut', duration: 0.4 },
          }}
          style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
            willChange: 'transform, opacity',
          }}
        >
          {phrases[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

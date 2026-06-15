'use client'

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
} from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

interface RotatingTextProps {
  phrases: string[]
  interval?: number
  className?: string
}

/**
 * Premium rotating text with swap-up animation.
 *
 * - Current phrase slides up and fades out
 * - Next phrase slides up from below and fades in
 * - Container width is locked to the widest phrase → no layout shifts
 * - Hardware-accelerated transforms only (translateY + opacity)
 * - Respects prefers-reduced-motion
 */
export function RotatingText({
  phrases,
  interval = 2500,
  className,
}: RotatingTextProps) {
  const [index, setIndex] = useState(0)
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const shouldReduceMotion = useReducedMotion()

  const advance = useCallback(() => {
    setIndex((prev) => (prev + 1) % phrases.length)
  }, [phrases.length])

  useEffect(() => {
    if (phrases.length <= 1) return
    const timer = setInterval(advance, interval)
    return () => clearInterval(timer)
  }, [advance, interval, phrases.length])

  // Measure the widest phrase on mount so the container never changes size
  useLayoutEffect(() => {
    if (!measureRef.current) return
    const spans = measureRef.current.children
    let maxW = 0
    for (let i = 0; i < spans.length; i++) {
      const w = (spans[i] as HTMLElement).offsetWidth
      if (w > maxW) maxW = w
    }
    setMeasuredWidth(maxW)
  }, [phrases, className])

  // Reduced motion: static text, no animation
  if (shouldReduceMotion) {
    return (
      <span
        className={className}
        style={measuredWidth ? { minWidth: measuredWidth } : undefined}
        aria-live="polite"
        aria-atomic="true"
      >
        {phrases[index]}
      </span>
    )
  }

  return (
    <>
      {/* Hidden measurer — renders all phrases to find the widest one */}
      <span
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {phrases.map((p) => (
          <span key={p} className={className}>
            {p}
          </span>
        ))}
      </span>

      {/* Visible rotating text */}
      <span
        className="relative inline-block overflow-hidden align-bottom"
        style={{
          height: '1em',
          width: measuredWidth ? `${measuredWidth}px` : 'auto',
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
                ease: [0.22, 1, 0.36, 1],
                duration: 0.45,
              },
              opacity: {
                type: 'tween',
                ease: 'easeInOut',
                duration: 0.35,
              },
            }}
            style={{
              display: 'inline-block',
              whiteSpace: 'nowrap',
              willChange: 'transform, opacity',
              position: 'absolute',
              left: 0,
              top: 0,
            }}
          >
            {phrases[index]}
          </motion.span>
        </AnimatePresence>
      </span>
    </>
  )
}

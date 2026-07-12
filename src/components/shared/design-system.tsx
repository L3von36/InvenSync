'use client'

// ============================================
// InvenSync Design System — shared primitives
// ============================================
// The single source of truth for branded page chrome and KPI display.
// Usage rules, tone semantics, and visual language are documented in
// DESIGN_SYSTEM.md at the repo root.
//
// - PageHeader: branded header for every dashboard/page (icon tile,
//   title, badges, actions, gradient hairline)
// - StatCard / StatCardSkeleton: unified KPI card (replaces the
//   per-page copies that had drifted apart)
// - SectionCard: consistent wrapper for charts and content sections
// ============================================

import { memo } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ============================================
// Tone system
// ============================================
// Color carries MEANING, never decoration. A KPI icon is neutral unless
// the metric itself is a signal:
//   brand   — THE one primary business metric on the screen (revenue).
//             At most one brand-toned card per view.
//   success — positive financial health (profit, growth)
//   warning — needs attention soon (low stock, pending, expiring)
//   danger  — needs attention now (out of stock, overdue debt)
//   neutral — everything else: counts, totals, informational metrics
//
// `info` and `violet` are legacy decorative tones — they intentionally
// render as neutral now. Sky-blue "Total Products" tells the user
// nothing; it just adds noise.

export type StatTone =
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'violet'
  | 'neutral'

const NEUTRAL_TONE = { bg: 'bg-muted', text: 'text-muted-foreground' }

export const STAT_TONE_CLASSES: Record<StatTone, { bg: string; text: string }> = {
  brand: { bg: 'bg-primary/10', text: 'text-primary' },
  success: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  danger: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
  // Legacy decorative tones — mapped to neutral on purpose
  info: NEUTRAL_TONE,
  violet: NEUTRAL_TONE,
  neutral: NEUTRAL_TONE,
}

// ============================================
// PageHeader
// ============================================

interface PageHeaderProps {
  /** Icon rendered inside the brand-gradient tile */
  icon?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Chips rendered inline next to the title (status, region, offline...) */
  badges?: React.ReactNode
  /** Right-aligned controls (refresh, date pickers, filters...) */
  actions?: React.ReactNode
  className?: string
}

/**
 * Branded page header — gives every dashboard the same InvenSync
 * identity: gradient icon tile, bold title, muted subtitle, and a
 * gradient hairline separating the header from the content.
 */
export function PageHeader({ icon, title, subtitle, badges, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div
              className="ds-brand-gradient flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm [&_svg]:size-5 sm:[&_svg]:size-[22px]"
              aria-hidden="true"
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h1>
              {badges}
            </div>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
      </div>
      <div className="ds-hairline" aria-hidden="true" />
    </div>
  )
}

// ============================================
// StatCard
// ============================================

export interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  /** Semantic tone for the icon tile — the only supported way to color a KPI */
  tone?: StatTone
  /**
   * DEPRECATED — intentionally ignored. Per-page color overrides are what
   * created the rainbow dashboards. Kept only so legacy call sites compile;
   * they render neutral until migrated to `tone`.
   */
  iconBgClass?: string
  /** DEPRECATED — intentionally ignored, see iconBgClass. */
  iconTextClass?: string
  comparisonBadge?: React.ReactNode
}

/**
 * Unified KPI card. One layout for every dashboard so numbers read
 * the same everywhere: muted label + icon tile on top, semibold
 * tabular value, muted context line (with optional comparison badge).
 * Neutral by default — color must be earned via a semantic `tone`.
 */
export const StatCard = memo(function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone = 'neutral',
  comparisonBadge,
}: StatCardProps) {
  const toneClasses = STAT_TONE_CLASSES[tone]

  return (
    <Card className="ds-card-interactive gap-2 sm:gap-4">
      <CardHeader className="flex flex-row items-center justify-between pb-0 space-y-0">
        <CardDescription className="text-xs text-muted-foreground font-medium pr-1 line-clamp-1">
          {title}
        </CardDescription>
        <div
          className={cn(
            'flex items-center justify-center size-7 sm:size-10 rounded-lg shrink-0',
            toneClasses.bg
          )}
        >
          <div className={cn('[&_svg]:size-3.5 sm:[&_svg]:size-5', toneClasses.text)}>
            {icon}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xl sm:text-2xl font-semibold tabular-nums tracking-tight leading-tight whitespace-nowrap">
          {value}
        </div>
        {(subtitle || comparisonBadge) && (
          <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
            {subtitle && <p className="text-xs text-muted-foreground line-clamp-1">{subtitle}</p>}
            {comparisonBadge}
          </div>
        )}
      </CardContent>
    </Card>
  )
})

export function StatCardSkeleton() {
  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row items-center justify-between pb-0">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-10 rounded-lg" />
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-8 w-36 mb-1" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  )
}

// ============================================
// SectionCard
// ============================================

interface SectionCardProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Right-aligned header controls (filters, "view all" links...) */
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

/**
 * Consistent wrapper for charts, lists, and content sections so every
 * dashboard block shares the same header rhythm and elevation.
 */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <Card className={cn('ds-card-interactive', className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {description && <CardDescription className="text-xs mt-1">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}

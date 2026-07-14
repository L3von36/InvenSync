'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Calculator,
  CalendarClock,
  Scale,
  TrendingUp,
  AlertTriangle,
  Info,
  Save,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { api, type TaxSummary } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getNetworkErrorMessage } from '@/lib/validation'
import { PageHeader, StatCard, StatCardSkeleton } from '@/components/shared/design-system'
import { ErrorState } from '@/components/shared/error-states'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { formatETB, formatNumber, formatDate } from '@/lib/format'

// ============================================
// Helpers
// ============================================

function pct(rate: number): string {
  return `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 1)}%`
}

const THRESHOLD_COPY: Record<TaxSummary['threshold']['level'], { label: string; className: string }> = {
  ok: { label: 'Well below the 2M threshold', className: 'text-muted-foreground' },
  approaching: { label: 'Approaching the 2M threshold', className: 'text-amber-600 dark:text-amber-400' },
  warning: { label: 'Close to the 2M threshold — prepare for VAT + Category A', className: 'text-amber-600 dark:text-amber-400' },
  critical: { label: 'Nearly at the 2M threshold — VAT registration and full books will be required', className: 'text-red-600 dark:text-red-400' },
  exceeded: { label: 'Threshold exceeded — VAT registration and Category A rules apply', className: 'text-red-600 dark:text-red-400' },
}

// ============================================
// Profile setup card
// ============================================

function TaxProfileCard({ summary, onSaved }: { summary: TaxSummary; onSaved: () => void }) {
  const { currentOrg } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(summary.profile)

  const save = async () => {
    if (!currentOrg) return
    setSaving(true)
    try {
      await api.saveTaxProfile(currentOrg.id, form)
      toast.success('Tax profile saved')
      onSaved()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Tax profile</CardTitle>
        <CardDescription>
          These facts determine which regime applies to your business.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="tax-legal-form">Legal form</Label>
            <Select
              value={form.legalForm}
              onValueChange={(v) => setForm({ ...form, legalForm: v as 'individual' | 'entity' })}
            >
              <SelectTrigger id="tax-legal-form" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual / sole proprietor</SelectItem>
                <SelectItem value="entity">Company (PLC, share company)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tax-tin">TIN (optional)</Label>
            <Input
              id="tax-tin"
              placeholder="Taxpayer Identification Number"
              value={form.tinNumber ?? ''}
              onChange={(e) => setForm({ ...form, tinNumber: e.target.value })}
              maxLength={20}
            />
          </div>
        </div>
        <div className="space-y-3">
          {([
            ['vatRegistered', 'Registered for VAT', 'VAT-registered businesses are always Category A'],
            ['isProfessional', 'Professional service provider', 'Professionals are Category A regardless of turnover'],
            ['keepsBooks', 'Keeps full books of account', 'Book-keeping businesses follow Category A rules'],
            ['hasEmployees', 'Has employees on payroll', 'Adds monthly PAYE deadlines to your calendar'],
          ] as const).map(([key, label, hint]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label htmlFor={`tax-${key}`} className="cursor-pointer">{label}</Label>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
              <Switch
                id={`tax-${key}`}
                checked={form[key]}
                onCheckedChange={(checked) => setForm({ ...form, [key]: checked })}
              />
            </div>
          ))}
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save profile
        </Button>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main page
// ============================================

export function TaxAssistantPage() {
  const { currentOrg } = useAuthStore()
  const [summary, setSummary] = useState<TaxSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProfile, setShowProfile] = useState(false)

  const fetchSummary = useCallback(async () => {
    if (!currentOrg) return
    setError(null)
    try {
      const data = await api.getTaxSummary(currentOrg.id)
      setSummary(data)
      setShowProfile(!data.configured)
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [currentOrg])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  if (error || !summary) {
    return <ErrorState title="Failed to load tax data" message={error || 'Unknown error'} onRetry={fetchSummary} />
  }

  const { figures, estimate, threshold, deadlines, config, fiscalYear } = summary
  const thresholdCopy = THRESHOLD_COPY[threshold.level]
  const ytdTax = estimate.regime === 'B' ? estimate.ytd.tax : estimate.ytd.payable
  const projectedTax = estimate.regime === 'B' ? estimate.projected.tax : estimate.projected.payable

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        icon={<Calculator />}
        title="Tax Assistant"
        subtitle={`Estimates for fiscal year ${fiscalYear.label} under Proclamation 1395/2025.`}
        badges={
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Category {summary.category}
          </Badge>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => setShowProfile((s) => !s)}>
            {showProfile ? 'Hide profile' : 'Edit tax profile'}
          </Button>
        }
      />

      {/* Disclaimer — always visible, this is estimation, not advice */}
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
        <Info className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
        <p>{summary.disclaimer}</p>
      </div>

      {(showProfile || !summary.configured) && (
        <TaxProfileCard summary={summary} onSaved={() => { setShowProfile(false); setLoading(true); fetchSummary() }} />
      )}

      {/* Estimate KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          title="Estimated tax so far"
          value={formatETB(ytdTax)}
          subtitle={estimate.regime === 'B'
            ? `${pct(estimate.ytd.rate)} of gross sales`
            : estimate.ytd.matApplies ? 'Minimum Alternative Tax applies' : 'Based on estimated profit'}
          icon={<Calculator className="size-5" />}
          tone="brand"
        />
        <StatCard
          title="Projected year-end tax"
          value={formatETB(projectedTax)}
          subtitle="Linear projection of current pace"
          icon={<TrendingUp className="size-5" />}
        />
        <StatCard
          title="Gross sales (FY to date)"
          value={formatETB(figures.ytdGrossSales)}
          subtitle={`${formatNumber(figures.ytdSalesCount)} completed sales`}
          icon={<Scale className="size-5" />}
        />
        <StatCard
          title="12-month turnover"
          value={formatETB(figures.trailing12moTurnover)}
          subtitle={`${Math.round(threshold.ratio * 100)}% of the ${formatETB(config.categoryThresholdETB)} threshold`}
          icon={<AlertTriangle className="size-5" />}
          tone={threshold.level === 'ok' ? 'neutral' : threshold.level === 'exceeded' || threshold.level === 'critical' ? 'danger' : 'warning'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Threshold monitor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">VAT & Category A threshold</CardTitle>
            <CardDescription>
              Crossing {formatETB(config.categoryThresholdETB)} in 12 months requires VAT registration
              ({pct(config.vat.standardRate)}) and full books of account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={Math.min(100, threshold.ratio * 100)} aria-label="Turnover vs threshold" />
            <div className="flex items-center justify-between text-xs">
              <span className={thresholdCopy.className}>{thresholdCopy.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatETB(threshold.trailing12moTurnover)} / {formatETB(threshold.thresholdETB)}
              </span>
            </div>
            {estimate.regime === 'A' && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-xs space-y-1">
                <p className="font-medium">Minimum Alternative Tax check</p>
                <p className="text-muted-foreground">
                  Regular tax {formatETB(estimate.ytd.regularTax)} vs MAT ({pct(config.matRate)} of turnover){' '}
                  {formatETB(estimate.ytd.mat)} — you pay the higher:{' '}
                  <span className="font-semibold text-foreground">{formatETB(estimate.ytd.payable)}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Upcoming deadlines</CardTitle>
            <CardDescription>Ethiopian fiscal year: 8 July – 7 July (Hamle 1 – Sene 30)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {deadlines.slice(0, 6).map((d) => {
                const due = new Date(d.due)
                const daysLeft = Math.ceil((due.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
                return (
                  <div key={d.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{d.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium tabular-nums">{formatDate(d.due)}</p>
                      <p className={`text-xs ${daysLeft <= 14 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {daysLeft <= 0 ? 'Due now' : `in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rate reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How your tax is calculated</CardTitle>
          <CardDescription>
            {config.legalBasis.join(' · ')} — rates effective from {formatDate(config.effectiveFrom)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold mb-2">
              Category B — presumptive tax on annual gross sales
            </p>
            <div className="divide-y text-sm">
              {config.categoryBBands.map((band, i) => {
                const lower = i === 0 ? 0 : (config.categoryBBands[i - 1].upTo ?? 0) + 1
                const active = summary.category === 'B' &&
                  figures.ytdGrossSales >= lower &&
                  (band.upTo === null || figures.ytdGrossSales <= band.upTo)
                return (
                  <div key={i} className={`flex items-center justify-between py-1.5 ${active ? 'font-semibold text-primary' : ''}`}>
                    <span className="text-xs">
                      {formatETB(lower)} – {band.upTo === null ? '∞' : formatETB(band.upTo)}
                    </span>
                    <span className="tabular-nums">{pct(band.rate)}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="space-y-3 text-xs text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Category A:</span>{' '}
              companies pay a flat {pct(config.corporateRate)} on profit; individuals pay 0–35%
              progressive rates. A Minimum Alternative Tax of {pct(config.matRate)} of turnover
              applies when the computed tax is lower.
            </p>
            <p>
              <span className="font-semibold text-foreground">Withholding:</span>{' '}
              {pct(config.withholding.localRate)} is withheld on goods purchases above{' '}
              {formatETB(config.withholding.goodsThresholdETB)} and services above{' '}
              {formatETB(config.withholding.servicesThresholdETB)};{' '}
              {pct(config.withholding.noTinRate)} if the supplier has no TIN.
            </p>
            <p>
              <span className="font-semibold text-foreground">Cash limit:</span>{' '}
              cash payments above {formatETB(config.cashPaymentCapETB)} per transaction are
              prohibited — use bank transfer, cheque, or electronic payment.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { PageHeader } from '@/components/shared/design-system'

import { useState, useEffect, useCallback } from 'react'
import {
  Puzzle, Clock, CheckCircle2, XCircle, Zap,
  Palette, Link2, ShieldCheck, Eye, Tag, ShoppingCart,
  BarChart3, Loader2, Info, Mail, AlertTriangle,
  PlusCircle, RefreshCw, CalendarDays,
  ArrowRight, Send, Hourglass,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, type ModuleData } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getNetworkErrorMessage } from '@/lib/validation'
import { ErrorState } from '@/components/shared/error-states'
import { formatETB } from '@/lib/format'
import { FormSubmitButton } from '@/components/shared/form-fields'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

// ============================================
// Types
// ============================================
type ModuleStatus = 'active' | 'trial' | 'available' | 'expired' | 'requested'

interface EnrichedModule {
  id: string
  key: string
  name: string
  description: string
  icon: string
  category: string
  priceETB: number
  isFree: boolean
  freeTrialDays: number
  billingCycle: string
  order: number
  status: ModuleStatus
  orgStatus: ModuleData['orgStatus']
  requested: boolean
}

// ============================================
// Helpers
// ============================================

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const STATUS_CONFIG: Record<ModuleStatus, { label: string; color: string; icon: React.ReactNode }> = {
  active: {
    label: 'Active',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    icon: <CheckCircle2 className="size-3.5" />,
  },
  trial: {
    label: 'On Trial',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    icon: <Clock className="size-3.5" />,
  },
  requested: {
    label: 'Requested',
    color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
    icon: <Hourglass className="size-3.5" />,
  },
  available: {
    label: 'Available',
    color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    icon: <PlusCircle className="size-3.5" />,
  },
  expired: {
    label: 'Expired',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    icon: <XCircle className="size-3.5" />,
  },
}

const CATEGORY_COLORS: Record<string, string> = {
  core: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ai: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  integration: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  analytics: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  communication: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  reporting: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
}

const CARD_ACCENT: Record<string, Record<ModuleStatus, string>> = {
  core: { active: 'border-l-emerald-500', trial: 'border-l-amber-500', requested: 'border-l-violet-500', available: 'border-l-sky-500', expired: 'border-l-red-500' },
  ai: { active: 'border-l-emerald-500', trial: 'border-l-amber-500', requested: 'border-l-violet-500', available: 'border-l-sky-500', expired: 'border-l-red-500' },
  integration: { active: 'border-l-emerald-500', trial: 'border-l-amber-500', requested: 'border-l-violet-500', available: 'border-l-sky-500', expired: 'border-l-red-500' },
  analytics: { active: 'border-l-emerald-500', trial: 'border-l-amber-500', requested: 'border-l-violet-500', available: 'border-l-sky-500', expired: 'border-l-red-500' },
  communication: { active: 'border-l-emerald-500', trial: 'border-l-amber-500', requested: 'border-l-violet-500', available: 'border-l-sky-500', expired: 'border-l-red-500' },
  reporting: { active: 'border-l-emerald-500', trial: 'border-l-amber-500', requested: 'border-l-violet-500', available: 'border-l-sky-500', expired: 'border-l-red-500' },
}

const ICON_BG: Record<string, string> = {
  core: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
  ai: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600',
  integration: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600',
  analytics: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
  communication: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600',
  reporting: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600',
}

function getModuleIcon(iconName: string) {
  const iconMap: Record<string, React.ReactNode> = {
    'package': <ShoppingCart className="size-5" />,
    'bar-chart': <BarChart3 className="size-5" />,
    'brain': <Zap className="size-5" />,
    'puzzle': <Puzzle className="size-5" />,
    'palette': <Palette className="size-5" />,
    'link': <Link2 className="size-5" />,
    'shield': <ShieldCheck className="size-5" />,
    'eye': <Eye className="size-5" />,
    'tag': <Tag className="size-5" />,
    'clock': <Clock className="size-5" />,
  }
  return iconMap[iconName] || <Puzzle className="size-5" />
}

function getModuleStatus(m: ModuleData): ModuleStatus {
  if (!m.orgStatus) return 'available'
  if (m.orgStatus.status === 'active') return 'active'
  if (m.orgStatus.status === 'trial') return 'trial'
  if (m.orgStatus.status === 'requested') return 'requested'
  if (m.orgStatus.status === 'expired' || m.orgStatus.status === 'cancelled') return 'expired'
  // If orgStatus exists but status is unexpected, check isActive
  if (m.orgStatus.isActive) return 'active'
  return 'available'
}

// ============================================
// Module Card
// ============================================
function ModuleCard({
  mod,
  onRequestAccess,
  requestingKey,
  onActivate,
  activatingKey,
}: {
  mod: EnrichedModule
  onRequestAccess: (moduleKey: string) => void
  requestingKey: string | null
  onActivate: (moduleKey: string) => void
  activatingKey: string | null
}) {
  const statusConfig = STATUS_CONFIG[mod.status]
  const days = daysUntil(mod.orgStatus?.expiresAt ?? null)
  const isExpired = mod.status === 'expired'
  const isTrial = mod.status === 'trial'
  const isAvailable = mod.status === 'available'
  const isRequested = mod.status === 'requested' || mod.requested

  const cardAccent = CARD_ACCENT[mod.category]?.[mod.status] || 'border-l-gray-400'
  const opacityClass = isExpired ? 'opacity-75' : isAvailable ? 'opacity-90' : ''

  // Trial progress calculation
  const trialDays = mod.freeTrialDays || 30
  const trialProgress = isTrial && days !== null && days > 0
    ? Math.max(0, Math.min(100, ((trialDays - days) / trialDays) * 100))
    : isTrial ? 100 : 0

  // Urgency levels for trial
  const isCritical = isTrial && days !== null && days <= 3 && days > 0
  const isWarning = isTrial && days !== null && days <= 7 && days > 3

  return (
    <Card className={`border-l-4 ${cardAccent} transition-shadow hover:shadow-md ${opacityClass}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`size-11 rounded-lg flex items-center justify-center shrink-0 ${ICON_BG[mod.category] || 'bg-gray-100 text-gray-600'}`}>
            {getModuleIcon(mod.icon)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{mod.name}</h3>
              <Badge className={statusConfig.color} variant="outline">
                <span className="flex items-center gap-1">
                  {statusConfig.icon}
                  {isTrial && days !== null && days > 0 ? `${days}d left` : statusConfig.label}
                </span>
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{mod.key}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2">{mod.description || 'No description available'}</p>

        {/* Category & Price */}
        <div className="flex items-center justify-between flex-wrap gap-1.5">
          <Badge className={CATEGORY_COLORS[mod.category] || CATEGORY_COLORS.core} variant="outline">
            {mod.category}
          </Badge>
          {mod.isFree ? (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" variant="outline">
              Free
            </Badge>
          ) : (
            <span className="text-sm font-semibold">
              {formatETB(mod.priceETB, { decimals: 0 })}
              <span className="text-xs font-normal text-muted-foreground">/mo</span>
            </span>
          )}
        </div>

        {/* Requested status banner */}
        {isRequested && (
          <>
            <Separator />
            <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20">
              <Hourglass className="size-4 text-violet-600 shrink-0" />
              <div>
                <p className="text-xs font-medium text-violet-800 dark:text-violet-300">Request Pending</p>
                <p className="text-[11px] text-violet-700 dark:text-violet-400">Our team is reviewing your request. You&apos;ll be notified once approved.</p>
              </div>
            </div>
          </>
        )}

        {/* Trial countdown with progress bar */}
        {isTrial && (
          <>
            <Separator />
            {days !== null && days > 0 ? (
              <div className={`rounded-lg p-3 space-y-2 ${
                isCritical
                  ? 'bg-red-50 dark:bg-red-900/20 animate-pulse'
                  : isWarning
                    ? 'bg-amber-50 dark:bg-amber-900/20 animate-pulse'
                    : 'bg-amber-50 dark:bg-amber-900/20'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className={`size-4 shrink-0 ${
                      isCritical ? 'text-red-600' : 'text-amber-600'
                    }`} />
                    <p className={`text-xs font-medium ${
                      isCritical ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
                    }`}>
                      Trial Period
                    </p>
                  </div>
                  <span className={`text-xs font-bold ${
                    isCritical ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-400'
                  }`}>
                    {days} day{days !== 1 ? 's' : ''} left
                  </span>
                </div>
                <Progress
                  value={100 - trialProgress}
                  className={`h-2 ${
                    isCritical
                      ? '[&>[data-slot=progress-indicator]]:bg-red-500'
                      : isWarning
                        ? '[&>[data-slot=progress-indicator]]:bg-amber-500'
                        : '[&>[data-slot=progress-indicator]]:bg-amber-400'
                  }`}
                />
                {mod.orgStatus?.expiresAt && (
                  <p className={`text-[11px] ${
                    isCritical ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
                  }`}>
                    Expires {new Date(mod.orgStatus.expiresAt).toLocaleDateString()}
                  </p>
                )}
                {(isCritical || isWarning) && (
                  <p className={`text-[11px] font-medium ${
                    isCritical ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'
                  }`}>
                    {isCritical
                      ? 'Trial ending very soon — contact us to continue!'
                      : 'Trial ending soon — consider upgrading'}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                <AlertTriangle className="size-4 text-red-600 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-800 dark:text-red-300">Trial Expired</p>
                  <p className="text-[11px] text-red-700 dark:text-red-400">Contact support to renew your subscription</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Active module info */}
        {mod.status === 'active' && (
          <>
            <Separator />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3 text-emerald-600" /> Active
              </span>
              {mod.orgStatus?.autoRenew && (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" variant="outline">
                  Auto-renew
                </Badge>
              )}
            </div>
          </>
        )}

        {/* Expired module info */}
        {isExpired && (
          <>
            <Separator />
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
              <XCircle className="size-4 text-red-600 shrink-0" />
              <div>
                <p className="text-xs font-medium text-red-800 dark:text-red-300">Module Expired</p>
                <p className="text-[11px] text-red-700 dark:text-red-400">Contact support@invensync.com to renew</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
              onClick={() => onRequestAccess(mod.key)}
              disabled={requestingKey === mod.key}
            >
              {requestingKey === mod.key ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {requestingKey === mod.key ? 'Requesting...' : 'Request Renewal'}
            </Button>
          </>
        )}

        {/* Action buttons for available modules */}
        {isAvailable && !isRequested && (
          <>
            <Separator />
            {mod.isFree ? (
              <Button
                size="sm"
                className="w-full gap-1.5"
                disabled={activatingKey === mod.key}
                onClick={() => onActivate(mod.key)}
              >
                {activatingKey === mod.key ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                {activatingKey === mod.key ? 'Activating...' : 'Activate Free'}
              </Button>
            ) : (
              <Button
                size="sm"
                className="w-full gap-1.5"
                disabled={requestingKey === mod.key}
                onClick={() => onRequestAccess(mod.key)}
              >
                {requestingKey === mod.key ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                {requestingKey === mod.key ? 'Requesting...' : 'Request Access'}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Request Confirmation Dialog
// ============================================
function RequestDialog({
  open,
  onOpenChange,
  module: mod,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  module: EnrichedModule | null
  onSuccess: () => void
}) {
  const { currentOrg } = useAuthStore()
  const [loading, setLoading] = useState(false)

  if (!mod || !currentOrg) return null

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await api.requestModule(currentOrg.id, mod.key)
      toast.success(`Request for ${mod.name} submitted! Our team will review it shortly.`)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-5 text-primary" />
            Request {mod.name}
          </DialogTitle>
          <DialogDescription>
            {mod.description || `Request access to the ${mod.name} module for your organization.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Module info */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Module</span>
              <Badge className={CATEGORY_COLORS[mod.category] || CATEGORY_COLORS.core} variant="outline">
                {mod.category}
              </Badge>
            </div>
            <p className="text-sm font-medium">{mod.name}</p>
            {!mod.isFree && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span className="font-semibold">{formatETB(mod.priceETB, { decimals: 0 })}/mo</span>
              </div>
            )}
            {mod.isFree && (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" variant="outline">
                Free — No payment required
              </Badge>
            )}
          </div>

          {/* Beta notice */}
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
            <div className="flex items-start gap-2">
              <Info className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Free during Beta</p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  All modules are currently free while InvenSync is in beta. Request access and we&apos;ll activate it for you right away.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <FormSubmitButton
            isLoading={loading}
            loadingText="Submitting..."
            onClick={handleSubmit}
            className="w-full gap-1.5"
          >
            <Send className="size-4" />
            Submit Request
          </FormSubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Stat Card
// ============================================
function StatCard({
  count,
  label,
  colorClass,
  bgColor,
  borderColor,
  active,
  onClick,
}: {
  count: number
  label: string
  colorClass: string
  bgColor: string
  borderColor: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border text-center transition-colors ${
        active ? `${bgColor} ${borderColor}` : 'bg-card hover:bg-muted/30'
      }`}
    >
      <p className={`text-lg font-semibold ${colorClass}`}>{count}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </button>
  )
}

// ============================================
// Modules Page
// ============================================
export function ModulesPage() {
  const { currentOrg } = useAuthStore()
  const [modules, setModules] = useState<EnrichedModule[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | ModuleStatus>('all')
  const [requestingKey, setRequestingKey] = useState<string | null>(null)
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [selectedModule, setSelectedModule] = useState<EnrichedModule | null>(null)
  const [activatingKey, setActivatingKey] = useState<string | null>(null)

  const fetchModules = useCallback(async () => {
    if (!currentOrg) return
    try {
      setFetchError(null)
      const data = await api.getModules(currentOrg.id)
      const enriched: EnrichedModule[] = data.modules.map((m: ModuleData) => ({
        id: m.id,
        key: m.key,
        name: m.name,
        description: m.description,
        icon: m.icon,
        category: m.category,
        priceETB: m.priceETB,
        isFree: m.isFree ?? m.priceETB === 0,
        freeTrialDays: m.freeTrialDays || 30,
        billingCycle: m.billingCycle || 'monthly',
        order: m.order,
        status: getModuleStatus(m),
        orgStatus: m.orgStatus,
        requested: m.orgStatus?.status === 'requested',
      }))
      setModules(enriched)
    } catch (err) {
      setFetchError(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [currentOrg])

  useEffect(() => { fetchModules() }, [fetchModules])

  const handleRequestAccess = async (moduleKey: string) => {
    if (!currentOrg) return
    setRequestingKey(moduleKey)
    try {
      await api.requestModule(currentOrg.id, moduleKey)
      toast.success('Request submitted! Our team will review it shortly.')
      // Update local state to show "requested" status immediately
      setModules(prev =>
        prev.map(m =>
          m.key === moduleKey ? { ...m, requested: true, status: 'requested' as ModuleStatus } : m
        )
      )
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setRequestingKey(null)
    }
  }

  const handleActivate = async (moduleKey: string) => {
    if (!currentOrg) return
    setActivatingKey(moduleKey)
    try {
      await api.activateModule(currentOrg.id, moduleKey)
      toast.success('Module activated successfully!')
      fetchModules()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setActivatingKey(null)
    }
  }

  const handleOpenRequestDialog = (mod: EnrichedModule) => {
    setSelectedModule(mod)
    setRequestDialogOpen(true)
  }

  const filteredModules = modules.filter(m => {
    if (filter === 'all') return true
    return m.status === filter
  })

  const activeCount = modules.filter(m => m.status === 'active').length
  const trialCount = modules.filter(m => m.status === 'trial').length
  const requestedCount = modules.filter(m => m.status === 'requested').length
  const availableCount = modules.filter(m => m.status === 'available').length
  const expiredCount = modules.filter(m => m.status === 'expired').length

  // Expiry warning data
  const expiringModules = modules.filter(m => {
    const days = daysUntil(m.orgStatus?.expiresAt ?? null)
    return days !== null && days <= 7
  })
  const criticalModules = expiringModules.filter(m => {
    const days = daysUntil(m.orgStatus?.expiresAt ?? null)
    return days !== null && (days <= 1 || days <= 0)
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    )
  }

  if (fetchError) {
    return <ErrorState title="Failed to load modules" error={fetchError} onRetry={fetchModules} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<Puzzle />}
        title="My Modules"
        subtitle="Explore, request, and manage your InvenSync modules"
      />

      {/* Expiry Warning Banner */}
      {expiringModules.length > 0 && (
        <Alert className={
          criticalModules.length > 0
            ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
            : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
        }>
          <AlertTriangle className={
            criticalModules.length > 0
              ? 'size-4 text-red-600'
              : 'size-4 text-amber-600'
          } />
          <AlertTitle className={
            criticalModules.length > 0
              ? 'text-sm font-medium text-red-800 dark:text-red-300'
              : 'text-sm font-medium text-amber-800 dark:text-amber-300'
          }>
            {criticalModules.length > 0
              ? 'Modules expiring or expired!'
              : 'Modules expiring soon'}
          </AlertTitle>
          <AlertDescription className={
            criticalModules.length > 0
              ? 'text-xs text-red-700 dark:text-red-400'
              : 'text-xs text-amber-700 dark:text-amber-400'
          }>
            {expiringModules.map(m => {
              const days = daysUntil(m.orgStatus?.expiresAt ?? null)
              const label = days !== null && days <= 0
                ? `${m.name} (expired)`
                : days !== null
                  ? `${m.name} (${days}d left)`
                  : m.name
              return label
            }).join(', ')}
            {' — '}
            <button
              onClick={() => {
                const section = document.getElementById('modules-grid')
                section?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="underline font-medium"
            >
              View modules
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Beta Info Alert */}
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="size-4 text-primary" />
        <AlertTitle className="text-sm font-medium">Free During Beta</AlertTitle>
        <AlertDescription className="text-xs">
          All modules are currently free while InvenSync is in beta. Request access to any module and our team will activate it for you.
        </AlertDescription>
      </Alert>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard
          count={activeCount}
          label="Active"
          colorClass="text-emerald-600"
          bgColor="bg-emerald-50 dark:bg-emerald-900/20"
          borderColor="border-emerald-200 dark:border-emerald-800"
          active={filter === 'active'}
          onClick={() => setFilter(filter === 'active' ? 'all' : 'active')}
        />
        <StatCard
          count={trialCount}
          label="On Trial"
          colorClass="text-amber-600"
          bgColor="bg-amber-50 dark:bg-amber-900/20"
          borderColor="border-amber-200 dark:border-amber-800"
          active={filter === 'trial'}
          onClick={() => setFilter(filter === 'trial' ? 'all' : 'trial')}
        />
        <StatCard
          count={requestedCount}
          label="Requested"
          colorClass="text-violet-600"
          bgColor="bg-violet-50 dark:bg-violet-900/20"
          borderColor="border-violet-200 dark:border-violet-800"
          active={filter === 'requested'}
          onClick={() => setFilter(filter === 'requested' ? 'all' : 'requested')}
        />
        <StatCard
          count={availableCount}
          label="Available"
          colorClass="text-sky-600"
          bgColor="bg-sky-50 dark:bg-sky-900/20"
          borderColor="border-sky-200 dark:border-sky-800"
          active={filter === 'available'}
          onClick={() => setFilter(filter === 'available' ? 'all' : 'available')}
        />
        <StatCard
          count={expiredCount}
          label="Expired"
          colorClass="text-red-600"
          bgColor="bg-red-50 dark:bg-red-900/20"
          borderColor="border-red-200 dark:border-red-800"
          active={filter === 'expired'}
          onClick={() => setFilter(filter === 'expired' ? 'all' : 'expired')}
        />
      </div>

      {/* Filter indicator */}
      {filter !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Showing:</span>
          <Badge variant="outline" className="capitalize">{STATUS_CONFIG[filter].label}</Badge>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setFilter('all')}>
            Show all
          </Button>
        </div>
      )}

      {/* Module Grid */}
      {filteredModules.length === 0 ? (
        <div className="text-center py-12">
          <Puzzle className="size-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No modules found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filter !== 'all' ? `No ${STATUS_CONFIG[filter].label.toLowerCase()} modules. Try a different filter.` : 'No modules are available yet.'}
          </p>
        </div>
      ) : (
        <div id="modules-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModules.map(mod => (
            <ModuleCard
              key={mod.id}
              mod={mod}
              onRequestAccess={(key) => {
                const mod = modules.find(m => m.key === key)
                if (mod && !mod.isFree) {
                  handleOpenRequestDialog(mod)
                } else {
                  handleRequestAccess(key)
                }
              }}
              requestingKey={requestingKey}
              onActivate={handleActivate}
              activatingKey={activatingKey}
            />
          ))}
        </div>
      )}

      {/* Request Dialog */}
      <RequestDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        module={selectedModule}
        onSuccess={() => {
          fetchModules()
        }}
      />

      {/* Contact CTA */}
      {(expiredCount > 0 || trialCount > 0 || requestedCount > 0) && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Need help with modules?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Contact our support team at{' '}
                <a href="mailto:support@invensync.com" className="text-primary underline font-medium">
                  support@invensync.com
                </a>{' '}
                for activation, renewal, or any questions.
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
              <a href="mailto:support@invensync.com">
                <Mail className="size-3.5" /> Contact Support
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Building2,
  TrendingUp,
  Clock,
  Wallet,
  Target,
  Trophy,
  Calendar,
  CheckCircle2,
  RefreshCw,
  MapPin,
  Store,
  Plus,
  Copy,
  UserPlus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/stores/auth-store'
import { LocationPicker } from '@/components/app/shared/location-picker'
import { getNetworkErrorMessage } from '@/lib/validation'
import { registerBusinessSchema, type RegisterBusinessFormData } from '@/lib/validations'
import { ErrorState } from '@/components/shared/error-states'
import { formatETB, formatDate } from '@/lib/format'
import { Form } from '@/components/ui/form'
import { FormInputField, FormSelectField, FormSubmitButton } from '@/components/shared/form-fields'

// ============================================
// Types — matches actual API response shape
// ============================================

interface DashboardStats {
  totalRegistrations: number
  currentMonthRegistrations: number
  commissions: {
    total: number
    pending: number
    paid: number
  }
}

interface GoalData {
  id: string
  period: string
  targetCount: number
  achievedCount: number
  progressPercentage: number
  bonusAmount: number
  isAchieved: boolean
  remaining: number
}

interface RecentRegistration {
  id: string
  name: string
  city: string | null
  businessType: string
  subscriptionPlan: string
  subscriptionStatus: string
  createdAt: string
}

interface RecentCommission {
  id: string
  organizationId: string
  amount: number
  status: string
  paidAt: string | null
  createdAt: string
  organization: { id: string; name: string; city: string | null }
}

interface SalesRepInfo {
  id: string
  phone: string | null
  targetCity: string | null
  commissionRate: number
  commissionPerReg: number
  isActive: boolean
  joinedAt: string
}

interface DashboardResponse {
  salesRep: SalesRepInfo
  user: { id: string; name: string; email: string }
  stats: DashboardStats
  currentGoal: GoalData | null
  recentRegistrations: RecentRegistration[]
  recentCommissions: RecentCommission[]
}

// ============================================
// Helpers
// ============================================

function getRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getCurrentDateString(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function businessTypeBadgeClass(type: string): string {
  switch (type) {
    case 'retail':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
    case 'service':
      return 'bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800'
    case 'mixed':
      return 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
    default:
      return ''
  }
}

function commissionStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
          Pending
        </Badge>
      )
    case 'paid':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
          Paid
        </Badge>
      )
    case 'cancelled':
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
          Cancelled
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// ============================================
// Stat Card
// ============================================

interface StatCardProps {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  iconBgClass: string
  iconTextClass: string
}

function StatCard({ title, value, subtitle, icon, iconBgClass, iconTextClass }: StatCardProps) {
  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row items-center justify-between pb-0">
        <CardDescription className="text-xs sm:text-sm font-medium truncate">{title}</CardDescription>
        <div className={`flex items-center justify-center size-8 sm:size-10 rounded-lg ${iconBgClass} shrink-0`}>
          <div className={iconTextClass}>{icon}</div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-base sm:text-lg font-semibold tracking-tight truncate">{value}</div>
        <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

function StatCardSkeleton() {
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
// Circular Progress Indicator
// ============================================

function CircularProgress({
  percentage,
  size = 120,
  strokeWidth = 10,
  isAchieved,
}: {
  percentage: number
  size?: number
  strokeWidth?: number
  isAchieved?: boolean
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference
  const center = size / 2

  const color = isAchieved ? '#10b981' : '#ea580c'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base sm:text-lg font-semibold" style={{ color }}>
          {percentage}%
        </span>
        <span className="text-[10px] text-muted-foreground">complete</span>
      </div>
    </div>
  )
}

// ============================================
// Loading Skeleton
// ============================================

function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Goal card skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Skeleton className="size-[120px] rounded-full" />
            <div className="flex-1 space-y-3 w-full">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent registrations skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// Register Business Dialog
// ============================================

function RegisterBusinessDialog({
  open,
  onOpenChange,
  onSuccess,
  salesRepId: _salesRepId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  salesRepId: string
}) {
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<RegisterBusinessFormData>({
    resolver: zodResolver(registerBusinessSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      organizationName: '',
      businessType: '',
      city: '',
      phone: '',
      address: '',
      latitude: null,
      longitude: null,
    },
  })

  const handleSubmit = async (data: RegisterBusinessFormData) => {
    setSubmitting(true)
    try {
      const token = localStorage.getItem('sb_token')
      const response = await fetch('/api/sales-rep/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          organizationName: data.organizationName,
          businessType: data.businessType || undefined,
          address: data.address || undefined,
          city: data.city || undefined,
          phone: data.phone || undefined,
          latitude: data.latitude || undefined,
          longitude: data.longitude || undefined,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to register business')
      }

      toast.success(`Successfully registered ${data.organizationName}! Commission earned.`)
      form.reset()
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDialogOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Register New Business
          </DialogTitle>
          <DialogDescription>
            Register a new business on behalf of the customer. This will be linked to your account.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormInputField<RegisterBusinessFormData>
                name="name"
                label="Customer Name"
                placeholder="Full name"
                required
                disabled={submitting}
              />
              <FormInputField<RegisterBusinessFormData>
                name="email"
                label="Email"
                type="email"
                placeholder="email@example.com"
                required
                disabled={submitting}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormInputField<RegisterBusinessFormData>
                name="password"
                label="Password"
                type="password"
                placeholder="Min 8 chars: uppercase, lowercase, digit, special"
                required
                disabled={submitting}
              />
              <FormInputField<RegisterBusinessFormData>
                name="organizationName"
                label="Business Name"
                placeholder="Shop name"
                required
                disabled={submitting}
              />
            </div>
            <FormSelectField<RegisterBusinessFormData>
              name="businessType"
              label="Business Type"
              placeholder="Select type"
              options={[
                { value: 'retail', label: 'Retail Shop' },
                { value: 'service', label: 'Service Provider' },
                { value: 'mixed', label: 'Mixed (Retail + Service)' },
              ]}
              disabled={submitting}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormInputField<RegisterBusinessFormData>
                name="city"
                label="City"
                placeholder="e.g. Addis Ababa"
                disabled={submitting}
              />
              <FormInputField<RegisterBusinessFormData>
                name="phone"
                label="Phone"
                placeholder="e.g. +251..."
                disabled={submitting}
              />
            </div>
            <FormInputField<RegisterBusinessFormData>
              name="address"
              label="Address"
              placeholder="Street address"
              disabled={submitting}
            />
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="size-4" />
                Location
                <span className="text-xs font-normal text-muted-foreground">(auto-detected)</span>
              </Label>
              <LocationPicker
                latitude={form.watch('latitude')}
                longitude={form.watch('longitude')}
                onChange={(lat, lng) => {
                  form.setValue('latitude', lat)
                  form.setValue('longitude', lng)
                }}
              />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground">
                The business will be automatically linked to your sales account. A commission will be credited once registered.
              </p>
            </div>
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={submitting}>Cancel</Button>
          <FormSubmitButton
            isLoading={submitting}
            loadingText="Registering..."
            onClick={form.handleSubmit(handleSubmit)}
          >
            Register Business
          </FormSubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Main Component
// ============================================

export function SalesRepDashboardPage() {
  const { user, logout } = useAuthStore()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [copiedReferral, setCopiedReferral] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('sb_token')
      if (!token) {
        setError('Not authenticated. Please log in again.')
        setLoading(false)
        return
      }

      const response = await fetch('/api/sales-rep/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 401) {
        setError('Your session has expired. Please log in again.')
        setLoading(false)
        // Clear token and trigger logout for expired session
        localStorage.removeItem('sb_token')
        if (logout) {
          setTimeout(() => logout(), 1500)
        }
        return
      }

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load dashboard data')
      }

      setData(result)
      setError(null)
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [logout])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    fetchData()
  }, [fetchData])

  // ========================================
  // Loading state
  // ========================================
  if (loading) {
    return <DashboardLoadingSkeleton />
  }

  // ========================================
  // Error state — use shared ErrorState component
  // ========================================
  if (error && !data) {
    return (
      <ErrorState
        title="Failed to load dashboard"
        message={error}
        onRetry={handleRefresh}
      />
    )
  }

  if (!data) return null

  const { stats, currentGoal, recentRegistrations, recentCommissions } = data
  const repName = data.user?.name || user?.name || 'Rep'

  return (
    <div className="space-y-6">
      {/* ================================================
          Section 1: Welcome Header
          ================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight">
            Welcome back, {repName}!
          </h1>
          <p className="text-muted-foreground text-sm">Your sales performance at a glance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            className="gap-1.5"
            onClick={() => setRegisterDialogOpen(true)}
          >
            <Plus className="size-4" />
            Register Business
          </Button>
          {/* Referral Code */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-muted/30 text-sm">
            <span className="text-muted-foreground text-xs">Referral Code:</span>
            <code className="font-mono font-semibold text-primary">{data.salesRep?.id?.slice(0, 12) || '—'}</code>
            <button
              className="ml-1 text-muted-foreground hover:text-primary transition-colors"
              onClick={() => {
                const code = data.salesRep?.id?.slice(0, 12) || ''
                navigator.clipboard.writeText(code)
                setCopiedReferral(true)
                toast.success('Referral code copied!')
                setTimeout(() => setCopiedReferral(false), 2000)
              }}
              title="Copy referral code"
            >
              <Copy className={`size-3.5 ${copiedReferral ? 'text-primary' : ''}`} />
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="size-4" />
            <span className="hidden sm:inline">{getCurrentDateString()}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`size-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Register Business Dialog */}
      <RegisterBusinessDialog
        open={registerDialogOpen}
        onOpenChange={setRegisterDialogOpen}
        onSuccess={handleRefresh}
        salesRepId={data.salesRep?.id || ''}
      />

      {/* ================================================
          Section 2: Stats Cards
          ================================================ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          title="Total Registrations"
          value={stats.totalRegistrations.toLocaleString()}
          subtitle="All time organizations registered"
          icon={<Building2 className="size-5" />}
          iconBgClass="bg-brand-50 dark:bg-brand-900/20"
          iconTextClass="text-primary"
        />
        <StatCard
          title="This Month"
          value={stats.currentMonthRegistrations.toLocaleString()}
          subtitle="Registrations this month"
          icon={<TrendingUp className="size-5" />}
          iconBgClass="bg-emerald-100 dark:bg-emerald-900/30"
          iconTextClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          title="Pending Commissions"
          value={formatETB(stats.commissions.pending, { decimals: 0 })}
          subtitle="Awaiting payment"
          icon={<Clock className="size-5" />}
          iconBgClass="bg-amber-100 dark:bg-amber-900/30"
          iconTextClass="text-amber-600 dark:text-amber-400"
        />
        <StatCard
          title="Total Earned"
          value={formatETB(stats.commissions.paid, { decimals: 0 })}
          subtitle="Paid commissions"
          icon={<Wallet className="size-5" />}
          iconBgClass="bg-violet-100 dark:bg-violet-900/30"
          iconTextClass="text-violet-600 dark:text-violet-400"
        />
      </div>

      {/* ================================================
          Section 3: Monthly Goal Progress
          ================================================ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-lg bg-brand-50 dark:bg-brand-900/20">
              <Target className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Monthly Goal Progress</CardTitle>
              <CardDescription>
                {currentGoal
                  ? `Target for ${currentGoal.period}`
                  : 'No goal set for this month'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentGoal ? (
            <>
              {/* Goal achieved celebration banner */}
              {currentGoal.isAchieved && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                      <Trophy className="size-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                        Goal Achieved!
                      </p>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">
                        Congratulations! You&apos;ve met your monthly target and earned a bonus of {formatETB(currentGoal.bonusAmount, { decimals: 0 })}
                      </p>
                    </div>
                    <CheckCircle2 className="size-6 text-emerald-500 shrink-0 ml-auto" />
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Circular progress */}
                <CircularProgress
                  percentage={currentGoal.progressPercentage}
                  isAchieved={currentGoal.isAchieved}
                />

                {/* Goal details */}
                <div className="flex-1 w-full space-y-4">
                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium">Progress</span>
                      <span className="text-sm text-muted-foreground">
                        {currentGoal.achievedCount} / {currentGoal.targetCount} shops
                      </span>
                    </div>
                    <Progress
                      value={currentGoal.progressPercentage}
                      className="h-3"
                    />
                  </div>

                  {/* Goal metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Target</p>
                      <p className="text-base font-semibold">{currentGoal.targetCount} shops</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Achieved</p>
                      <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">{currentGoal.achievedCount} shops</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Remaining</p>
                      <p className="text-base font-semibold">{currentGoal.remaining} shops</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Bonus</p>
                      <p className="text-base font-semibold text-primary">{formatETB(currentGoal.bonusAmount, { decimals: 0 })}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Target className="size-10 mb-3 opacity-50" />
              <p className="text-sm font-medium">No monthly goal set</p>
              <p className="text-xs mt-1">Contact your manager to set a target</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================
          Section 4: Recent Registrations
          ================================================ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Building2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-base">Recent Registrations</CardTitle>
              <CardDescription>Last {recentRegistrations.length} organizations you registered</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {recentRegistrations.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 text-xs font-medium text-muted-foreground">Business</th>
                      <th className="pb-2 text-xs font-medium text-muted-foreground">City</th>
                      <th className="pb-2 text-xs font-medium text-muted-foreground">Type</th>
                      <th className="pb-2 text-xs font-medium text-muted-foreground">Registered</th>
                      <th className="pb-2 text-xs font-medium text-muted-foreground">Plan</th>
                      <th className="pb-2 text-xs font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRegistrations.map((org) => (
                      <tr key={org.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Store className="size-4 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-medium truncate max-w-[200px]">{org.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="size-3" />
                            {org.city || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge className={businessTypeBadgeClass(org.businessType)} variant="outline">
                            {org.businessType}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-sm text-muted-foreground" title={formatDate(org.createdAt)}>
                            {getRelativeTime(org.createdAt)}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className="text-xs capitalize">
                            {org.subscriptionPlan}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Badge
                            className={
                              org.subscriptionStatus === 'active'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                                : org.subscriptionStatus === 'trial'
                                  ? 'bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800'
                                  : 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                            }
                          >
                            {org.subscriptionStatus}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                {recentRegistrations.map((org) => (
                  <div
                    key={org.id}
                    className="p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{org.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="size-3" />
                          {org.city || 'N/A'}
                        </p>
                      </div>
                      <Badge className={businessTypeBadgeClass(org.businessType)} variant="outline">
                        {org.businessType}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground" title={formatDate(org.createdAt)}>
                        {getRelativeTime(org.createdAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize py-0">
                          {org.subscriptionPlan}
                        </Badge>
                        <Badge
                          className={
                            org.subscriptionStatus === 'active'
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] py-0 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                              : org.subscriptionStatus === 'trial'
                                ? 'bg-sky-100 text-sky-700 border-sky-200 text-[10px] py-0 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800'
                                : 'bg-amber-100 text-amber-700 border-amber-200 text-[10px] py-0 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                          }
                        >
                          {org.subscriptionStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Building2 className="size-10 mb-2 opacity-50" />
              <p className="text-sm">No registrations yet</p>
              <p className="text-xs mt-1">Start referring businesses to see them here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================
          Section 5: Commission History
          ================================================ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <Wallet className="size-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-base">Commission History</CardTitle>
              <CardDescription>Recent commission payouts and statuses</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {recentCommissions.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
              {recentCommissions.map((commission) => (
                <div
                  key={commission.id}
                  className="flex items-center justify-between py-2.5 px-3 -mx-1 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {commission.organization.name}
                      </p>
                      {commission.status === 'paid' && (
                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {commission.paidAt
                        ? `Paid on ${formatDate(commission.paidAt)}`
                        : getRelativeTime(commission.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-sm font-semibold">{formatETB(commission.amount, { decimals: 0 })}</span>
                    {commissionStatusBadge(commission.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Wallet className="size-10 mb-2 opacity-50" />
              <p className="text-sm">No commissions yet</p>
              <p className="text-xs mt-1">Commissions will appear here as you register businesses</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

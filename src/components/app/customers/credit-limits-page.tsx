'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CreditCard, Search, Eye, Pencil, Lock, Unlock, AlertTriangle,
  Loader2, ChevronLeft, ChevronRight, DollarSign, ShieldAlert,
} from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth-store'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { ErrorState, EmptyState } from '@/components/shared/error-states'

// ============================================
// Types
// ============================================

interface CreditLimitData {
  id: string
  customerId: string
  creditLimit: number
  usedCredit: number
  availableCredit: number
  alertThreshold: number
  isBlocked: boolean
  createdAt: string
  updatedAt: string
  customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
  }
}

interface CreditSummary {
  totalCreditExtended: number
  totalUsed: number
  totalAvailable: number
  blockedAccounts: number
}

// ============================================
// Helpers
// ============================================

import { formatETB } from '@/lib/format'

function getUsagePercentage(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(Math.round((used / limit) * 100), 100)
}

function getUsageColor(percentage: number): string {
  if (percentage > 80) return 'text-red-600'
  if (percentage >= 60) return 'text-yellow-600'
  return 'text-emerald-600'
}

function getUsageBarClass(percentage: number): string {
  if (percentage > 80) return '[&_[data-slot=progress-indicator]]:bg-red-500'
  if (percentage >= 60) return '[&_[data-slot=progress-indicator]]:bg-yellow-500'
  return '[&_[data-slot=progress-indicator]]:bg-emerald-500'
}

function isAlertTriggered(used: number, limit: number, threshold: number): boolean {
  if (limit <= 0) return false
  return (used / limit) > threshold
}

// ============================================
// Main Component
// ============================================

export function CreditLimitsPage() {
  const { currentOrg } = useAuthStore()
  const orgId = currentOrg?.id || ''

  const [creditLimits, setCreditLimits] = useState<CreditLimitData[]>([])
  const [summary, setSummary] = useState<CreditSummary>({
    totalCreditExtended: 0,
    totalUsed: 0,
    totalAvailable: 0,
    blockedAccounts: 0,
  })
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  // Set/Edit dialog
  const [showSetLimit, setShowSetLimit] = useState(false)
  const [editLimit, setEditLimit] = useState<CreditLimitData | null>(null)
  const [limitAmount, setLimitAmount] = useState('')
  const [alertThreshold, setAlertThreshold] = useState('80')
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Block toggle
  const [togglingBlock, setTogglingBlock] = useState<string | null>(null)

  // ============================================
  // Fetch
  // ============================================
  const fetchCreditLimits = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setPageError(null)
    try {
      const searchParams = new URLSearchParams({ organizationId: orgId, page: page.toString(), limit: limit.toString() })
      if (searchQuery) searchParams.set('search', searchQuery)
      const data = await api.get<{
        creditLimits: CreditLimitData[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
        summary: CreditSummary
      }>(`/api/credit-limits?${searchParams.toString()}`)
      setCreditLimits(data.creditLimits)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
      setSummary(data.summary)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load credit limits'
      setPageError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [orgId, searchQuery, page])

  useEffect(() => {
    fetchCreditLimits()
  }, [fetchCreditLimits])

  useEffect(() => {
    setPage(1)
  }, [searchQuery])

  // ============================================
  // Handlers
  // ============================================

  const openSetLimit = (creditLimit?: CreditLimitData) => {
    if (creditLimit) {
      setEditLimit(creditLimit)
      setLimitAmount(creditLimit.creditLimit.toString())
      setAlertThreshold(Math.round(creditLimit.alertThreshold * 100).toString())
    } else {
      setEditLimit(null)
      setLimitAmount('')
      setAlertThreshold('80')
    }
    setShowSetLimit(true)
  }

  const handleSaveLimit = async () => {
    if (!orgId) return
    const amount = parseFloat(limitAmount)
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid credit limit amount')
      return
    }
    const threshold = parseFloat(alertThreshold)
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      toast.error('Alert threshold must be between 0 and 100')
      return
    }

    setFormSubmitting(true)
    try {
      if (editLimit) {
        // Update existing
        await api.put(`/api/credit-limits/${editLimit.id}`, {
          organizationId: orgId,
          creditLimit: amount,
          alertThreshold: threshold / 100,
        })
        toast.success('Credit limit updated successfully')
      } else {
        // Need to select a customer — this path is for the "add new" flow
        // For simplicity, the set dialog will always edit from the list
        toast.error('Please select a customer to set credit limit')
      }
      setShowSetLimit(false)
      fetchCreditLimits()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save credit limit')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleToggleBlock = async (creditLimit: CreditLimitData) => {
    if (!orgId) return
    setTogglingBlock(creditLimit.id)
    try {
      await api.put(`/api/credit-limits/${creditLimit.id}`, {
        organizationId: orgId,
        isBlocked: !creditLimit.isBlocked,
      })
      toast.success(creditLimit.isBlocked ? 'Credit unblocked successfully' : 'Credit blocked successfully')
      fetchCreditLimits()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle block')
    } finally {
      setTogglingBlock(null)
    }
  }

  // ============================================
  // Render
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Credit Limits</h1>
          <p className="text-muted-foreground text-sm">Manage customer credit limits, usage tracking, and alerts</p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Extended</p>
                <p className="text-xl sm:text-2xl font-bold">{formatETB(summary.totalCreditExtended)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <DollarSign className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Used</p>
                <p className="text-xl sm:text-2xl font-bold">{formatETB(summary.totalUsed)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <DollarSign className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Available</p>
                <p className="text-xl sm:text-2xl font-bold">{formatETB(summary.totalAvailable)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <ShieldAlert className="size-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Blocked Accounts</p>
                <p className="text-xl sm:text-2xl font-bold">{summary.blockedAccounts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by customer name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {pageError ? (
        <ErrorState title="Failed to load credit limits" message={pageError} onRetry={fetchCreditLimits} />
      ) : loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-2 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : creditLimits.length === 0 ? (
        <EmptyState
          title="No credit limits found"
          message={searchQuery ? 'Try adjusting your search query' : 'Credit limits will appear here when set for customers'}
          icon={<CreditCard className="size-7 text-muted-foreground" />}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Credit Limit</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditLimits.map((cl) => {
                    const usagePct = getUsagePercentage(cl.usedCredit, cl.creditLimit)
                    const alertTriggered = isAlertTriggered(cl.usedCredit, cl.creditLimit, cl.alertThreshold)
                    return (
                      <TableRow key={cl.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{cl.customer.name}</p>
                            {cl.customer.phone && (
                              <p className="text-xs text-muted-foreground">{cl.customer.phone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatETB(cl.creditLimit)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={getUsageColor(usagePct)}>
                            {formatETB(cl.usedCredit)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatETB(cl.availableCredit)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress
                              value={usagePct}
                              className={`h-2 flex-1 ${getUsageBarClass(usagePct)}`}
                            />
                            <span className={`text-xs font-medium w-9 text-right ${getUsageColor(usagePct)}`}>
                              {usagePct}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {cl.isBlocked && (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <Lock className="size-3" />
                                Blocked
                              </Badge>
                            )}
                            {alertTriggered && !cl.isBlocked && (
                              <Badge variant="outline" className="text-xs gap-1 border-yellow-300 text-yellow-600 bg-yellow-50">
                                <AlertTriangle className="size-3" />
                                Alert
                              </Badge>
                            )}
                            {!cl.isBlocked && !alertTriggered && (
                              <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-600 bg-emerald-50">
                                Active
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openSetLimit(cl)}
                              title="Edit credit limit"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              disabled={togglingBlock === cl.id}
                              onClick={() => handleToggleBlock(cl)}
                              title={cl.isBlocked ? 'Unblock credit' : 'Block credit'}
                            >
                              {togglingBlock === cl.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : cl.isBlocked ? (
                                <Unlock className="size-4 text-emerald-600" />
                              ) : (
                                <Lock className="size-4 text-red-600" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile/Tablet Cards */}
          <div className="lg:hidden space-y-3">
            {creditLimits.map((cl) => {
              const usagePct = getUsagePercentage(cl.usedCredit, cl.creditLimit)
              const alertTriggered = isAlertTriggered(cl.usedCredit, cl.creditLimit, cl.alertThreshold)
              return (
                <Card key={cl.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium truncate">{cl.customer.name}</p>
                          {cl.isBlocked && (
                            <Badge variant="destructive" className="text-xs gap-0.5 shrink-0">
                              <Lock className="size-3" />
                              Blocked
                            </Badge>
                          )}
                        </div>
                        {cl.customer.phone && (
                          <p className="text-xs text-muted-foreground">{cl.customer.phone}</p>
                        )}
                      </div>
                      {alertTriggered && !cl.isBlocked && (
                        <Badge variant="outline" className="text-xs gap-0.5 border-yellow-300 text-yellow-600 bg-yellow-50 shrink-0 ml-2">
                          <AlertTriangle className="size-3" />
                          Alert
                        </Badge>
                      )}
                    </div>

                    {/* Usage Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">
                          {formatETB(cl.usedCredit)} of {formatETB(cl.creditLimit)}
                        </span>
                        <span className={`text-xs font-medium ${getUsageColor(usagePct)}`}>{usagePct}%</span>
                      </div>
                      <Progress
                        value={usagePct}
                        className={`h-2 ${getUsageBarClass(usagePct)}`}
                      />
                    </div>

                    {/* Amounts Grid */}
                    <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Limit</p>
                        <p className="text-sm font-medium">{formatETB(cl.creditLimit)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Used</p>
                        <p className={`text-sm font-medium ${getUsageColor(usagePct)}`}>{formatETB(cl.usedCredit)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Available</p>
                        <p className="text-sm font-medium text-emerald-600">{formatETB(cl.availableCredit)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1 flex-1"
                        onClick={() => openSetLimit(cl)}
                      >
                        <Pencil className="size-3.5" />
                        Edit Limit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-8 text-xs gap-1 ${cl.isBlocked ? 'text-emerald-600' : 'text-red-600'}`}
                        disabled={togglingBlock === cl.id}
                        onClick={() => handleToggleBlock(cl)}
                      >
                        {togglingBlock === cl.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : cl.isBlocked ? (
                          <Unlock className="size-3.5" />
                        ) : (
                          <Lock className="size-3.5" />
                        )}
                        {cl.isBlocked ? 'Unblock' : 'Block'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({total} accounts)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================ */}
      {/* Set/Edit Credit Limit Dialog */}
      {/* ============================================ */}
      <Dialog open={showSetLimit} onOpenChange={setShowSetLimit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5" />
              {editLimit ? 'Edit Credit Limit' : 'Set Credit Limit'}
            </DialogTitle>
            <DialogDescription>
              {editLimit && `For ${editLimit.customer.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {editLimit && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Current Limit</p>
                    <p className="font-medium">{formatETB(editLimit.creditLimit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Used</p>
                    <p className="font-medium">{formatETB(editLimit.usedCredit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className="font-medium text-emerald-600">{formatETB(editLimit.availableCredit)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Credit Limit (ETB)</Label>
              <Input
                type="number"
                min={0}
                step={100}
                placeholder="e.g. 10000"
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Maximum credit allowed for this customer in ETB</p>
            </div>

            <div className="space-y-2">
              <Label>Alert Threshold (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                placeholder="e.g. 80"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                An alert will show when credit usage exceeds this percentage (0-100%)
              </p>
            </div>

            {editLimit?.isBlocked && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800 p-3 flex items-center gap-2">
                <AlertTriangle className="size-4 text-orange-600" />
                <p className="text-sm text-orange-700 dark:text-orange-400">
                  This account is currently blocked. You can unblock it from the credit limits list.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetLimit(false)} disabled={formSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveLimit}
              disabled={formSubmitting || !limitAmount}
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Credit Limit'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

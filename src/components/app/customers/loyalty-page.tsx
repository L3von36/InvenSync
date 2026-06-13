'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Award, Search, Eye, Plus, Minus, Star, Shield, Crown, Gem,
  Loader2, ArrowUpDown, ChevronLeft, ChevronRight, Info,
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { formatDate, formatDateTime } from '@/lib/format'

// ============================================
// Types
// ============================================

interface LoyaltyAccount {
  id: string
  customerId: string
  points: number
  totalEarned: number
  totalRedeemed: number
  tier: string
  createdAt: string
  updatedAt: string
  customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
  }
}

interface LoyaltyTransaction {
  id: string
  loyaltyAccountId: string
  type: string // earn, redeem, expire, adjust
  points: number
  saleId: string | null
  description: string | null
  expiresAt: string | null
  createdAt: string
}

// ============================================
// Helpers
// ============================================

const TIER_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; minPoints: number; bgClass: string }> = {
  bronze: {
    label: 'Bronze',
    color: 'text-amber-700',
    bgClass: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: <Shield className="size-3.5" />,
    minPoints: 0,
  },
  silver: {
    label: 'Silver',
    color: 'text-gray-600',
    bgClass: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: <Star className="size-3.5" />,
    minPoints: 500,
  },
  gold: {
    label: 'Gold',
    color: 'text-yellow-600',
    bgClass: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: <Crown className="size-3.5" />,
    minPoints: 2000,
  },
  platinum: {
    label: 'Platinum',
    color: 'text-purple-600',
    bgClass: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: <Gem className="size-3.5" />,
    minPoints: 5000,
  },
}

function TierBadge({ tier }: { tier: string }) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.bronze
  return (
    <Badge variant="outline" className={`gap-1 ${config.bgClass}`}>
      {config.icon}
      {config.label}
    </Badge>
  )
}

const TRANSACTION_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  earn: { label: 'Earned', color: 'text-emerald-600' },
  redeem: { label: 'Redeemed', color: 'text-red-600' },
  expire: { label: 'Expired', color: 'text-gray-500' },
  adjust: { label: 'Adjusted', color: 'text-blue-600' },
}

// ============================================
// Main Component
// ============================================

export function LoyaltyPage() {
  const { currentOrg } = useAuthStore()
  const orgId = currentOrg?.id || ''

  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  // Detail dialog
  const [showDetail, setShowDetail] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<LoyaltyAccount | null>(null)
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Adjust dialog
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustAccount, setAdjustAccount] = useState<LoyaltyAccount | null>(null)
  const [adjustAction, setAdjustAction] = useState<'add' | 'deduct'>('add')
  const [adjustPoints, setAdjustPoints] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  // ============================================
  // Fetch
  // ============================================
  const fetchAccounts = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setPageError(null)
    try {
      const searchParams = new URLSearchParams({ organizationId: orgId, page: page.toString(), limit: limit.toString() })
      if (searchQuery) searchParams.set('search', searchQuery)
      const data = await api.request<{ accounts: LoyaltyAccount[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        `/api/loyalty?${searchParams.toString()}`
      )
      setAccounts(data.accounts)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load loyalty accounts'
      setPageError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [orgId, searchQuery, page])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    setPage(1)
  }, [searchQuery])

  // ============================================
  // Handlers
  // ============================================
  const openDetail = async (account: LoyaltyAccount) => {
    setSelectedAccount(account)
    setShowDetail(true)
    setDetailLoading(true)
    try {
      const data = await api.request<{ account: LoyaltyAccount & { transactions: LoyaltyTransaction[] } }>(
        `/api/loyalty/${account.id}?organizationId=${orgId}`
      )
      setTransactions(data.account.transactions || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load details')
    } finally {
      setDetailLoading(false)
    }
  }

  const openAdjust = (account: LoyaltyAccount, action: 'add' | 'deduct') => {
    setAdjustAccount(account)
    setAdjustAction(action)
    setAdjustPoints('')
    setAdjustReason('')
    setShowAdjust(true)
  }

  const handleAdjust = async () => {
    if (!adjustAccount || !orgId) return
    const points = parseInt(adjustPoints)
    if (!points || points <= 0) {
      toast.error('Please enter a valid positive number of points')
      return
    }
    if (!adjustReason.trim()) {
      toast.error('Please provide a reason for the adjustment')
      return
    }

    setAdjusting(true)
    try {
      await api.request(`/api/loyalty/${adjustAccount.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          organizationId: orgId,
          action: adjustAction,
          points,
          reason: adjustReason.trim(),
        }),
      })
      toast.success(`Successfully ${adjustAction === 'add' ? 'added' : 'deducted'} ${points} points`)
      setShowAdjust(false)
      fetchAccounts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to adjust points')
    } finally {
      setAdjusting(false)
    }
  }

  // ============================================
  // Render
  // ============================================

  // Stats
  const totalPoints = accounts.reduce((sum, a) => sum + a.points, 0)
  const totalEarned = accounts.reduce((sum, a) => sum + a.totalEarned, 0)
  const totalRedeemed = accounts.reduce((sum, a) => sum + a.totalRedeemed, 0)
  const tierCounts = {
    bronze: accounts.filter(a => a.tier === 'bronze').length,
    silver: accounts.filter(a => a.tier === 'silver').length,
    gold: accounts.filter(a => a.tier === 'gold').length,
    platinum: accounts.filter(a => a.tier === 'platinum').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Customer Loyalty</h1>
          <p className="text-muted-foreground text-sm">Manage loyalty accounts, tiers, and points adjustments</p>
        </div>
      </div>

      {/* Tier Thresholds */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Award className="size-4" />
            Tier Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(TIER_CONFIG).map(([key, config]) => (
              <div key={key} className="flex items-center gap-2 rounded-lg border p-3">
                <div className={`size-8 rounded-md flex items-center justify-center ${config.bgClass}`}>
                  {config.icon}
                </div>
                <div>
                  <p className="text-sm font-medium">{config.label}</p>
                  <p className="text-xs text-muted-foreground">{config.minPoints}+ points</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Award className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Accounts</p>
                <p className="text-xl sm:text-2xl font-bold">{total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Plus className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="text-xl sm:text-2xl font-bold">{totalEarned.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Minus className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Redeemed</p>
                <p className="text-xl sm:text-2xl font-bold">{totalRedeemed.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Gem className="size-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Points</p>
                <p className="text-xl sm:text-2xl font-bold">{totalPoints.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Distribution */}
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(TIER_CONFIG).map(([key, config]) => (
          <div key={key} className={`rounded-lg border p-3 text-center ${config.bgClass}`}>
            <p className="text-xl sm:text-2xl font-bold">{tierCounts[key as keyof typeof tierCounts]}</p>
            <p className="text-xs">{config.label}</p>
          </div>
        ))}
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
        <ErrorState title="Failed to load loyalty accounts" message={pageError} onRetry={fetchAccounts} />
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
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : accounts.length === 0 ? (
        <EmptyState
          title="No loyalty accounts found"
          message={searchQuery ? 'Try adjusting your search query' : 'Loyalty accounts will be created when customers earn points from purchases'}
          icon={<Award className="size-7 text-muted-foreground" />}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Total Earned</TableHead>
                    <TableHead className="text-right">Total Redeemed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{account.customer.name}</p>
                          {account.customer.phone && (
                            <p className="text-xs text-muted-foreground">{account.customer.phone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <TierBadge tier={account.tier} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {account.points.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        +{account.totalEarned.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        -{account.totalRedeemed.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => openDetail(account)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-emerald-600"
                            onClick={() => openAdjust(account, 'add')}
                          >
                            <Plus className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-red-600"
                            onClick={() => openAdjust(account, 'deduct')}
                          >
                            <Minus className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {accounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{account.customer.name}</p>
                        <TierBadge tier={account.tier} />
                      </div>
                      {account.customer.phone && (
                        <p className="text-xs text-muted-foreground">{account.customer.phone}</p>
                      )}
                    </div>
                    <p className="text-sm font-bold ml-2">{account.points.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs">
                    <span className="text-emerald-600">+{account.totalEarned.toLocaleString()} earned</span>
                    <span className="text-red-600">-{account.totalRedeemed.toLocaleString()} redeemed</span>
                  </div>
                  <div className="flex items-center gap-1 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => openDetail(account)}
                    >
                      <Eye className="size-3.5" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1 text-emerald-600"
                      onClick={() => openAdjust(account, 'add')}
                    >
                      <Plus className="size-3.5" />
                      Add
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1 text-red-600"
                      onClick={() => openAdjust(account, 'deduct')}
                    >
                      <Minus className="size-3.5" />
                      Deduct
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
      {/* Detail Dialog */}
      {/* ============================================ */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="size-5" />
              Loyalty Account Details
            </DialogTitle>
            <DialogDescription>
              View transaction history and account details
            </DialogDescription>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {selectedAccount.customer.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{selectedAccount.customer.name}</p>
                  {selectedAccount.customer.phone && (
                    <p className="text-xs text-muted-foreground">{selectedAccount.customer.phone}</p>
                  )}
                </div>
                <TierBadge tier={selectedAccount.tier} />
              </div>

              {/* Points Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold">{selectedAccount.points.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Current Points</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-emerald-600">+{selectedAccount.totalEarned.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Earned</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xl sm:text-2xl font-bold text-red-600">-{selectedAccount.totalRedeemed.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Redeemed</p>
                </div>
              </div>

              {/* Next Tier Info */}
              {selectedAccount.tier !== 'platinum' && (
                <div className="rounded-lg border border-dashed p-3 flex items-center gap-2">
                  <Info className="size-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">
                      {(() => {
                        const tiers = ['bronze', 'silver', 'gold', 'platinum']
                        const currentIndex = tiers.indexOf(selectedAccount.tier)
                        const nextTier = tiers[currentIndex + 1]
                        const nextConfig = TIER_CONFIG[nextTier]
                        const pointsNeeded = nextConfig.minPoints - selectedAccount.points
                        return pointsNeeded > 0 ? `${pointsNeeded.toLocaleString()} more points to ${nextConfig.label}` : `Ready for ${nextConfig.label}!`
                      })()}
                    </span>
                  </p>
                </div>
              )}

              <Separator />

              {/* Transaction History */}
              <div>
                <h3 className="text-sm font-medium mb-3">Transaction History</h3>
                {detailLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No transactions yet</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {transactions.map((tx) => {
                      const typeInfo = TRANSACTION_TYPE_LABELS[tx.type] || { label: tx.type, color: 'text-gray-500' }
                      return (
                        <div key={tx.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs shrink-0">
                                {typeInfo.label}
                              </Badge>
                              <span className={`font-medium ${typeInfo.color}`}>
                                {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString()}
                              </span>
                            </div>
                            {tx.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{tx.description}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground ml-2 shrink-0">
                            {formatDateTime(tx.createdAt)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* Adjust Points Dialog */}
      {/* ============================================ */}
      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {adjustAction === 'add' ? (
                <Plus className="size-5 text-emerald-600" />
              ) : (
                <Minus className="size-5 text-red-600" />
              )}
              {adjustAction === 'add' ? 'Add Points' : 'Deduct Points'}
            </DialogTitle>
            <DialogDescription>
              {adjustAccount && `For ${adjustAccount.customer.name} (Current: ${adjustAccount.points.toLocaleString()} pts)`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Points to {adjustAction === 'add' ? 'Add' : 'Deduct'}</Label>
              <Input
                type="number"
                min={1}
                placeholder="Enter points"
                value={adjustPoints}
                onChange={(e) => setAdjustPoints(e.target.value)}
              />
              {adjustAction === 'deduct' && adjustAccount && (
                <p className="text-xs text-muted-foreground">
                  Available: {adjustAccount.points.toLocaleString()} points
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Reason *</Label>
              <Textarea
                placeholder={`Reason for ${adjustAction === 'add' ? 'adding' : 'deducting'} points...`}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjust(false)} disabled={adjusting}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={adjusting || !adjustPoints || !adjustReason.trim()}
              variant={adjustAction === 'deduct' ? 'destructive' : 'default'}
            >
              {adjusting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {adjustAction === 'add' ? <Plus className="size-4" /> : <Minus className="size-4" />}
                  {adjustAction === 'add' ? 'Add Points' : 'Deduct Points'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

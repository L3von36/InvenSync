'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeftRight, Plus, Filter, CheckCircle, XCircle,
  Truck, CheckCheck, Loader2,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { getNetworkErrorMessage } from '@/lib/validation'
import { ErrorState, EmptyState } from '@/components/shared/error-states'

// ============================================
// Types
// ============================================

interface StockTransferItem {
  id: string
  organizationId: string
  fromShopId: string
  toShopId: string
  productId: string
  quantity: number
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  product: { id: string; name: string; sku: string | null }
  fromShop: { id: string; name: string }
  toShop: { id: string; name: string }
}

// ============================================
// Status Badge
// ============================================

function TransferStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    in_transit: { label: 'In Transit', className: 'bg-purple-100 text-purple-800 border-purple-200' },
    completed: { label: 'Completed', className: 'bg-green-100 text-green-800 border-green-200' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800 border-red-200' },
  }
  const c = config[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-200' }
  return (
    <Badge variant="outline" className={c.className}>
      {c.label}
    </Badge>
  )
}

// ============================================
// StockTransfersPage
// ============================================

export function StockTransfersPage() {
  const { currentOrg, shops } = useAuthStore()
  const orgId = currentOrg?.id || ''

  const [transfers, setTransfers] = useState<StockTransferItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form fields
  const [formProductId, setFormProductId] = useState('')
  const [formFromShopId, setFormFromShopId] = useState('')
  const [formToShopId, setFormToShopId] = useState('')
  const [formQuantity, setFormQuantity] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Products for dropdown
  const [products, setProducts] = useState<Array<{ id: string; name: string; sku: string | null }>>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ----------------------------------------
  // Fetch transfers
  // ----------------------------------------
  const fetchTransfers = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      setFetchError(null)
      const data = await api.getStockTransfers(orgId, {
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      setTransfers(data.transfers || [])
    } catch (err) {
      setFetchError(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [orgId, statusFilter])

  // ----------------------------------------
  // Fetch products for form
  // ----------------------------------------
  const fetchProducts = useCallback(async () => {
    if (!orgId) return
    setLoadingProducts(true)
    try {
      const data = await api.getProducts(orgId, { limit: 200 })
      setProducts(data.products.map(p => ({ id: p.id, name: p.name, sku: p.sku || null })))
    } catch {
      // silently fail
    } finally {
      setLoadingProducts(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchTransfers()
  }, [fetchTransfers])

  useEffect(() => {
    if (showCreateDialog) {
      fetchProducts()
    }
  }, [showCreateDialog, fetchProducts])

  // ----------------------------------------
  // Create transfer
  // ----------------------------------------
  const handleCreate = async () => {
    if (!formProductId || !formFromShopId || !formToShopId || !formQuantity) {
      toast.error('Please fill in all required fields')
      return
    }
    if (formFromShopId === formToShopId) {
      toast.error('Source and destination shops must be different')
      return
    }
    const qty = parseInt(formQuantity, 10)
    if (isNaN(qty) || qty < 1) {
      toast.error('Quantity must be a positive number')
      return
    }

    setCreating(true)
    try {
      await api.createStockTransfer(orgId, {
        productId: formProductId,
        fromShopId: formFromShopId,
        toShopId: formToShopId,
        quantity: qty,
        notes: formNotes || undefined,
      })

      toast.success('Stock transfer created successfully')
      setShowCreateDialog(false)
      resetForm()
      fetchTransfers()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setFormProductId('')
    setFormFromShopId('')
    setFormToShopId('')
    setFormQuantity('')
    setFormNotes('')
  }

  // ----------------------------------------
  // Action handlers
  // ----------------------------------------
  const handleAction = async (transferId: string, action: string) => {
    setActionLoading(transferId)
    try {
      await api.updateStockTransfer(transferId, orgId, { action })

      const actionLabels: Record<string, string> = {
        approve: 'approved',
        cancel: 'cancelled',
        complete: 'completed',
      }
      toast.success(`Transfer ${actionLabels[action] || action} successfully`)
      fetchTransfers()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setActionLoading(null)
    }
  }

  // ----------------------------------------
  // Format date
  // ----------------------------------------
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // ----------------------------------------
  // Render loading skeleton
  // ----------------------------------------
  const renderSkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )

  // ----------------------------------------
  // Render
  // ----------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="size-6" />
            Stock Transfers
          </h1>
          <p className="text-muted-foreground mt-1">
            Transfer stock between your shops and branches
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="size-4" />
          New Transfer
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Filter className="size-4 text-muted-foreground" />
            <Label className="text-sm font-medium whitespace-nowrap">Status:</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transfers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transfer History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">{renderSkeleton()}</div>
          ) : fetchError ? (
            <div className="p-6">
              <ErrorState error={fetchError} onRetry={fetchTransfers} />
            </div>
          ) : transfers.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No stock transfers"
                message="Create your first stock transfer to move inventory between shops."
                icon={<ArrowLeftRight className="size-7 text-muted-foreground" />}
                action={{
                  label: 'Create Transfer',
                  onClick: () => setShowCreateDialog(true),
                }}
              />
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map(transfer => (
                      <TableRow key={transfer.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(transfer.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{transfer.product.name}</div>
                          {transfer.product.sku && (
                            <div className="text-xs text-muted-foreground">{transfer.product.sku}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{transfer.fromShop.name}</TableCell>
                        <TableCell className="text-sm">{transfer.toShop.name}</TableCell>
                        <TableCell className="font-medium">{transfer.quantity}</TableCell>
                        <TableCell>
                          <TransferStatusBadge status={transfer.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {transfer.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 text-blue-600 hover:text-blue-700"
                                  disabled={actionLoading === transfer.id}
                                  onClick={() => handleAction(transfer.id, 'approve')}
                                >
                                  {actionLoading === transfer.id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <CheckCircle className="size-3" />
                                  )}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 text-red-600 hover:text-red-700"
                                  disabled={actionLoading === transfer.id}
                                  onClick={() => handleAction(transfer.id, 'cancel')}
                                >
                                  <XCircle className="size-3" />
                                  Cancel
                                </Button>
                              </>
                            )}
                            {(transfer.status === 'approved' || transfer.status === 'in_transit') && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 text-green-600 hover:text-green-700"
                                  disabled={actionLoading === transfer.id}
                                  onClick={() => handleAction(transfer.id, 'complete')}
                                >
                                  {actionLoading === transfer.id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <CheckCheck className="size-3" />
                                  )}
                                  Complete
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 text-red-600 hover:text-red-700"
                                  disabled={actionLoading === transfer.id}
                                  onClick={() => handleAction(transfer.id, 'cancel')}
                                >
                                  <XCircle className="size-3" />
                                  Cancel
                                </Button>
                              </>
                            )}
                            {transfer.status === 'completed' && (
                              <span className="text-xs text-muted-foreground">Done</span>
                            )}
                            {transfer.status === 'cancelled' && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y">
                {transfers.map(transfer => (
                  <div key={transfer.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{transfer.product.name}</div>
                      <TransferStatusBadge status={transfer.status} />
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">{transfer.fromShop.name}</span>
                        <ArrowLeftRight className="size-3" />
                        <span className="font-medium text-foreground">{transfer.toShop.name}</span>
                      </div>
                      <div>Qty: {transfer.quantity} &middot; {formatDate(transfer.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-1 pt-1">
                      {transfer.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-blue-600 hover:text-blue-700 text-xs"
                            disabled={actionLoading === transfer.id}
                            onClick={() => handleAction(transfer.id, 'approve')}
                          >
                            <CheckCircle className="size-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-red-600 hover:text-red-700 text-xs"
                            disabled={actionLoading === transfer.id}
                            onClick={() => handleAction(transfer.id, 'cancel')}
                          >
                            <XCircle className="size-3" />
                            Cancel
                          </Button>
                        </>
                      )}
                      {(transfer.status === 'approved' || transfer.status === 'in_transit') && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-green-600 hover:text-green-700 text-xs"
                            disabled={actionLoading === transfer.id}
                            onClick={() => handleAction(transfer.id, 'complete')}
                          >
                            <CheckCheck className="size-3" />
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-red-600 hover:text-red-700 text-xs"
                            disabled={actionLoading === transfer.id}
                            onClick={() => handleAction(transfer.id, 'cancel')}
                          >
                            <XCircle className="size-3" />
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Transfer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        if (!open) resetForm()
        setShowCreateDialog(open)
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Stock Transfer</DialogTitle>
            <DialogDescription>
              Transfer stock from one shop to another.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Product */}
            <div className="space-y-2">
              <Label>Product <span className="text-destructive">*</span></Label>
              <Select value={formProductId} onValueChange={setFormProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {loadingProducts ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      Loading products...
                    </div>
                  ) : products.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No products found
                    </div>
                  ) : (
                    products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.sku ? ` (${p.sku})` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* From Shop */}
            <div className="space-y-2">
              <Label>From Shop <span className="text-destructive">*</span></Label>
              <Select value={formFromShopId} onValueChange={setFormFromShopId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source shop" />
                </SelectTrigger>
                <SelectContent>
                  {shops.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* To Shop */}
            <div className="space-y-2">
              <Label>To Shop <span className="text-destructive">*</span></Label>
              <Select value={formToShopId} onValueChange={setFormToShopId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination shop" />
                </SelectTrigger>
                <SelectContent>
                  {shops
                    .filter(s => s.id !== formFromShopId)
                    .map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label>Quantity <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="1"
                placeholder="Enter quantity"
                value={formQuantity}
                onChange={(e) => setFormQuantity(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes about this transfer"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm() }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating && <Loader2 className="size-4 animate-spin" />}
              Create Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

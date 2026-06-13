'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart, Plus, Filter, Send, CheckCircle, Package,
  XCircle, Loader2, Trash2, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { formatDate, formatETB } from '@/lib/format'

// ============================================
// Types
// ============================================

interface PurchaseOrderItemData {
  id: string
  purchaseOrderId: string
  productId: string
  quantity: number
  unitCost: number
  totalCost: number
  receivedQty: number
  createdAt: string
  product: { id: string; name: string; sku: string | null }
}

interface PurchaseOrderData {
  id: string
  organizationId: string
  shopId: string | null
  supplierId: string | null
  status: string
  totalAmount: number
  notes: string | null
  orderDate: string
  expectedDate: string | null
  createdAt: string
  updatedAt: string
  supplier: { id: string; name: string; phone: string | null } | null
  shop: { id: string; name: string } | null
  items: PurchaseOrderItemData[]
}

interface LowStockProduct {
  id: string
  name: string
  sku: string | null
  quantity: number
  lowStockThreshold: number
  costPrice: number
  productType: { id: string; name: string }
}

// ============================================
// Status Badge
// ============================================

function POStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-800 border-gray-200' },
    sent: { label: 'Sent', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    confirmed: { label: 'Confirmed', className: 'bg-purple-100 text-purple-800 border-purple-200' },
    received: { label: 'Received', className: 'bg-green-100 text-green-800 border-green-200' },
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
// PurchaseOrdersPage
// ============================================

export function PurchaseOrdersPage() {
  const { currentOrg, shops } = useAuthStore()
  const orgId = currentOrg?.id || ''

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderData[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form fields
  const [formSupplierId, setFormSupplierId] = useState('')
  const [formShopId, setFormShopId] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formExpectedDate, setFormExpectedDate] = useState('')
  const [formItems, setFormItems] = useState<Array<{
    productId: string
    quantity: string
    unitCost: string
  }>>([{ productId: '', quantity: '', unitCost: '' }])

  // Detail/Receive dialog
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderData | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [receiveMode, setReceiveMode] = useState(false)
  const [receivedItems, setReceivedItems] = useState<Record<string, string>>({})
  const [receiving, setReceiving] = useState(false)

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Products and suppliers for dropdowns
  const [products, setProducts] = useState<Array<{ id: string; name: string; sku: string | null; costPrice: number }>>([])
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([])
  const [showLowStockSuggestions, setShowLowStockSuggestions] = useState(false)
  const [loadingDropdowns, setLoadingDropdowns] = useState(false)

  // ----------------------------------------
  // Fetch purchase orders
  // ----------------------------------------
  const fetchPurchaseOrders = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      setFetchError(null)
      const data = await api.getPurchaseOrders(orgId, {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        lowStockOnly: 'true',
      })
      setPurchaseOrders((data.purchaseOrders || []) as unknown as PurchaseOrderData[])
      setLowStockProducts((data.lowStockProducts || []) as unknown as LowStockProduct[])
    } catch (err) {
      setFetchError(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [orgId, statusFilter])

  // ----------------------------------------
  // Fetch dropdown data
  // ----------------------------------------
  const fetchDropdownData = useCallback(async () => {
    if (!orgId) return
    setLoadingDropdowns(true)
    try {
      const [productsData, suppliersData] = await Promise.all([
        api.getProducts(orgId, { limit: 200 }),
        api.getSuppliers(orgId, { limit: 200 }),
      ])
      setProducts(productsData.products.map(p => ({
        id: p.id, name: p.name, sku: p.sku || null, costPrice: p.costPrice,
      })))
      setSuppliers(suppliersData.suppliers.map(s => ({ id: s.id, name: s.name })))
    } catch {
      // silently fail
    } finally {
      setLoadingDropdowns(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchPurchaseOrders()
  }, [fetchPurchaseOrders])

  useEffect(() => {
    if (showCreateDialog) {
      fetchDropdownData()
    }
  }, [showCreateDialog, fetchDropdownData])

  // ----------------------------------------
  // Form item helpers
  // ----------------------------------------
  const addFormItem = () => {
    setFormItems([...formItems, { productId: '', quantity: '', unitCost: '' }])
  }

  const removeFormItem = (index: number) => {
    if (formItems.length <= 1) return
    setFormItems(formItems.filter((_, i) => i !== index))
  }

  const updateFormItem = (index: number, field: 'productId' | 'quantity' | 'unitCost', value: string) => {
    const updated = [...formItems]
    updated[index] = { ...updated[index], [field]: value }
    // Auto-fill unitCost when product is selected
    if (field === 'productId') {
      const product = products.find(p => p.id === value)
      if (product && !updated[index].unitCost) {
        updated[index].unitCost = product.costPrice.toString()
      }
    }
    setFormItems(updated)
  }

  const addLowStockToForm = (product: LowStockProduct) => {
    const existingIndex = formItems.findIndex(item => item.productId === product.id)
    if (existingIndex >= 0) {
      toast.info(`${product.name} is already in the order`)
      return
    }
    const suggestedQty = Math.max(product.lowStockThreshold - product.quantity, 1)
    setFormItems([...formItems, {
      productId: product.id,
      quantity: suggestedQty.toString(),
      unitCost: product.costPrice.toString(),
    }])
    toast.success(`Added ${product.name} to order`)
  }

  // ----------------------------------------
  // Create PO
  // ----------------------------------------
  const handleCreate = async () => {
    const validItems = formItems.filter(item => item.productId && item.quantity && item.unitCost)
    if (validItems.length === 0) {
      toast.error('Please add at least one line item')
      return
    }
    for (const item of validItems) {
      const qty = parseInt(item.quantity, 10)
      const cost = parseFloat(item.unitCost)
      if (isNaN(qty) || qty < 1) {
        toast.error('Quantity must be at least 1 for all items')
        return
      }
      if (isNaN(cost) || cost < 0) {
        toast.error('Unit cost must be a valid number for all items')
        return
      }
    }

    setCreating(true)
    try {
      await api.createPurchaseOrder(orgId, {
        supplierId: formSupplierId || null,
        shopId: formShopId || null,
        notes: formNotes || undefined,
        expectedDate: formExpectedDate || null,
        items: validItems.map(item => ({
          productId: item.productId,
          quantity: parseInt(item.quantity, 10),
          unitCost: parseFloat(item.unitCost),
        })),
      })

      toast.success('Purchase order created successfully')
      setShowCreateDialog(false)
      resetForm()
      fetchPurchaseOrders()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setFormSupplierId('')
    setFormShopId('')
    setFormNotes('')
    setFormExpectedDate('')
    setFormItems([{ productId: '', quantity: '', unitCost: '' }])
    setShowLowStockSuggestions(false)
  }

  // ----------------------------------------
  // Action handlers (send, confirm, cancel)
  // ----------------------------------------
  const handleAction = async (poId: string, action: string) => {
    setActionLoading(poId)
    try {
      const data = await api.updatePurchaseOrder(poId, orgId, { action })

      const actionLabels: Record<string, string> = {
        send: 'sent',
        confirm: 'confirmed',
        cancel: 'cancelled',
      }
      toast.success(`Purchase order ${actionLabels[action] || action} successfully`)
      fetchPurchaseOrders()
      // Refresh detail if open
      if (selectedPO?.id === poId) {
        setSelectedPO(data.purchaseOrder as unknown as PurchaseOrderData)
      }
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setActionLoading(null)
    }
  }

  // ----------------------------------------
  // View PO detail
  // ----------------------------------------
  const handleViewDetail = async (poId: string) => {
    setLoadingDetail(true)
    setReceiveMode(false)
    setReceivedItems({})
    try {
      const data = await api.getPurchaseOrder(poId, orgId)
      setSelectedPO(data.purchaseOrder as unknown as PurchaseOrderData)
      setShowDetailDialog(true)
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setLoadingDetail(false)
    }
  }

  // ----------------------------------------
  // Receive goods
  // ----------------------------------------
  const handleReceive = async () => {
    if (!selectedPO) return

    setReceiving(true)
    try {
      const parsedItems = selectedPO.items.map(item => ({
        itemId: item.id,
        receivedQty: parseInt(receivedItems[item.id] ?? item.quantity.toString(), 10),
      }))

      const data = await api.updatePurchaseOrder(selectedPO.id, orgId, {
        action: 'receive',
        receivedItems: parsedItems,
      })

      toast.success('Goods received successfully')
      setSelectedPO(data.purchaseOrder as unknown as PurchaseOrderData)
      setReceiveMode(false)
      setReceivedItems({})
      fetchPurchaseOrders()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setReceiving(false)
    }
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
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )

  // ----------------------------------------
  // Calculate total for create form
  // ----------------------------------------
  const formTotal = formItems.reduce((sum, item) => {
    const qty = parseInt(item.quantity, 10) || 0
    const cost = parseFloat(item.unitCost) || 0
    return sum + (qty * cost)
  }, 0)

  // ----------------------------------------
  // Render
  // ----------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="size-6" />
            Purchase Orders
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage purchase orders and track incoming stock
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="size-4" />
          New Purchase Order
        </Button>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-yellow-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-yellow-800">
                  {lowStockProducts.length} product{lowStockProducts.length > 1 ? 's' : ''} below low stock threshold
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Consider creating a purchase order to restock these items.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">{renderSkeleton()}</div>
          ) : fetchError ? (
            <div className="p-6">
              <ErrorState message={fetchError} onRetry={fetchPurchaseOrders} />
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No purchase orders"
                message="Create your first purchase order to track incoming stock from suppliers."
                icon={<ShoppingCart className="size-7 text-muted-foreground" />}
                action={{
                  label: 'Create Order',
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
                      <TableHead>Order Date</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.map(po => (
                      <TableRow key={po.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(po.orderDate)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {po.supplier?.name || 'No supplier'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {po.items.length} item{po.items.length > 1 ? 's' : ''}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatETB(po.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <POStatusBadge status={po.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8"
                              onClick={() => handleViewDetail(po.id)}
                              disabled={loadingDetail}
                            >
                              View
                            </Button>
                            {po.status === 'draft' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 text-blue-600 hover:text-blue-700"
                                disabled={actionLoading === po.id}
                                onClick={() => handleAction(po.id, 'send')}
                              >
                                {actionLoading === po.id ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Send className="size-3" />
                                )}
                                Send
                              </Button>
                            )}
                            {po.status === 'sent' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 text-purple-600 hover:text-purple-700"
                                disabled={actionLoading === po.id}
                                onClick={() => handleAction(po.id, 'confirm')}
                              >
                                <CheckCircle className="size-3" />
                                Confirm
                              </Button>
                            )}
                            {(po.status === 'confirmed' || po.status === 'sent') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 text-green-600 hover:text-green-700"
                                onClick={() => {
                                  setSelectedPO(po)
                                  setReceiveMode(true)
                                  setShowDetailDialog(true)
                                }}
                              >
                                <Package className="size-3" />
                                Receive
                              </Button>
                            )}
                            {['draft', 'sent', 'confirmed'].includes(po.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 text-red-600 hover:text-red-700"
                                disabled={actionLoading === po.id}
                                onClick={() => handleAction(po.id, 'cancel')}
                              >
                                <XCircle className="size-3" />
                              </Button>
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
                {purchaseOrders.map(po => (
                  <div key={po.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{po.supplier?.name || 'No supplier'}</div>
                      <POStatusBadge status={po.status} />
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>{formatDate(po.orderDate)} &middot; {po.items.length} item{po.items.length > 1 ? 's' : ''}</div>
                      <div className="font-medium text-foreground">Total: {formatETB(po.totalAmount)}</div>
                    </div>
                    <div className="flex items-center gap-1 pt-1 flex-wrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => handleViewDetail(po.id)}
                      >
                        View
                      </Button>
                      {po.status === 'draft' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-blue-600 text-xs"
                          disabled={actionLoading === po.id}
                          onClick={() => handleAction(po.id, 'send')}
                        >
                          <Send className="size-3" /> Send
                        </Button>
                      )}
                      {po.status === 'sent' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-purple-600 text-xs"
                          disabled={actionLoading === po.id}
                          onClick={() => handleAction(po.id, 'confirm')}
                        >
                          <CheckCircle className="size-3" /> Confirm
                        </Button>
                      )}
                      {(po.status === 'confirmed' || po.status === 'sent') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-green-600 text-xs"
                          onClick={() => {
                            setSelectedPO(po)
                            setReceiveMode(true)
                            setShowDetailDialog(true)
                          }}
                        >
                          <Package className="size-3" /> Receive
                        </Button>
                      )}
                      {['draft', 'sent', 'confirmed'].includes(po.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-red-600 text-xs"
                          disabled={actionLoading === po.id}
                          onClick={() => handleAction(po.id, 'cancel')}
                        >
                          <XCircle className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create PO Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        if (!open) resetForm()
        setShowCreateDialog(open)
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>
              Order stock from a supplier. Add line items for each product.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Supplier */}
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={formSupplierId} onValueChange={setFormSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {loadingDropdowns ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">Loading...</div>
                  ) : suppliers.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">No suppliers found</div>
                  ) : (
                    suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Shop (optional destination) */}
            <div className="space-y-2">
              <Label>Receiving Shop</Label>
              <Select value={formShopId} onValueChange={setFormShopId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select shop (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {shops.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expected Date */}
            <div className="space-y-2">
              <Label>Expected Delivery Date</Label>
              <Input
                type="date"
                value={formExpectedDate}
                onChange={(e) => setFormExpectedDate(e.target.value)}
              />
            </div>

            {/* Low Stock Suggestions */}
            {lowStockProducts.length > 0 && (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 w-full justify-between"
                  onClick={() => setShowLowStockSuggestions(!showLowStockSuggestions)}
                >
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="size-3 text-yellow-600" />
                    {lowStockProducts.length} low-stock product suggestions
                  </span>
                  {showLowStockSuggestions ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </Button>
                {showLowStockSuggestions && (
                  <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                    {lowStockProducts.map(product => (
                      <div key={product.id} className="flex items-center justify-between p-2 text-sm">
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Stock: {product.quantity} / Threshold: {product.lowStockThreshold}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => addLowStockToForm(product)}
                        >
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Line Items */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Line Items</Label>
              {formItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Product</Label>}
                    <Select value={item.productId} onValueChange={(val) => updateFormItem(index, 'productId', val)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingDropdowns ? (
                          <div className="px-2 py-4 text-center text-sm text-muted-foreground">Loading...</div>
                        ) : products.length === 0 ? (
                          <div className="px-2 py-4 text-center text-sm text-muted-foreground">No products</div>
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
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Qty</Label>}
                    <Input
                      type="number"
                      min="1"
                      placeholder="0"
                      className="h-9"
                      value={item.quantity}
                      onChange={(e) => updateFormItem(index, 'quantity', e.target.value)}
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Unit Cost</Label>}
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="h-9"
                      value={item.unitCost}
                      onChange={(e) => updateFormItem(index, 'unitCost', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <div className="text-sm font-medium text-right flex-1">
                      {item.quantity && item.unitCost
                        ? formatETB((parseInt(item.quantity) || 0) * (parseFloat(item.unitCost) || 0))
                        : '—'}
                    </div>
                    {formItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                        onClick={() => removeFormItem(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={addFormItem}
              >
                <Plus className="size-3" />
                Add Item
              </Button>
              {formTotal > 0 && (
                <div className="text-right font-semibold text-base pt-2 border-t">
                  Total: {formatETB(formTotal)}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes about this order"
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
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail / Receive Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={(open) => {
        if (!open) {
          setReceiveMode(false)
          setReceivedItems({})
          setSelectedPO(null)
        }
        setShowDetailDialog(open)
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          {selectedPO && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {receiveMode ? 'Receive Goods' : 'Purchase Order Details'}
                </DialogTitle>
                <DialogDescription>
                  {receiveMode
                    ? 'Enter the quantities received for each item.'
                    : `Order placed on ${formatDate(selectedPO.orderDate)}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* PO Header Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Supplier:</span>{' '}
                    <span className="font-medium">{selectedPO.supplier?.name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <POStatusBadge status={selectedPO.status} />
                  </div>
                  <div>
                    <span className="text-muted-foreground">Order Date:</span>{' '}
                    <span className="font-medium">{formatDate(selectedPO.orderDate)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expected:</span>{' '}
                    <span className="font-medium">{formatDate(selectedPO.expectedDate)}</span>
                  </div>
                  {selectedPO.shop && (
                    <div>
                      <span className="text-muted-foreground">Receiving Shop:</span>{' '}
                      <span className="font-medium">{selectedPO.shop.name}</span>
                    </div>
                  )}
                </div>

                {selectedPO.notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Notes:</span>{' '}
                    {selectedPO.notes}
                  </div>
                )}

                <Separator />

                {/* Items */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Items</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        {receiveMode && (
                          <TableHead className="text-right">Received</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPO.items.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.product.name}</div>
                            {item.product.sku && (
                              <div className="text-xs text-muted-foreground">{item.product.sku}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatETB(item.unitCost)}</TableCell>
                          <TableCell className="text-right font-medium">{formatETB(item.totalCost)}</TableCell>
                          {receiveMode && (
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                max={item.quantity.toString()}
                                className="w-20 h-8 text-right"
                                placeholder={item.quantity.toString()}
                                value={receivedItems[item.id] ?? ''}
                                onChange={(e) => setReceivedItems({
                                  ...receivedItems,
                                  [item.id]: e.target.value,
                                })}
                              />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {!receiveMode && selectedPO.items.some(item => item.receivedQty > 0) && (
                    <div className="text-sm text-muted-foreground mt-2">
                      <span className="font-medium">Already received:</span>{' '}
                      {selectedPO.items
                        .filter(item => item.receivedQty > 0)
                        .map(item => `${item.product.name}: ${item.receivedQty}/${item.quantity}`)
                        .join(', ')}
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="text-right font-semibold text-base pt-2 border-t">
                  Total: {formatETB(selectedPO.totalAmount)}
                </div>
              </div>

              <DialogFooter>
                {!receiveMode && (
                  <div className="flex items-center gap-2 w-full justify-between">
                    <div className="flex items-center gap-1">
                      {selectedPO.status === 'draft' && (
                        <Button
                          variant="outline"
                          className="gap-1 text-blue-600"
                          disabled={actionLoading === selectedPO.id}
                          onClick={() => handleAction(selectedPO.id, 'send')}
                        >
                          <Send className="size-4" /> Send
                        </Button>
                      )}
                      {selectedPO.status === 'sent' && (
                        <Button
                          variant="outline"
                          className="gap-1 text-purple-600"
                          disabled={actionLoading === selectedPO.id}
                          onClick={() => handleAction(selectedPO.id, 'confirm')}
                        >
                          <CheckCircle className="size-4" /> Confirm
                        </Button>
                      )}
                      {(selectedPO.status === 'confirmed' || selectedPO.status === 'sent') && (
                        <Button
                          variant="outline"
                          className="gap-1 text-green-600"
                          onClick={() => setReceiveMode(true)}
                        >
                          <Package className="size-4" /> Receive Goods
                        </Button>
                      )}
                    </div>
                    {['draft', 'sent', 'confirmed'].includes(selectedPO.status) && (
                      <Button
                        variant="outline"
                        className="gap-1 text-red-600"
                        disabled={actionLoading === selectedPO.id}
                        onClick={() => handleAction(selectedPO.id, 'cancel')}
                      >
                        <XCircle className="size-4" /> Cancel
                      </Button>
                    )}
                  </div>
                )}
                {receiveMode && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setReceiveMode(false)
                        setReceivedItems({})
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleReceive}
                      disabled={receiving}
                      className="gap-2"
                    >
                      {receiving && <Loader2 className="size-4 animate-spin" />}
                      Confirm Received
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

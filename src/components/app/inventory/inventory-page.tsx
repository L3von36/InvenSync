'use client'

import { PageHeader, AvatarListRow } from '@/components/shared/design-system'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import {
  Package, AlertTriangle, XCircle, TrendingUp, ArrowUpDown,
  Search, Plus, Minus, RefreshCw, ChevronLeft, ChevronRight,
  History, Filter
} from 'lucide-react'
import { api, type Product, type StockMovement, type InventoryStats, type ProductType } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getNetworkErrorMessage } from '@/lib/validation'
import { formatETB, formatDateTime } from '@/lib/format'
import { stockAdjustmentSchema, type StockAdjustmentFormData } from '@/lib/validations'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { Form } from '@/components/ui/form'
import { FormSelectField, FormInputField, FormSubmitButton } from '@/components/shared/form-fields'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

// ============================================
// Helpers
// ============================================

function getStockStatus(quantity: number, threshold: number): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (quantity === 0) return { label: 'Out of Stock', variant: 'destructive' }
  if (quantity <= threshold) return { label: 'Low Stock', variant: 'secondary' }
  return { label: 'In Stock', variant: 'default' }
}

// ============================================
// Stats Cards
// ============================================
function InventoryStatsCards({ stats }: { stats: InventoryStats['overview'] | null }) {
  const cards = [
    // Design rule: color = meaning. Low/Out of Stock are signals; counts are neutral.
    { title: 'Total Products', value: stats?.totalProducts ?? 0, icon: Package, color: 'text-primary', bg: 'bg-primary/10' },
    { title: 'In Stock', value: (stats?.totalProducts ?? 0) - (stats?.outOfStock ?? 0) - (stats?.lowStock ?? 0), icon: TrendingUp, color: 'text-muted-foreground', bg: 'bg-muted' },
    { title: 'Low Stock', value: stats?.lowStock ?? 0, icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { title: 'Out of Stock', value: stats?.outOfStock ?? 0, icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
    { title: 'Total Value', value: formatETB(stats?.totalRetailValue ?? 0), icon: TrendingUp, color: 'text-muted-foreground', bg: 'bg-muted' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`size-10 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`size-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{card.title}</p>
                <p className="text-xl sm:text-2xl font-semibold tabular-nums truncate">{card.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================
// Stock Adjustment Dialog
// ============================================
function StockAdjustmentDialog({
  open,
  onClose,
  product,
  orgId,
  shopId,
  onAdjusted,
}: {
  open: boolean
  onClose: () => void
  product: Product | null
  orgId: string
  shopId?: string
  onAdjusted: () => void
}) {
  const [loading, setLoading] = useState(false)

  const form = useForm<StockAdjustmentFormData>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: { type: 'in', quantity: '' as unknown as number, reason: '' },
  })

  const watchedType = form.watch('type')
  const watchedQty = form.watch('quantity')
  const qty = typeof watchedQty === 'number' ? watchedQty : (parseInt(String(watchedQty)) || 0)
  const previewStock = watchedType === 'in'
    ? (product?.quantity ?? 0) + qty
    : watchedType === 'out'
    ? Math.max(0, (product?.quantity ?? 0) - qty)
    : qty

  const handleSubmit = async (data: StockAdjustmentFormData) => {
    if (!product) return

    setLoading(true)
    try {
      await api.addStockMovement(orgId, {
        productId: product.id,
        type: data.type,
        quantity: data.quantity,
        reason: data.reason.trim(),
        shopId,
      })
      toast.success('Stock adjusted successfully')
      onAdjusted()
      onClose()
    } catch (err: unknown) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) {
      form.reset({ type: 'in', quantity: '' as unknown as number, reason: '' })
    }
  }, [open, form])

  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            Adjust stock for <span className="font-semibold">{product.name}</span> (Current: {product.quantity})
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2">
            <FormSelectField
              name="type"
              label="Adjustment Type"
              options={[
                { value: 'in', label: 'Add Stock', icon: <Plus className="size-3" /> },
                { value: 'out', label: 'Remove Stock', icon: <Minus className="size-3" /> },
                { value: 'adjustment', label: 'Adjustment (Set)', icon: <RefreshCw className="size-3" /> },
              ]}
            />
            <FormInputField
              name="quantity"
              label="Quantity"
              placeholder="Enter quantity"
              type="number"
              required
              min={1}
            />
            <FormInputField
              name="reason"
              label="Reason"
              placeholder="Enter reason for adjustment"
              required
            />
            {qty > 0 && (
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">Preview</p>
                <p className="text-sm font-bold">
                  {product.quantity} → {previewStock}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <FormSubmitButton isLoading={loading} loadingText="Adjusting...">
                Confirm Adjustment
              </FormSubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// All Products Tab
// ============================================
function AllProductsTab({
  orgId,
  shopId,
  onAdjust,
}: {
  orgId: string
  shopId?: string
  onAdjust: (product: Product) => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [sortCol, setSortCol] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchData = useCallback(async () => {
    try {
      const [productsRes, typesRes] = await Promise.all([
        api.getProducts(orgId, {
          search: search || undefined,
          productTypeId: filterType !== 'all' ? filterType : undefined,
          page,
          limit: 10,
          shopId,
        }),
        api.getProductTypes(orgId, shopId),
      ])
      setProducts(productsRes.products)
      setTotalPages(productsRes.pagination.totalPages)
      setProductTypes(typesRes.productTypes)
    } catch (error) {
      toast.error(getNetworkErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [orgId, shopId, search, filterType, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sortedProducts = [...products].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortCol) {
      case 'name': return a.name.localeCompare(b.name) * dir
      case 'sku': return (a.sku || '').localeCompare(b.sku || '') * dir
      case 'quantity': return (a.quantity - b.quantity) * dir
      case 'costPrice': return (a.costPrice - b.costPrice) * dir
      case 'sellingPrice': return (a.sellingPrice - b.sellingPrice) * dir
      default: return 0
    }
  })

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort(col)}>
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`size-3 ${sortCol === col ? 'opacity-100' : 'opacity-30'}`} />
      </span>
    </TableHead>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="pl-9"
            aria-label="Search inventory"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="size-4 mr-2" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {productTypes.map((pt) => (
              <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader col="name">Product Name</SortHeader>
              <SortHeader col="sku">SKU</SortHeader>
              <TableHead>Type</TableHead>
              <SortHeader col="quantity">Quantity</SortHeader>
              <SortHeader col="costPrice">Cost Price</SortHeader>
              <SortHeader col="sellingPrice">Selling Price</SortHeader>
              <TableHead>Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              sortedProducts.map((product) => {
                const status = getStockStatus(product.quantity, product.lowStockThreshold)
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium max-w-[13.846rem] truncate">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{product.sku || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{product.productType?.name || '—'}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{product.quantity}</TableCell>
                    <TableCell className="text-sm">{formatETB(product.costPrice)}</TableCell>
                    <TableCell className="text-sm">{formatETB(product.sellingPrice)}</TableCell>
                    <TableCell className="text-sm font-medium">{formatETB(product.quantity * product.sellingPrice)}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => onAdjust(product)}>
                        Adjust Stock
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        </div>
        {/* Mobile list — Direction B avatar rows; tapping a row opens
            the stock adjustment dialog */}
        <div className="md:hidden divide-y px-3">
          {sortedProducts.length === 0 ? (
            <EmptyState
              title="No products found"
              message="No products match your current filters."
            />
          ) : (
            sortedProducts.map((product) => {
              const status = getStockStatus(product.quantity, product.lowStockThreshold)
              return (
                <AvatarListRow
                  key={product.id}
                  name={product.name}
                  caption={`${product.productType?.name || '—'}${product.sku ? ` · ${product.sku}` : ''} · ${formatETB(product.sellingPrice)}`}
                  amount={`${product.quantity} qty`}
                  badge={<Badge variant={status.variant} className="text-xs">{status.label}</Badge>}
                  onClick={() => onAdjust(product)}
                  className="rounded-none px-0 mx-0"
                />
              )
            })
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Low Stock Tab
// ============================================
function LowStockTab({
  orgId,
  shopId,
  lowStockProducts,
  onRestock,
}: {
  orgId: string
  shopId?: string
  lowStockProducts: InventoryStats['lowStockProducts']
  onRestock: (product: Product) => void
}) {
  const [products, setProducts] = useState<InventoryStats['lowStockProducts']>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLowStock = async () => {
      try {
        const data = await api.getInventory(orgId, shopId)
        setProducts(data.lowStockProducts)
      } catch (error) {
      toast.error(getNetworkErrorMessage(error))
      } finally {
        setLoading(false)
      }
    }
    fetchLowStock()
  }, [orgId, shopId])

  useEffect(() => {
    if (lowStockProducts && lowStockProducts.length > 0) {
      setProducts(lowStockProducts)
      setLoading(false)
    }
  }, [lowStockProducts])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <EmptyState
        title="All Stocked Up!"
        message="No products are currently low on stock."
        icon={<AlertTriangle className="size-7 text-emerald-500" />}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {products.map((product) => (
        <Card key={product.id} className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-sm truncate max-w-[15.385rem]">{product.name}</h4>
                <p className="text-xs text-muted-foreground">{product.productType.name}</p>
              </div>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 shrink-0">
                Low Stock
              </Badge>
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-muted-foreground">Current: </span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{product.quantity}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Threshold: </span>
                <span className="font-medium">{product.lowStockThreshold}</span>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full mt-3"
              onClick={() => onRestock({
                id: product.id,
                name: product.name,
                quantity: product.quantity,
                lowStockThreshold: product.lowStockThreshold,
              } as Product)}
            >
              <Plus className="size-3 mr-1" /> Quick Restock
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================
// Out of Stock Tab
// ============================================
function OutOfStockTab({
  orgId,
  shopId,
  onRestock,
}: {
  orgId: string
  shopId?: string
  onRestock: (product: Product) => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOutOfStock = async () => {
      try {
        const res = await api.getProducts(orgId, { limit: 100, shopId })
        setProducts(res.products.filter(p => p.quantity === 0))
      } catch (error) {
      toast.error(getNetworkErrorMessage(error))
      } finally {
        setLoading(false)
      }
    }
    fetchOutOfStock()
  }, [orgId, shopId])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <EmptyState
        title="Everything In Stock!"
        message="No products are out of stock right now."
        icon={<XCircle className="size-7 text-emerald-500" />}
      />
    )
  }

  return (
    <div className="space-y-3">
      {products.map((product) => (
        <Card key={product.id} className="border-red-200 dark:border-red-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">{product.name}</h4>
                <p className="text-xs text-muted-foreground">
                  {product.sku && `SKU: ${product.sku} • `}{product.productType?.name || 'No type'}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => onRestock(product)}>
              <Plus className="size-3 mr-1" /> Restock
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================
// Stock History Tab
// ============================================
function StockHistoryTab({ orgId, shopId }: { orgId: string; shopId?: string }) {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [filterProduct, setFilterProduct] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const [invData, prodRes] = await Promise.all([
          api.getInventory(orgId, shopId),
          api.getProducts(orgId, { limit: 100, shopId }),
        ])
        setMovements(invData.recentMovements)
        setProducts(prodRes.products)
      } catch (error) {
        toast.error(getNetworkErrorMessage(error))
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [orgId, shopId])

  const filtered = movements.filter((m) => {
    if (filterProduct !== 'all' && m.productId !== filterProduct) return false
    if (filterType !== 'all' && m.type !== filterType) return false
    return true
  })

  const typeLabel = (type: string) => {
    switch (type) {
      case 'in': return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Stock In</Badge>
      case 'out': return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">Stock Out</Badge>
      case 'adjustment': return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Adjustment</Badge>
      default: return <Badge variant="outline">{type}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Filter by product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="in">Stock In</SelectItem>
            <SelectItem value="out">Stock Out</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Empty state or Table */}
      {!loading && filtered.length === 0 ? (
        <EmptyState
          title={filterProduct !== 'all' || filterType !== 'all' ? 'No matching stock movements' : 'No stock movements yet'}
          message={filterProduct !== 'all' || filterType !== 'all'
            ? 'Try adjusting your filters'
            : 'Stock movements will appear here when you adjust product quantities'}
          icon={<History className="size-7 text-muted-foreground" />}
        />
      ) : (
      <div className="rounded-lg border overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Previous Stock</TableHead>
                <TableHead className="text-right">New Stock</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm whitespace-nowrap">{formatDateTime(m.createdAt)}</TableCell>
                  <TableCell className="font-medium text-sm">{m.product?.name || '—'}</TableCell>
                  <TableCell>{typeLabel(m.type)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {m.type === 'in' ? '+' : m.type === 'out' ? '-' : '±'}{m.quantity}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">{m.previousStock}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">{m.newStock}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[15.385rem] truncate">{m.reason || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {/* Mobile list — Direction B avatar rows */}
        <div className="md:hidden divide-y px-3">
          {filtered.map((m) => (
            <AvatarListRow
              key={m.id}
              name={m.product?.name || '—'}
              caption={`${formatDateTime(m.createdAt)}${m.reason ? ` · ${m.reason}` : ''}`}
              amount={
                <span>
                  {m.type === 'in' ? '+' : m.type === 'out' ? '-' : '±'}{m.quantity}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">{m.previousStock} → {m.newStock}</span>
                </span>
              }
              badge={typeLabel(m.type)}
              className="rounded-none px-0 mx-0"
            />
          ))}
        </div>
      </div>
      )}
    </div>
  )
}

// ============================================
// Main Inventory Page
// ============================================
export function InventoryPage() {
  const { currentOrg, currentShop } = useAuthStore()
  const orgId = currentOrg?.id || ''
  const shopId = currentShop?.id

  const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('all')

  const fetchInventory = useCallback(async () => {
    if (!orgId) return
    try {
      setFetchError(null)
      const data = await api.getInventory(orgId, shopId)
      setInventoryStats(data)
    } catch (error) {
      setFetchError(getNetworkErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [orgId, shopId])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  const handleAdjust = (product: Product) => {
    setAdjustProduct(product)
    setAdjustDialogOpen(true)
  }

  const handleAdjusted = () => {
    fetchInventory()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-10 w-full max-w-96" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tabular-nums tracking-tight">Inventory Management</h1>
            <p className="text-muted-foreground text-sm mt-1">Track stock levels, manage movements, and monitor alerts.</p>
          </div>
        </div>
        <ErrorState title="Failed to load inventory" message={fetchError} onRetry={fetchInventory} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<Package />}
        title="Inventory Management"
        subtitle="Track stock levels, manage movements, and monitor alerts."
      />

      {/* Stats */}
      <InventoryStatsCards stats={inventoryStats?.overview ?? null} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="all" className="gap-1 text-xs sm:text-sm">
            <Package className="size-4" /> <span className="hidden sm:inline">All</span> Products
          </TabsTrigger>
          <TabsTrigger value="low-stock" className="gap-1 text-xs sm:text-sm">
            <AlertTriangle className="size-4" /> <span className="hidden sm:inline">Low</span> Stock
            {inventoryStats?.overview.lowStock ? (
              <Badge variant="secondary" className="ml-1.5 size-5 p-0 text-[0.769rem] flex items-center justify-center bg-amber-100 text-amber-800">
                {inventoryStats.overview.lowStock}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="out-of-stock" className="gap-1 text-xs sm:text-sm">
            <XCircle className="size-4" /> <span className="hidden sm:inline">Out of</span> Stock
            {inventoryStats?.overview.outOfStock ? (
              <Badge variant="secondary" className="ml-1.5 size-5 p-0 text-[0.769rem] flex items-center justify-center bg-red-100 text-red-800">
                {inventoryStats.overview.outOfStock}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1 text-xs sm:text-sm">
            <History className="size-4" /> <span className="hidden sm:inline">Stock</span> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <AllProductsTab orgId={orgId} shopId={shopId} onAdjust={handleAdjust} />
        </TabsContent>

        <TabsContent value="low-stock" className="mt-4">
          <LowStockTab
            orgId={orgId}
            shopId={shopId}
            lowStockProducts={inventoryStats?.lowStockProducts ?? []}
            onRestock={handleAdjust}
          />
        </TabsContent>

        <TabsContent value="out-of-stock" className="mt-4">
          <OutOfStockTab orgId={orgId} shopId={shopId} onRestock={handleAdjust} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <StockHistoryTab orgId={orgId} shopId={shopId} />
        </TabsContent>
      </Tabs>

      {/* Stock Adjustment Dialog */}
      <StockAdjustmentDialog
        open={adjustDialogOpen}
        onClose={() => setAdjustDialogOpen(false)}
        product={adjustProduct}
        orgId={orgId}
        shopId={shopId}
        onAdjusted={handleAdjusted}
      />
    </div>
  )
}

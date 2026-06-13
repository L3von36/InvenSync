'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ShoppingCart, DollarSign, Calendar, TrendingUp,
  Search, Plus, Trash2, ChevronLeft, ChevronRight,
  Eye, Printer, X, Receipt, CreditCard, Banknote, Smartphone, Loader2,
  FileText, Download
} from 'lucide-react'
import { api, type Sale, type SaleItem, type Product, type Customer } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/status-badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { getNetworkErrorMessage } from '@/lib/validation'
import { saleSchema, type SaleFormData } from '@/lib/validations'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { FormInputField, FormTextareaField } from '@/components/shared/form-fields'

// ============================================
// Helpers
// ============================================
import { formatETB, formatDateShort } from '@/lib/format'

function paymentMethodIcon(method: string) {
  switch (method) {
    case 'cash': return <Banknote className="size-3.5" />
    case 'card': return <CreditCard className="size-3.5" />
    case 'mobile_money': return <Smartphone className="size-3.5" />
    case 'credit': return <Receipt className="size-3.5" />
    default: return null
  }
}

function paymentMethodLabel(method: string) {
  switch (method) {
    case 'cash': return 'Cash'
    case 'card': return 'Card'
    case 'mobile_money': return 'Mobile Money'
    case 'credit': return 'Credit'
    default: return method
  }
}

// ============================================
// Sales Stats Cards
// ============================================
function SalesStatsCards({ sales }: { sales: Sale[] }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const todaySales = sales.filter(s => new Date(s.saleDate) >= today)
  const weekSales = sales.filter(s => new Date(s.saleDate) >= startOfWeek)
  const monthSales = sales.filter(s => new Date(s.saleDate) >= startOfMonth)

  const todayTotal = todaySales.reduce((acc, s) => acc + s.total, 0)
  const weekTotal = weekSales.reduce((acc, s) => acc + s.total, 0)
  const monthTotal = monthSales.reduce((acc, s) => acc + s.total, 0)
  const avgSale = sales.length > 0 ? sales.reduce((acc, s) => acc + s.total, 0) / sales.length : 0

  const cards = [
    { title: "Today's Sales", value: formatETB(todayTotal), icon: ShoppingCart, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { title: 'This Week', value: formatETB(weekTotal), icon: Calendar, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { title: 'This Month', value: formatETB(monthTotal), icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { title: 'Avg Sale Value', value: formatETB(avgSale), icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`size-10 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`size-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{card.title}</p>
                <p className="text-xl sm:text-2xl font-bold truncate">{card.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================
// Sale Detail Dialog
// ============================================
function SaleDetailDialog({
  open,
  onClose,
  sale,
  orgName,
}: {
  open: boolean
  onClose: () => void
  sale: Sale | null
  orgName: string
}) {
  if (!sale) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>Sale Details</DialogTitle>
          <DialogDescription>Invoice {sale.invoiceNumber}</DialogDescription>
        </DialogHeader>

        {/* Printable Invoice */}
        <div id="sale-invoice" className="space-y-6 p-2">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-sm font-semibold">{orgName}</h2>
              <p className="text-sm text-muted-foreground">Invoice</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{sale.invoiceNumber}</p>
              <p className="text-sm text-muted-foreground">{formatDateShort(sale.saleDate)}</p>
            </div>
          </div>

          <Separator />

          {/* Customer */}
          {sale.customer && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Customer</p>
              <p className="font-medium">{sale.customer.name}</p>
              {sale.customer.phone && <p className="text-sm text-muted-foreground">{sale.customer.phone}</p>}
            </div>
          )}

          {/* Items Table */}
          <div className="rounded-lg border overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product?.name || '—'}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatETB(item.unitPrice)}</TableCell>
                      <TableCell className="text-right font-medium">{formatETB(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile card view */}
            <div className="md:hidden divide-y">
              {sale.items?.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{item.product?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity} × {formatETB(item.unitPrice)}</p>
                  </div>
                  <span className="font-semibold text-sm ml-3 shrink-0">{formatETB(item.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatETB(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-red-600">-{formatETB(sale.discount)}</span>
                </div>
              )}
              {sale.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatETB(sale.tax)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-sm">
                <span>Total</span>
                <span>{formatETB(sale.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment</span>
                <span className="flex items-center gap-1">
                  {paymentMethodIcon(sale.paymentMethod)}
                  {paymentMethodLabel(sale.paymentMethod)}
                </span>
              </div>
              {sale.paymentMethod === 'credit' && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span>{formatETB(sale.amountPaid)}</span>
                </div>
              )}
              {sale.status && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  {<StatusBadge status={sale.status} />}
                </div>
              )}
            </div>
          </div>

          {sale.notes && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm">{sale.notes}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-end gap-2 print:hidden mt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="outline" onClick={() => {
            window.open(`/api/sales/${sale.id}/receipt?orgId=${sale.organizationId}`, '_blank')
          }}>
            <Download className="size-4 mr-1" /> Receipt
          </Button>
          <Button variant="outline" onClick={() => {
            window.open(`/api/sales/${sale.id}/invoice?orgId=${sale.organizationId}`, '_blank')
          }}>
            <FileText className="size-4 mr-1" /> Invoice
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="size-4 mr-1" /> Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// All Sales Tab
// ============================================
function AllSalesTab({
  orgId,
  shopId,
  onViewSale,
  onCreateSale,
}: {
  orgId: string
  shopId?: string
  onViewSale: (sale: Sale) => void
  onCreateSale: () => void
}) {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPayment, setFilterPayment] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchSales = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getSales(orgId, {
        status: filterStatus !== 'all' ? filterStatus : undefined,
        page,
        limit: 10,
        shopId,
      })
      setSales(res.sales)
      setTotalPages(res.pagination.totalPages)
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [orgId, filterStatus, page, shopId])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  const filteredSales = sales.filter((s) => {
    if (filterPayment !== 'all' && s.paymentMethod !== filterPayment) return false
    if (search) {
      const q = search.toLowerCase()
      const matchInvoice = s.invoiceNumber.toLowerCase().includes(q)
      const matchCustomer = s.customer?.name.toLowerCase().includes(q)
      if (!matchInvoice && !matchCustomer) return false
    }
    return true
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-36" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    )
  }

  if (error && sales.length === 0) {
    return <ErrorState title="Failed to load sales" message={error} onRetry={fetchSales} />
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by invoice # or customer..."
            aria-label="Search sales"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="mobile_money">Mobile Money</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Empty state or Table */}
      {!loading && filteredSales.length === 0 ? (
        <EmptyState
          title={search || filterStatus !== 'all' || filterPayment !== 'all' ? 'No sales match your filters' : 'No sales yet'}
          message={search || filterStatus !== 'all' || filterPayment !== 'all'
            ? 'Try adjusting your search or filters'
            : 'Create your first sale to start tracking transactions'}
          icon={<ShoppingCart className="size-7 text-muted-foreground" />}
          {...((!search && filterStatus === 'all' && filterPayment === 'all') ? { action: { label: 'Create Sale', onClick: onCreateSale } } : {})}
        />
      ) : (
      <div className="rounded-lg border overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(
                filteredSales.map((sale) => (
                  <TableRow key={sale.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onViewSale(sale)}>
                    <TableCell className="font-medium font-mono text-sm">{sale.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">{sale.customer?.name || 'Walk-in'}</TableCell>
                    <TableCell className="text-center text-sm">{sale.items?.length ?? 0}</TableCell>
                    <TableCell className="text-right text-sm">{formatETB(sale.subtotal)}</TableCell>
                    <TableCell className="text-right text-sm">{sale.discount > 0 ? formatETB(sale.discount) : '—'}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatETB(sale.total)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        {paymentMethodIcon(sale.paymentMethod)}
                        {paymentMethodLabel(sale.paymentMethod)}
                      </div>
                    </TableCell>
                    <TableCell>{<StatusBadge status={sale.status} />}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{formatDateShort(sale.saleDate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="min-h-9 min-w-9" onClick={(e) => { e.stopPropagation(); onViewSale(sale) }} title="View Details">
                          <Eye className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="min-h-9 min-w-9" onClick={(e) => { e.stopPropagation(); window.open(`/api/sales/${sale.id}/receipt?orgId=${orgId}`, '_blank') }} title="Download Receipt">
                          <Download className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="min-h-9 min-w-9" onClick={(e) => { e.stopPropagation(); window.open(`/api/sales/${sale.id}/invoice?orgId=${orgId}`, '_blank') }} title="Print Invoice">
                          <FileText className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {/* Mobile card view */}
        <div className="md:hidden space-y-3 p-3">
          {filteredSales.map((sale) => (
            <Card key={sale.id} className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onViewSale(sale)}>
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">{sale.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {sale.customer?.name || 'Walk-in'} · {sale.items?.length ?? 0} item{(sale.items?.length ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {<StatusBadge status={sale.status} />}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {paymentMethodIcon(sale.paymentMethod)}
                  {paymentMethodLabel(sale.paymentMethod)}
                  <span>· {formatDateShort(sale.saleDate)}</span>
                </div>
                <span className="font-bold text-sm">{formatETB(sale.total)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); window.open(`/api/sales/${sale.id}/receipt?orgId=${orgId}`, '_blank') }}>
                  <Download className="size-3" /> Receipt
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); window.open(`/api/sales/${sale.id}/invoice?orgId=${orgId}`, '_blank') }}>
                  <FileText className="size-3" /> Invoice
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-9 min-w-9">
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-9 min-w-9">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Create Sale Form
// ============================================

function CreateSaleTab({ orgId, shopId, onSaleCreated }: { orgId: string; shopId?: string; onSaleCreated: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [fetchError, setFetchError] = useState<string | null>(null)

  const form = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      customerId: '',
      newCustomerName: '',
      newCustomerPhone: '',
      items: [],
      discount: 0,
      tax: 0,
      paymentMethod: 'cash',
      amountPaid: 0,
      notes: '',
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })

  // Live computed values
  const watchedItems = form.watch('items')
  const watchedDiscount = form.watch('discount')
  const watchedTax = form.watch('tax')
  const watchedPaymentMethod = form.watch('paymentMethod')
  const watchedAmountPaid = form.watch('amountPaid')

  const subtotal = watchedItems.reduce((acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)
  const discountVal = Number(watchedDiscount) || 0
  const taxVal = Number(watchedTax) || 0
  const grandTotal = subtotal - discountVal + taxVal

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(customerSearch))
  )

  useEffect(() => {
    const fetchData = async () => {
      setFetchError(null)
      try {
        const [custRes, prodRes] = await Promise.all([
          api.getCustomers(orgId, { limit: 100, shopId }),
          api.getProducts(orgId, { limit: 100, shopId }),
        ])
        setCustomers(custRes.customers)
        setProducts(prodRes.products.filter(p => p.isActive && p.quantity > 0))
      } catch (err) {
        const msg = getNetworkErrorMessage(err)
        setFetchError(msg)
        toast.error(msg)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [orgId, shopId])

  const handleFormSubmit = async (data: SaleFormData) => {
    // Additional business validation beyond Zod: stock availability & new customer name
    let hasErrors = false

    // Check stock availability for each item
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i]
      const product = products.find(p => p.id === item.productId)
      if (product && item.quantity > product.quantity) {
        form.setError(`items.${i}.quantity` as const, {
          message: `Exceeds stock (${product.quantity} available)`,
        })
        hasErrors = true
      }
    }

    // Validate new customer name when toggled
    if (showNewCustomer && !data.newCustomerName?.trim()) {
      form.setError('newCustomerName', { message: 'Customer name is required' })
      hasErrors = true
    }

    if (hasErrors) {
      toast.error('Please fix the errors in the form')
      return
    }

    setSubmitting(true)
    try {
      // Create customer inline if needed
      let finalCustomerId = data.customerId
      if (showNewCustomer && data.newCustomerName?.trim()) {
        const custRes = await api.createCustomer(orgId, {
          name: data.newCustomerName.trim(),
          phone: data.newCustomerPhone?.trim() || undefined,
          shopId,
        })
        finalCustomerId = custRes.customer.id
      }

      await api.createSale(orgId, {
        customerId: finalCustomerId || undefined,
        items: data.items,
        paymentMethod: data.paymentMethod,
        discount: data.discount ?? 0,
        tax: data.tax ?? 0,
        amountPaid: data.paymentMethod === 'credit' ? (data.amountPaid ?? 0) : grandTotal,
        notes: data.notes?.trim() || undefined,
        shopId,
      })

      toast.success('Sale completed successfully!')
      onSaleCreated()

      // Reset form
      form.reset()
      setShowNewCustomer(false)
    } catch (err: unknown) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (fetchError && customers.length === 0 && products.length === 0) {
    return <ErrorState title="Failed to load data" message={fetchError} onRetry={() => window.location.reload()} />
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Customer Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {showNewCustomer ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormInputField name="newCustomerName" label="Name" placeholder="Customer name" required />
                  <FormInputField name="newCustomerPhone" label="Phone" placeholder="Phone number" type="tel" />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewCustomer(false)}>
                  Cancel — Select existing customer
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search customers..."
                    aria-label="Search customers"
                    className="pl-9"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                </div>
                <FormField
                  name="customerId"
                  render={({ field }) => (
                    <FormItem className="w-full sm:w-64">
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                          {filteredCustomers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setShowNewCustomer(true)}>
                  <Plus className="size-4 mr-1" /> New
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Items</CardTitle>
              <Button type="button" size="sm" onClick={() => append({ productId: '', quantity: 1, unitPrice: 0 })}>
                <Plus className="size-4 mr-1" /> Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                <ShoppingCart className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No items added yet. Click &quot;Add Item&quot; to start.</p>
                {form.formState.errors.items?.root && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.items.root.message}</p>
                )}
                {form.formState.errors.items?.message && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.items.message}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const itemData = watchedItems[index]
                  const itemTotal = (Number(itemData?.quantity) || 0) * (Number(itemData?.unitPrice) || 0)
                  const selectedProduct = products.find(p => p.id === itemData?.productId)
                  return (
                    <div key={field.id} className="border rounded-lg p-3">
                      <div className="space-y-1 mb-3">
                        <FormLabel className="text-xs">Product</FormLabel>
                        <FormField
                          name={`items.${index}.productId`}
                          render={({ field: productField }) => (
                            <FormItem>
                              <Select
                                value={productField.value}
                                onValueChange={(val) => {
                                  productField.onChange(val)
                                  const product = products.find(p => p.id === val)
                                  if (product) {
                                    form.setValue(`items.${index}.unitPrice`, product.sellingPrice)
                                  }
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select product" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {products.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name} (Stock: {p.quantity}) — {formatETB(p.sellingPrice)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-4 sm:col-span-3 space-y-1">
                          <FormLabel className="text-xs">Qty</FormLabel>
                          <FormField
                            name={`items.${index}.quantity`}
                            render={({ field: qtyField }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="1"
                                    max={selectedProduct?.quantity}
                                    value={qtyField.value}
                                    onChange={(e) => {
                                      qtyField.onChange(e.target.value === '' ? '' : e.target.value)
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-3 space-y-1">
                          <FormLabel className="text-xs">Price</FormLabel>
                          <FormField
                            name={`items.${index}.unitPrice`}
                            render={({ field: priceField }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={priceField.value}
                                    onChange={(e) => {
                                      priceField.onChange(e.target.value === '' ? '' : e.target.value)
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-4 space-y-1">
                          <FormLabel className="text-xs">Total</FormLabel>
                          <p className="text-sm font-bold py-2 truncate">{formatETB(itemTotal)}</p>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button type="button" size="icon" variant="ghost" className="text-destructive size-9 min-w-9 min-h-9" onClick={() => remove(index)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totals & Payment */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Totals */}
          <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatETB(subtotal)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormInputField name="discount" label="Discount (ETB)" type="number" min={0} step="0.01" inputClassName="text-xs" />
                  <FormInputField name="tax" label="Tax (ETB)" type="number" min={0} step="0.01" inputClassName="text-xs" />
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Grand Total</span>
                  <span>{formatETB(grandTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">
                          <span className="flex items-center gap-2"><Banknote className="size-4" /> Cash</span>
                        </SelectItem>
                        <SelectItem value="card">
                          <span className="flex items-center gap-2"><CreditCard className="size-4" /> Card</span>
                        </SelectItem>
                        <SelectItem value="mobile_money">
                          <span className="flex items-center gap-2"><Smartphone className="size-4" /> Mobile Money</span>
                        </SelectItem>
                        <SelectItem value="credit">
                          <span className="flex items-center gap-2"><Receipt className="size-4" /> Credit</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedPaymentMethod === 'credit' && (
                <div className="space-y-2">
                  <FormInputField name="amountPaid" label="Amount Paid Now (ETB)" type="number" min={0} step="0.01" />
                  {grandTotal > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Remaining debt: {formatETB(grandTotal - (Number(watchedAmountPaid) || 0))}
                    </p>
                  )}
                </div>
              )}

              <FormTextareaField name="notes" label="Notes" placeholder="Optional notes for this sale..." rows={3} />
            </CardContent>
          </Card>
        </div>

        {/* Submit */}
        <div className="flex justify-end sm:justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={submitting || fields.length === 0}
            className="w-full sm:w-auto sm:min-w-40"
          >
            {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
            {submitting ? 'Processing...' : (
              <>
                <ShoppingCart className="size-4 mr-2" />
                Complete Sale
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}

// ============================================
// Main Sales Page
// ============================================
export function SalesPage() {
  const { currentOrg, currentShop } = useAuthStore()
  const orgId = currentOrg?.id || ''
  const orgName = currentOrg?.name || 'Business'

  const [allSales, setAllSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [saleDetailOpen, setSaleDetailOpen] = useState(false)

  const fetchSales = useCallback(async () => {
    if (!orgId) return
    setPageError(null)
    try {
      const res = await api.getSales(orgId, { limit: 100, shopId: currentShop?.id })
      setAllSales(res.sales)
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setPageError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [orgId, currentShop?.id])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  const handleViewSale = async (sale: Sale) => {
    try {
      const res = await api.getSale(sale.id, orgId)
      setSelectedSale(res.sale)
      setSaleDetailOpen(true)
    } catch (err) {
      // Fallback to using the sale data from the list
      setSelectedSale(sale)
      setSaleDetailOpen(true)
      toast.error(getNetworkErrorMessage(err))
    }
  }

  const handleSaleCreated = () => {
    fetchSales()
    setActiveTab('all')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    )
  }

  if (pageError && allSales.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Sales</h1>
            <p className="text-muted-foreground text-sm mt-1">Record sales, view transactions, and manage invoices.</p>
          </div>
        </div>
        <ErrorState title="Failed to load sales data" message={pageError} onRetry={fetchSales} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-muted-foreground text-sm mt-1">Record sales, view transactions, and manage invoices.</p>
        </div>
      </div>

      {/* Stats */}
      <SalesStatsCards sales={allSales} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            <ShoppingCart className="size-4 mr-1" /> All Sales
          </TabsTrigger>
          <TabsTrigger value="create">
            <Plus className="size-4 mr-1" /> Create Sale
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <AllSalesTab orgId={orgId} shopId={currentShop?.id} onViewSale={handleViewSale} onCreateSale={() => setActiveTab('create')} />
        </TabsContent>

        <TabsContent value="create" className="mt-4">
          <CreateSaleTab orgId={orgId} shopId={currentShop?.id} onSaleCreated={handleSaleCreated} />
        </TabsContent>
      </Tabs>

      {/* Sale Detail Dialog */}
      <SaleDetailDialog
        open={saleDetailOpen}
        onClose={() => setSaleDetailOpen(false)}
        sale={selectedSale}
        orgName={orgName}
      />
    </div>
  )
}

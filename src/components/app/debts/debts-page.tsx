'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  CreditCard, DollarSign, AlertTriangle, ArrowDownLeft,
  Plus, Search, Eye, Wallet, TrendingDown, Users, Truck
} from 'lucide-react'
import { api, type Debt, type DebtPayment, type Customer, type Supplier } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { db } from '@/lib/db'
import { debtSchema, type DebtFormData, debtPaymentSchema, type DebtPaymentFormData } from '@/lib/validations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { getNetworkErrorMessage } from '@/lib/validation'
import { formatETB, formatDate } from '@/lib/format'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { Form } from '@/components/ui/form'
import { FormInputField, FormSelectField, FormTextareaField, FormSubmitButton } from '@/components/shared/form-fields'

// ============================================
// Helpers
// ============================================

function isOverdue(debt: Debt): boolean {
  if (debt.status === 'paid') return false
  if (!debt.dueDate) return false
  return new Date(debt.dueDate) < new Date()
}

// ============================================
// Main Component
// ============================================
export function DebtsPage() {
  const { currentOrg, currentShop } = useAuthStore()
  const orgId = currentOrg?.id || ''
  const shopId = currentShop?.id

  const [debts, setDebts] = useState<Debt[]>([])
  const [summary, setSummary] = useState({
    totalCustomerDebt: 0,
    totalSupplierDebt: 0,
    totalOutstanding: 0,
  })
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('customer')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Dialogs
  const [showAddDebt, setShowAddDebt] = useState(false)
  const [showRecordPayment, setShowRecordPayment] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)

  // Add Debt form
  const addDebtForm = useForm<DebtFormData>({
    resolver: zodResolver(debtSchema),
    defaultValues: { type: 'customer_debt', entityId: '', amount: '' as unknown as number, dueDate: '', description: '' },
  })
  const [addDebtSubmitting, setAddDebtSubmitting] = useState(false)

  // Payment form
  const paymentForm = useForm<DebtPaymentFormData>({
    resolver: zodResolver(debtPaymentSchema),
    defaultValues: { amount: '' as unknown as number, paymentMethod: 'cash', notes: '' },
  })
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)

  // Entities
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  // ============================================
  // Local-First Data Loading (Repository Pattern)
  // ============================================
  // Reads from IndexedDB FIRST (instant, works offline), then refreshes
  // from the API in the background and persists back to IndexedDB.
  const fetchDebts = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setPageError(null)

    const type = activeTab === 'customer' ? 'customer_debt' : 'supplier_debt'

    // ---- Step 1: Read from IndexedDB FIRST (instant, offline) ----
    try {
      let localDebts = await db.debts
        .where('organizationId')
        .equals(orgId)
        .toArray()

      // Filter by debt type
      localDebts = localDebts.filter((d) => d.type === type)

      // Filter by shopId
      if (shopId) {
        localDebts = localDebts.filter((d) => d.shopId === shopId || !d.shopId)
      }

      // Filter by status
      if (statusFilter !== 'all') {
        localDebts = localDebts.filter((d) => d.status === statusFilter)
      }

      // Sort by createdAt desc
      localDebts.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      setDebts(localDebts as unknown as Debt[])

      // Compute summary from local data
      const customerDebts = localDebts.filter((d) => d.type === 'customer_debt' && d.status !== 'paid')
      const supplierDebts = localDebts.filter((d) => d.type === 'supplier_debt' && d.status !== 'paid')
      const totalCustomer = customerDebts.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
      const totalSupplier = supplierDebts.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
      setSummary({
        totalCustomerDebt: totalCustomer,
        totalSupplierDebt: totalSupplier,
        totalOutstanding: totalCustomer + totalSupplier,
      })

      setLoading(false)
    } catch {
      setLoading(true)
    }

    // ---- Step 2: If online, refresh from API and update IndexedDB ----
    try {
      const params: Record<string, string> = { orgId, type, limit: '100' }
      if (statusFilter !== 'all') params.status = statusFilter
      const data = await api.getDebts(orgId, { ...params, shopId })
      setDebts(data.debts)
      setSummary(data.summary)

      // Persist to IndexedDB for future offline reads
      try {
        const localRecords = data.debts.map((d) => ({
          id: d.id,
          organizationId: d.organizationId,
          shopId: d.shopId || null,
          customerId: d.customerId || null,
          supplierId: d.supplierId || null,
          type: d.type || '',
          amount: d.amount ?? 0,
          paidAmount: d.paidAmount ?? 0,
          dueDate: d.dueDate || null,
          status: d.status || '',
          description: d.description || null,
          createdAt: d.createdAt || new Date().toISOString(),
          updatedAt: d.updatedAt || new Date().toISOString(),
        }))
        if (localRecords.length > 0) {
          await db.debts.bulkPut(localRecords)
        }
      } catch {
        // Caching failure is non-critical
      }
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      if (debts.length === 0) {
        setPageError(msg)
        toast.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [orgId, activeTab, statusFilter, shopId, debts.length])

  useEffect(() => {
    fetchDebts()
  }, [fetchDebts])

  const fetchEntities = useCallback(async () => {
    if (!orgId) return
    try {
      const [cData, sData] = await Promise.all([
        api.getCustomers(orgId, { limit: 100, shopId }),
        api.getSuppliers(orgId, { limit: 100, shopId }),
      ])
      setCustomers(cData.customers)
      setSuppliers(sData.suppliers)
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    }
  }, [orgId])

  // Filtered debts by search
  const filteredDebts = debts.filter((debt) => {
    if (!searchQuery) return true
    const name =
      debt.customer?.name?.toLowerCase() ||
      debt.supplier?.name?.toLowerCase() ||
      ''
    return name.includes(searchQuery.toLowerCase())
  })

  // Calculate collected this month
  const collectedThisMonth = debts.reduce((sum, d) => {
    if (!d.payments) return sum
    const now = new Date()
    return (
      sum +
      d.payments
        .filter((p) => {
          const paidDate = new Date(p.paidAt)
          return (
            paidDate.getMonth() === now.getMonth() &&
            paidDate.getFullYear() === now.getFullYear()
          )
        })
        .reduce((s, p) => s + p.amount, 0)
    )
  }, 0)

  // Overdue count
  const overdueCount = debts.filter((d) => isOverdue(d)).length

  // Watch debt type for dynamic entity list
  const debtType = addDebtForm.watch('type')

  // ============================================
  // Handlers
  // ============================================
  const handleAddDebt = async (data: DebtFormData) => {
    if (!orgId) return

    setAddDebtSubmitting(true)
    try {
      await api.createDebt(orgId, {
        type: data.type,
        customerId: data.type === 'customer_debt' ? data.entityId : undefined,
        supplierId: data.type === 'supplier_debt' ? data.entityId : undefined,
        amount: data.amount,
        dueDate: data.dueDate || undefined,
        description: data.description || undefined,
        shopId,
      })
      toast.success('Debt created successfully')
      setShowAddDebt(false)
      addDebtForm.reset({ type: 'customer_debt', entityId: '', amount: '' as unknown as number, dueDate: '', description: '' })
      fetchDebts()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setAddDebtSubmitting(false)
    }
  }

  const handleRecordPayment = async (data: DebtPaymentFormData) => {
    if (!selectedDebt || !orgId) return

    // Check payment doesn't exceed remaining
    const remaining = selectedDebt.amount - selectedDebt.paidAmount
    if (data.amount > remaining) {
      toast.error(`Payment cannot exceed remaining amount of ${formatETB(remaining)}`)
      return
    }

    setPaymentSubmitting(true)
    try {
      await api.addDebtPayment(selectedDebt.id, orgId, {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes || undefined,
      })
      toast.success('Payment recorded successfully')
      setShowRecordPayment(false)
      paymentForm.reset({ amount: '' as unknown as number, paymentMethod: 'cash', notes: '' })
      fetchDebts()
      // Refresh detail if open
      if (showDetail) {
        try {
          const data2 = await api.getDebts(orgId, {
            status: 'all',
            type: selectedDebt.type,
            limit: '100',
            shopId,
          })
          const updated = data2.debts.find((d) => d.id === selectedDebt.id)
          if (updated) setSelectedDebt(updated)
        } catch {
          // Silent — detail refresh failed, non-critical
        }
      }
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setPaymentSubmitting(false)
    }
  }

  const openRecordPayment = (debt: Debt) => {
    setSelectedDebt(debt)
    paymentForm.reset({ amount: '' as unknown as number, paymentMethod: 'cash', notes: '' })
    setShowRecordPayment(true)
  }

  const openDetail = (debt: Debt) => {
    setSelectedDebt(debt)
    setShowDetail(true)
  }

  const openAddDebt = () => {
    fetchEntities()
    addDebtForm.reset({ type: 'customer_debt', entityId: '', amount: '' as unknown as number, dueDate: '', description: '' })
    setShowAddDebt(true)
  }

  // ============================================
  // Render
  // ============================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Debts & Credits</h1>
          <p className="text-muted-foreground text-sm mt-1">Track customer and supplier debts, record payments</p>
        </div>
        <Button onClick={openAddDebt} className="gap-2">
          <Plus className="size-4" />
          Add Debt
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                <Users className="size-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customer Debts</p>
                <p className="text-xl sm:text-2xl font-bold">{formatETB(summary.totalCustomerDebt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                <Truck className="size-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Supplier Debts</p>
                <p className="text-xl sm:text-2xl font-bold">{formatETB(summary.totalSupplierDebt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overdue Debts</p>
                <p className="text-xl sm:text-2xl font-bold">{overdueCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <ArrowDownLeft className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Collected This Month</p>
                <p className="text-xl sm:text-2xl font-bold">{formatETB(collectedThisMonth)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="customer" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Users className="size-4" />
              <span className="hidden sm:inline">Customer</span> Debts
            </TabsTrigger>
            <TabsTrigger value="supplier" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Truck className="size-4" />
              <span className="hidden sm:inline">Supplier</span> Debts
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                aria-label="Search debts"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-48"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="customer">
          {loading ? (
            <DebtsTableSkeleton />
          ) : pageError && debts.length === 0 ? (
            <ErrorState title="Failed to load debts" message={pageError} onRetry={fetchDebts} />
          ) : (
            <DebtsTable
              debts={filteredDebts}
              loading={false}
              onRecordPayment={openRecordPayment}
              onViewDetail={openDetail}
              onAddDebt={() => setShowAddDebt(true)}
            />
          )}
        </TabsContent>
        <TabsContent value="supplier">
          {loading ? (
            <DebtsTableSkeleton />
          ) : pageError && debts.length === 0 ? (
            <ErrorState title="Failed to load debts" message={pageError} onRetry={fetchDebts} />
          ) : (
            <DebtsTable
              debts={filteredDebts}
              loading={false}
              onRecordPayment={openRecordPayment}
              onViewDetail={openDetail}
              onAddDebt={() => setShowAddDebt(true)}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Add Debt Dialog */}
      <Dialog open={showAddDebt} onOpenChange={setShowAddDebt}>
        <DialogContent className="sm:max-w-md w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle>Add New Debt</DialogTitle>
            <DialogDescription>Record a new customer or supplier debt</DialogDescription>
          </DialogHeader>
          <Form {...addDebtForm}>
            <form onSubmit={addDebtForm.handleSubmit(handleAddDebt)} className="space-y-4">
              <FormSelectField
                name="type"
                label="Debt Type"
                options={[
                  { value: 'customer_debt', label: 'Customer Debt' },
                  { value: 'supplier_debt', label: 'Supplier Debt' },
                ]}
                onValueChange={() => {
                  addDebtForm.setValue('entityId', '')
                }}
              />
              <FormSelectField
                name="entityId"
                label={debtType === 'customer_debt' ? 'Customer' : 'Supplier'}
                placeholder={`Select ${debtType === 'customer_debt' ? 'customer' : 'supplier'}...`}
                required
                options={
                  debtType === 'customer_debt'
                    ? customers.map((c) => ({ value: c.id, label: `${c.name}${c.phone ? ` (${c.phone})` : ''}` }))
                    : suppliers.map((s) => ({ value: s.id, label: `${s.name}${s.phone ? ` (${s.phone})` : ''}` }))
                }
              />
              <FormInputField
                name="amount"
                label="Amount (ETB)"
                placeholder="0.00"
                type="number"
                required
                min={0}
                step={0.01}
              />
              <FormInputField
                name="dueDate"
                label="Due Date (optional)"
                type="date"
              />
              <FormTextareaField
                name="description"
                label="Description"
                placeholder="Description of the debt..."
                rows={3}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddDebt(false)}>
                  Cancel
                </Button>
                <FormSubmitButton isLoading={addDebtSubmitting} loadingText="Saving...">
                  Save Debt
                </FormSubmitButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showRecordPayment} onOpenChange={setShowRecordPayment}>
        <DialogContent className="sm:max-w-md w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Record a payment for this debt</DialogDescription>
          </DialogHeader>
          {selectedDebt && (
            <Form {...paymentForm}>
              <form onSubmit={paymentForm.handleSubmit(handleRecordPayment)} className="space-y-4">
                <Card className="bg-muted/50">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Entity</span>
                      <span className="font-medium">
                        {selectedDebt.customer?.name || selectedDebt.supplier?.name || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Amount</span>
                      <span className="font-medium">{formatETB(selectedDebt.amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Already Paid</span>
                      <span className="font-medium text-emerald-600">{formatETB(selectedDebt.paidAmount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Remaining</span>
                      <span className="font-bold text-destructive">
                        {formatETB(selectedDebt.amount - selectedDebt.paidAmount)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <FormInputField
                  name="amount"
                  label="Payment Amount (ETB)"
                  placeholder="0.00"
                  type="number"
                  required
                  min={0}
                  max={selectedDebt.amount - selectedDebt.paidAmount}
                  step={0.01}
                />
                <FormSelectField
                  name="paymentMethod"
                  label="Payment Method"
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'card', label: 'Card' },
                    { value: 'mobile_money', label: 'Mobile Money' },
                  ]}
                />
                <FormTextareaField
                  name="notes"
                  label="Notes"
                  placeholder="Optional notes..."
                  rows={2}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowRecordPayment(false)}>
                    Cancel
                  </Button>
                  <FormSubmitButton isLoading={paymentSubmitting} loadingText="Recording...">
                    Record Payment
                  </FormSubmitButton>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Debt Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Debt Details</DialogTitle>
            <DialogDescription>View debt details and payment history</DialogDescription>
          </DialogHeader>
          {selectedDebt && (
            <div className="space-y-6">
              {/* Info */}
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Entity</span>
                    <span className="font-medium">
                      {selectedDebt.customer?.name || selectedDebt.supplier?.name || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Type</span>
                    <span className="font-medium capitalize">
                      {selectedDebt.type === 'customer_debt' ? 'Customer Debt' : 'Supplier Debt'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Total Amount</span>
                    <span className="font-medium">{formatETB(selectedDebt.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Paid</span>
                    <span className="font-medium text-emerald-600">{formatETB(selectedDebt.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Remaining</span>
                    <span className="font-bold">
                      {formatETB(selectedDebt.amount - selectedDebt.paidAmount)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Status</span>
                    {<StatusBadge status={selectedDebt.status} />}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Due Date</span>
                    <span className="font-medium">{formatDate(selectedDebt.dueDate)}</span>
                  </div>
                  {selectedDebt.description && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-sm">Description</span>
                      <span className="font-medium text-right max-w-[60%]">{selectedDebt.description}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Created</span>
                    <span className="font-medium">{formatDate(selectedDebt.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Payment History */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Wallet className="size-4" />
                  Payment History
                </h4>
                {selectedDebt.payments && selectedDebt.payments.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDebt.payments.map((payment: DebtPayment) => (
                      <div
                        key={payment.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      >
                        <div className="size-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                          <DollarSign className="size-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-emerald-600">
                              +{formatETB(payment.amount)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(payment.paidAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              {payment.paymentMethod}
                            </Badge>
                            {payment.notes && <span>{payment.notes}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No payments recorded yet
                  </p>
                )}
              </div>

              {/* Add payment button */}
              {selectedDebt.status !== 'paid' && (
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    setShowDetail(false)
                    openRecordPayment(selectedDebt)
                  }}
                >
                  <CreditCard className="size-4" />
                  Record Payment
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Debts Table Skeleton
// ============================================
function DebtsTableSkeleton() {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

// ============================================
// Debts Table Component
// ============================================
function DebtsTable({
  debts,
  loading,
  onRecordPayment,
  onViewDetail,
  onAddDebt,
}: {
  debts: Debt[]
  loading: boolean
  onRecordPayment: (debt: Debt) => void
  onViewDetail: (debt: Debt) => void
  onAddDebt: () => void
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (debts.length === 0) {
    return (
      <EmptyState
        title="No debts found"
        message="Create a new debt to start tracking."
        action={{ label: 'Add Debt', onClick: onAddDebt }}
      />
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debts.map((debt) => {
              const remaining = debt.amount - debt.paidAmount
              const overdue = isOverdue(debt)
              return (
                <TableRow key={debt.id}>
                  <TableCell className="font-medium">
                    {debt.customer?.name || debt.supplier?.name || '—'}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-muted-foreground">
                    {debt.description || '—'}
                  </TableCell>
                  <TableCell className="text-right">{formatETB(debt.amount)}</TableCell>
                  <TableCell className="text-right text-emerald-600">
                    {formatETB(debt.paidAmount)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={overdue ? 'text-red-600' : ''}>
                      {formatETB(remaining)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={overdue ? 'text-red-600 font-medium' : ''}>
                      {formatDate(debt.dueDate)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {overdue && debt.status !== 'paid'
                      ? <StatusBadge status="overdue" />
                      : <StatusBadge status={debt.status} />}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 sm:h-8 sm:w-8"
                        onClick={() => onViewDetail(debt)}
                        title="View Details"
                        aria-label={`View details for ${debt.customer?.name || debt.supplier?.name || 'debt'}`}
                      >
                        <Eye className="size-4" />
                      </Button>
                      {debt.status !== 'paid' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 sm:h-8 sm:w-8"
                          onClick={() => onRecordPayment(debt)}
                          title="Record Payment"
                          aria-label={`Record payment for ${debt.customer?.name || debt.supplier?.name || 'debt'}`}
                        >
                          <CreditCard className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        </div>
        {/* Mobile card view */}
        <div className="md:hidden space-y-3 p-3">
          {debts.map((debt) => {
            const remaining = debt.amount - debt.paidAmount
            const overdue = isOverdue(debt)
            return (
              <Card key={debt.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{debt.customer?.name || debt.supplier?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{debt.description || 'No description'}</p>
                  </div>
                  {overdue && debt.status !== 'paid'
                    ? <StatusBadge status="overdue" />
                    : <StatusBadge status={debt.status} />}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium">{formatETB(debt.amount)}</span></div>
                  <div><span className="text-muted-foreground">Remaining:</span> <span className={`font-bold ${overdue ? 'text-red-600' : ''}`}>{formatETB(remaining)}</span></div>
                  <div><span className="text-muted-foreground">Paid:</span> <span className="text-emerald-600">{formatETB(debt.paidAmount)}</span></div>
                  <div><span className="text-muted-foreground">Due:</span> <span className={overdue ? 'text-red-600 font-medium' : ''}>{formatDate(debt.dueDate)}</span></div>
                </div>
                {debt.status !== 'paid' && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={() => onViewDetail(debt)}>
                      <Eye className="size-3" /> Details
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={() => onRecordPayment(debt)}>
                      <CreditCard className="size-3" /> Pay
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

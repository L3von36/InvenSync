'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Users, UserPlus, Search, Eye, Pencil, Trash2,
  TrendingUp, CreditCard, Calendar, Mail, Phone, MapPin,
  ShoppingCart, DollarSign, UserCircle, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react'
import { api, type Customer, type Sale, type Debt } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { customerSchema, type CustomerFormData } from '@/lib/validations'
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Form } from '@/components/ui/form'
import { FormInputField, FormTextareaField, FormSubmitButton } from '@/components/shared/form-fields'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { getNetworkErrorMessage } from '@/lib/validation'
import { ErrorState, EmptyState } from '@/components/shared/error-states'

// ============================================
// Helpers
// ============================================
function formatETB(amount: number): string {
  return `ETB ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

// ============================================
// Main Component
// ============================================
export function CustomersPage() {
  const { currentOrg, currentShop } = useAuthStore()
  const orgId = currentOrg?.id || ''
  const shopId = currentShop?.id

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  // Dialogs
  const [showAddEdit, setShowAddEdit] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Form state
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
    },
  })

  // Customer detail data
  const [customerSales, setCustomerSales] = useState<Sale[]>([])
  const [customerDebts, setCustomerDebts] = useState<Debt[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [totalDebt, setTotalDebt] = useState(0)

  // Stats
  const [newThisMonth, setNewThisMonth] = useState(0)

  const fetchCustomers = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setPageError(null)
    try {
      const data = await api.getCustomers(orgId, {
        search: searchQuery || undefined,
        page,
        limit,
        shopId,
      })
      setCustomers(data.customers)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)

      // Calculate new this month from all customers (fetch all)
      if (page === 1 && !searchQuery) {
        try {
          const allData = await api.getCustomers(orgId, { limit: 100, shopId })
          const now = new Date()
          const newCount = allData.customers.filter((c) => {
            const created = new Date(c.createdAt)
            return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
          }).length
          setNewThisMonth(newCount)

          // Total debt from debts API
          const debtsData = await api.getDebts(orgId, { type: 'customer_debt', status: 'all', limit: '100', shopId })
          const outstandingDebt = debtsData.debts
            .filter((d) => d.status !== 'paid')
            .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
          setTotalDebt(outstandingDebt)
        } catch {
          // Partial data load — stats may be incomplete but customers still show
        }
      }
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setPageError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [orgId, searchQuery, page, shopId])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  // Reset page when search changes
  useEffect(() => {
    setPage(1)
  }, [searchQuery])

  // ============================================
  // Handlers
  // ============================================
  const openAddDialog = () => {
    setIsEditing(false)
    setSelectedCustomer(null)
    form.reset({ name: '', email: '', phone: '', address: '' })
    setShowAddEdit(true)
  }

  const openEditDialog = (customer: Customer) => {
    setIsEditing(true)
    setSelectedCustomer(customer)
    form.reset({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
    })
    setShowAddEdit(true)
  }

  const handleSave = async (data: CustomerFormData) => {
    if (!orgId) return

    setFormSubmitting(true)
    try {
      if (isEditing && selectedCustomer) {
        await api.updateCustomer(selectedCustomer.id, orgId, {
          name: data.name.trim(),
          email: data.email?.trim() || undefined,
          phone: data.phone?.trim() || undefined,
          address: data.address?.trim() || undefined,
        })
        toast.success('Customer updated successfully')
      } else {
        await api.createCustomer(orgId, {
          name: data.name.trim(),
          email: data.email?.trim() || undefined,
          phone: data.phone?.trim() || undefined,
          address: data.address?.trim() || undefined,
          shopId,
        })
        toast.success('Customer created successfully')
      }
      setShowAddEdit(false)
      fetchCustomers()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setFormSubmitting(false)
    }
  }

  const openDeleteConfirm = (customer: Customer) => {
    setSelectedCustomer(customer)
    setShowDeleteConfirm(true)
  }

  const handleDelete = async () => {
    if (!selectedCustomer || !orgId) return
    setDeleting(true)
    try {
      await api.deleteCustomer(selectedCustomer.id, orgId)
      toast.success('Customer deleted successfully')
      setShowDeleteConfirm(false)
      setSelectedCustomer(null)
      fetchCustomers()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const openDetail = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setShowDetail(true)
    setDetailLoading(true)
    try {
      // Fetch sales for this customer
      const salesData = await api.getSales(orgId, { limit: 50, shopId })
      const filteredSales = salesData.sales.filter((s) => s.customerId === customer.id)
      setCustomerSales(filteredSales)

      // Fetch debts for this customer
      const debtsData = await api.getDebts(orgId, { type: 'customer_debt', limit: '100', shopId })
      const filteredDebts = debtsData.debts.filter((d) => d.customerId === customer.id)
      setCustomerDebts(filteredDebts)
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setDetailLoading(false)
    }
  }

  // Calculate active this month (customers with sales this month)
  const activeThisMonth = customers.filter((c) => {
    return c._count && c._count.sales > 0
  }).length

  // ============================================
  // Render
  // ============================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm">Manage your customer database and track purchase history</p>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <UserPlus className="size-4" />
          Add Customer
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <p className="text-xl sm:text-2xl font-bold">{total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                <TrendingUp className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active This Month</p>
                <p className="text-xl sm:text-2xl font-bold">{activeThisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <CreditCard className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Debt</p>
                <p className="text-xl sm:text-2xl font-bold">{formatETB(totalDebt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Calendar className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">New This Month</p>
                <p className="text-xl sm:text-2xl font-bold">{newThisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            aria-label="Search customers"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : pageError && customers.length === 0 ? (
        <ErrorState title="Failed to load customers" message={pageError} onRetry={fetchCustomers} />
      ) : customers.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No customers match your search' : 'No customers yet'}
          message={searchQuery ? 'Try a different search term' : 'Add your first customer to get started.'}
          icon={<Users className="size-7 text-muted-foreground" />}
          action={!searchQuery ? { label: 'Add Customer', onClick: openAddDialog } : undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden lg:table-cell">Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Purchases</TableHead>
                    <TableHead className="text-right">Outstanding Debt</TableHead>
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(customer)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <UserCircle className="size-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-xs text-muted-foreground md:hidden">
                              {customer.email || customer.phone || ''}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {customer.email || '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {customer.phone || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right">
                        <Badge variant="secondary">
                          {customer._count?.sales || 0} sales
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                          {formatETB(0)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {formatDate(customer.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 sm:h-8 sm:w-8"
                            onClick={() => openDetail(customer)}
                            title="View Details"
                            aria-label={`View ${customer.name}`}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 sm:h-8 sm:w-8"
                            onClick={() => openEditDialog(customer)}
                            title="Edit"
                            aria-label={`Edit ${customer.name}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                            onClick={() => openDeleteConfirm(customer)}
                            title="Delete"
                            aria-label={`Delete ${customer.name}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile card view */}
            <div className="md:hidden space-y-3 p-3">
              {customers.map((customer) => (
                <Card
                  key={customer.id}
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => openDetail(customer)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <UserCircle className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{customer.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{customer.email || customer.phone || 'No contact'}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 shrink-0 text-xs">
                      {formatETB(0)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">{customer._count?.sales || 0} sales</span>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => openEditDialog(customer)}><Pencil className="size-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => openDeleteConfirm(customer)}><Trash2 className="size-3.5" /></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-9 min-w-9 sm:min-w-auto"
            >
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline ml-1">Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-9 min-w-9 sm:min-w-auto"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add/Edit Customer Dialog */}
      <Dialog open={showAddEdit} onOpenChange={setShowAddEdit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update customer information' : 'Enter details for the new customer'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
              <FormInputField
                name="name"
                label="Name"
                placeholder="Customer name"
                required
              />
              <FormInputField
                name="email"
                label="Email"
                placeholder="customer@email.com"
                type="email"
              />
              <FormInputField
                name="phone"
                label="Phone"
                placeholder="+251 9XX XXX XXXX"
                type="tel"
              />
              <FormTextareaField
                name="address"
                label="Address"
                placeholder="Customer address..."
                rows={3}
              />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setShowAddEdit(false)}>
                  Cancel
                </Button>
                <FormSubmitButton isLoading={formSubmitting} loadingText={isEditing ? 'Updating...' : 'Saving...'}>
                  {isEditing ? 'Update Customer' : 'Add Customer'}
                </FormSubmitButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedCustomer?.name}</strong>?
              This action cannot be undone. The customer and all their data will be permanently deleted.
              Any associated sales records will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-6">
              {/* Info Card */}
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <UserCircle className="size-7 text-primary" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold">{selectedCustomer.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          Customer since {formatDate(selectedCustomer.createdAt)}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedCustomer.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="size-4 text-muted-foreground" />
                            <span>{selectedCustomer.email}</span>
                          </div>
                        )}
                        {selectedCustomer.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="size-4 text-muted-foreground" />
                            <span>{selectedCustomer.phone}</span>
                          </div>
                        )}
                        {selectedCustomer.address && (
                          <div className="flex items-start gap-2 text-sm sm:col-span-2">
                            <MapPin className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                            <span>{selectedCustomer.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <ShoppingCart className="size-6 text-primary mx-auto mb-2" />
                    <p className="text-sm font-semibold">{selectedCustomer._count?.sales || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Purchases</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <DollarSign className="size-6 text-red-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold">
                      {formatETB(
                        customerDebts
                          .filter((d) => d.status !== 'paid')
                          .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">Outstanding Debt</p>
                  </CardContent>
                </Card>
              </div>

              {detailLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Debt Summary */}
                  {customerDebts.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <CreditCard className="size-4" />
                        Debt Summary
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {customerDebts.map((debt) => {
                          const remaining = debt.amount - debt.paidAmount
                          return (
                            <div key={debt.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                              <div>
                                <p className="text-sm font-medium">{debt.description || 'Debt'}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(debt.createdAt)} · {debt.status}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold">
                                  {formatETB(remaining)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  of {formatETB(debt.amount)}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Purchase History */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <ShoppingCart className="size-4" />
                      Purchase History
                    </h4>
                    {customerSales.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No purchases yet
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {customerSales.map((sale) => (
                          <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                            <div>
                              <p className="text-sm font-medium">{sale.invoiceNumber}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(sale.saleDate)} · {sale.items?.length || 0} items
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold">{formatETB(sale.total)}</p>
                              <Badge
                                variant="outline"
                                className={
                                  sale.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700'
                                    : sale.status === 'pending'
                                    ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700'
                                    : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
                                }
                              >
                                {sale.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    setShowDetail(false)
                    openEditDialog(selectedCustomer)
                  }}
                >
                  <Pencil className="size-4" />
                  Edit Customer
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 text-destructive hover:text-destructive"
                  onClick={() => {
                    setShowDetail(false)
                    openDeleteConfirm(selectedCustomer)
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

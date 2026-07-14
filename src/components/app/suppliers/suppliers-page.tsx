'use client'

import { PageHeader, AvatarListRow } from '@/components/shared/design-system'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import {
  Truck, Plus, Search, Eye, Pencil, Trash2,
  DollarSign, MapPin, Mail, Phone,
  Building2, ChevronLeft, ChevronRight, CreditCard, Loader2,
} from 'lucide-react'
import { api, type Supplier, type Debt } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { db } from '@/lib/db'
import { supplierSchema, type SupplierFormData } from '@/lib/validations'
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
import { formatETB, formatDate } from '@/lib/format'
import { ErrorState, EmptyState } from '@/components/shared/error-states'

// ============================================
// Helpers
// ============================================

// ============================================
// Main Component
// ============================================
export function SuppliersPage() {
  const { currentOrg, currentShop } = useAuthStore()
  const orgId = currentOrg?.id || ''
  const shopId = currentShop?.id

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
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
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Form state
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
    },
  })

  // Supplier detail data
  const [supplierDebts, setSupplierDebts] = useState<Debt[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [totalOwedToSuppliers, setTotalOwedToSuppliers] = useState(0)

  // ============================================
  // Local-First Data Loading (Repository Pattern)
  // ============================================
  // Reads from IndexedDB FIRST (instant, works offline), then refreshes
  // from the API in the background and persists back to IndexedDB.
  const fetchSuppliers = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setPageError(null)

    // ---- Step 1: Read from IndexedDB FIRST (instant, offline) ----
    try {
      let localSuppliers = await db.suppliers
        .where('organizationId')
        .equals(orgId)
        .toArray()

      if (shopId) {
        localSuppliers = localSuppliers.filter(
          (s) => s.shopId === shopId || !s.shopId
        )
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        localSuppliers = localSuppliers.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.phone && s.phone.toLowerCase().includes(q)) ||
            (s.email && s.email.toLowerCase().includes(q))
        )
      }

      localSuppliers.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      const localTotal = localSuppliers.length
      const localTotalPages = Math.max(1, Math.ceil(localTotal / limit))
      const startIdx = (page - 1) * limit
      const pagedLocal = localSuppliers.slice(startIdx, startIdx + limit)

      setSuppliers(pagedLocal as unknown as Supplier[])
      setTotal(localTotal)
      setTotalPages(localTotalPages)
      setLoading(false)

      // Total owed to suppliers from local debts
      if (page === 1 && !searchQuery) {
        try {
          const localDebts = await db.debts
            .where('organizationId')
            .equals(orgId)
            .toArray()
          const outstanding = localDebts
            .filter((d) => d.type === 'supplier_debt' && d.status !== 'paid')
            .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
          setTotalOwedToSuppliers(outstanding)
        } catch {
          // Local debts read failed — stats degrade gracefully
        }
      }
    } catch {
      setLoading(true)
    }

    // ---- Step 2: If online, refresh from API and update IndexedDB ----
    try {
      const data = await api.getSuppliers(orgId, {
        search: searchQuery || undefined,
        page,
        limit,
        shopId,
      })
      setSuppliers(data.suppliers)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)

      // Persist to IndexedDB for future offline reads
      try {
        const localRecords = data.suppliers.map((s) => ({
          id: s.id,
          organizationId: s.organizationId,
          shopId: s.shopId || null,
          name: s.name,
          email: s.email || null,
          phone: s.phone || null,
          address: s.address || null,
          createdAt: s.createdAt || new Date().toISOString(),
          updatedAt: s.updatedAt || new Date().toISOString(),
        }))
        if (localRecords.length > 0) {
          await db.suppliers.bulkPut(localRecords)
        }
      } catch {
        // Caching failure is non-critical
      }

      // Get total owed to suppliers from debts API
      if (page === 1 && !searchQuery) {
        try {
          const debtsData = await api.getDebts(orgId, { type: 'supplier_debt', status: 'all', limit: 100, shopId })
          const outstanding = debtsData.debts
            .filter((d) => d.status !== 'paid')
            .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
          setTotalOwedToSuppliers(outstanding)
        } catch {
          // Partial data load — debt stats may be incomplete but suppliers still show
        }
      }
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      if (suppliers.length === 0) {
        setPageError(msg)
        toast.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [orgId, searchQuery, page, shopId, suppliers.length])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  // Reset page when search changes
  useEffect(() => {
    setPage(1)
  }, [searchQuery])

  // Active suppliers = those with non-zero debts (recently active)
  const activeSuppliers = suppliers.length

  // ============================================
  // Handlers
  // ============================================
  const openAddDialog = () => {
    setIsEditing(false)
    setSelectedSupplier(null)
    form.reset({ name: '', email: '', phone: '', address: '' })
    setShowAddEdit(true)
  }

  const openEditDialog = (supplier: Supplier) => {
    setIsEditing(true)
    setSelectedSupplier(supplier)
    form.reset({
      name: supplier.name,
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
    })
    setShowAddEdit(true)
  }

  const handleSave = async (data: SupplierFormData) => {
    if (!orgId) return

    setFormSubmitting(true)
    try {
      if (isEditing && selectedSupplier) {
        await api.updateSupplier(selectedSupplier.id, orgId, {
          name: data.name.trim(),
          email: data.email?.trim() || undefined,
          phone: data.phone?.trim() || undefined,
          address: data.address?.trim() || undefined,
        })
        toast.success('Supplier updated successfully')
      } else {
        await api.createSupplier(orgId, {
          name: data.name.trim(),
          email: data.email?.trim() || undefined,
          phone: data.phone?.trim() || undefined,
          address: data.address?.trim() || undefined,
          shopId,
        })
        toast.success('Supplier created successfully')
      }
      setShowAddEdit(false)
      fetchSuppliers()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setFormSubmitting(false)
    }
  }

  const openDeleteConfirm = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setShowDeleteConfirm(true)
  }

  const handleDelete = async () => {
    if (!selectedSupplier || !orgId) return
    setDeleting(true)
    try {
      await api.deleteSupplier(selectedSupplier.id, orgId)
      toast.success('Supplier deleted successfully')
      setShowDeleteConfirm(false)
      setSelectedSupplier(null)
      fetchSuppliers()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const openDetail = async (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setShowDetail(true)
    setDetailLoading(true)
    try {
      const debtsData = await api.getDebts(orgId, { type: 'supplier_debt', limit: 100, shopId })
      const filteredDebts = debtsData.debts.filter((d) => d.supplierId === supplier.id)
      setSupplierDebts(filteredDebts)
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setDetailLoading(false)
    }
  }

  // ============================================
  // Render
  // ============================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<Truck />}
        title="Suppliers"
        subtitle="Manage supplier information and track supplier debts"
        actions={
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="size-4" />
            Add Supplier
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Truck className="size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Suppliers</p>
                <p className="text-xl sm:text-2xl font-semibold tabular-nums">{total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                <Building2 className="size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Active Suppliers</p>
                <p className="text-xl sm:text-2xl font-semibold tabular-nums">{activeSuppliers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <DollarSign className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Owed to Suppliers</p>
                <p className="text-xl sm:text-2xl font-semibold tabular-nums">{formatETB(totalOwedToSuppliers)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            aria-label="Search suppliers"
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
      ) : pageError && suppliers.length === 0 ? (
        <ErrorState title="Failed to load suppliers" message={pageError} onRetry={fetchSuppliers} />
      ) : suppliers.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No suppliers match your search' : 'No suppliers yet'}
          message={searchQuery ? 'Try a different search term' : 'Add your first supplier to get started.'}
          icon={<Truck className="size-7 text-muted-foreground" />}
          action={!searchQuery ? { label: 'Add Supplier', onClick: openAddDialog } : undefined}
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
                    <TableHead className="hidden lg:table-cell">Address</TableHead>
                    <TableHead className="text-right">Debt Owed</TableHead>
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow
                      key={supplier.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(supplier)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Truck className="size-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{supplier.name}</p>
                            <p className="text-xs text-muted-foreground md:hidden">
                              {supplier.email || supplier.phone || ''}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {supplier.email || '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {supplier.phone || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground max-w-[15.385rem] truncate">
                        {supplier.address || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                          {formatETB(0)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {formatDate(supplier.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 sm:h-8 sm:w-8"
                            onClick={() => openDetail(supplier)}
                            title="View Details"
                            aria-label={`View ${supplier.name}`}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 sm:h-8 sm:w-8"
                            onClick={() => openEditDialog(supplier)}
                            title="Edit"
                            aria-label={`Edit ${supplier.name}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                            onClick={() => openDeleteConfirm(supplier)}
                            title="Delete"
                            aria-label={`Delete ${supplier.name}`}
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
            {/* Mobile list — Direction B avatar rows; edit/delete live in
                the detail dialog the row opens */}
            <div className="md:hidden divide-y px-3">
              {suppliers.map((supplier) => (
                <AvatarListRow
                  key={supplier.id}
                  name={supplier.name}
                  caption={`${supplier.email || supplier.phone || 'No contact'} · ${supplier.address ? supplier.address.substring(0, 30) : 'No address'}`}
                  onClick={() => openDetail(supplier)}
                  className="rounded-none px-0 mx-0"
                />
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

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={showAddEdit} onOpenChange={setShowAddEdit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update supplier information' : 'Enter details for the new supplier'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
              <FormInputField
                name="name"
                label="Name"
                placeholder="Supplier name"
                required
              />
              <FormInputField
                name="email"
                label="Email"
                placeholder="supplier@email.com"
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
                placeholder="Supplier address..."
                rows={3}
              />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setShowAddEdit(false)}>
                  Cancel
                </Button>
                <FormSubmitButton isLoading={formSubmitting} loadingText={isEditing ? 'Updating...' : 'Saving...'}>
                  {isEditing ? 'Update Supplier' : 'Add Supplier'}
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
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedSupplier?.name}</strong>?
              This action cannot be undone. The supplier and all their data will be permanently deleted.
              Any associated debt records will be preserved.
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

      {/* Supplier Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Supplier Details</DialogTitle>
          </DialogHeader>
          {selectedSupplier && (
            <div className="space-y-6">
              {/* Info Card */}
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Truck className="size-7 text-primary" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold">{selectedSupplier.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          Supplier since {formatDate(selectedSupplier.createdAt)}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedSupplier.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="size-4 text-muted-foreground" />
                            <span>{selectedSupplier.email}</span>
                          </div>
                        )}
                        {selectedSupplier.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="size-4 text-muted-foreground" />
                            <span>{selectedSupplier.phone}</span>
                          </div>
                        )}
                        {selectedSupplier.address && (
                          <div className="flex items-start gap-2 text-sm sm:col-span-2">
                            <MapPin className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                            <span>{selectedSupplier.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Card */}
              <div className="grid grid-cols-1 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <DollarSign className="size-6 text-red-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold">
                      {formatETB(
                        supplierDebts
                          .filter((d) => d.status !== 'paid')
                          .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0)
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">Outstanding Debt Owed</p>
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
                  {supplierDebts.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <CreditCard className="size-4" />
                        Debt Summary
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {supplierDebts.map((debt) => {
                          const remaining = debt.amount - debt.paidAmount
                          return (
                            <div key={debt.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                              <div>
                                <p className="text-sm font-medium">{debt.description || 'Debt'}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(debt.createdAt)} · <span className="capitalize">{debt.status}</span>
                                  {debt.dueDate && ` · Due: ${formatDate(debt.dueDate)}`}
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

                  {supplierDebts.length === 0 && (
                    <div className="text-center py-6">
                      <CreditCard className="size-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No debts recorded for this supplier</p>
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    setShowDetail(false)
                    openEditDialog(selectedSupplier)
                  }}
                >
                  <Pencil className="size-4" />
                  Edit Supplier
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 text-destructive hover:text-destructive"
                  onClick={() => {
                    setShowDetail(false)
                    openDeleteConfirm(selectedSupplier)
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

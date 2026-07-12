'use client'

import { PageHeader } from '@/components/shared/design-system'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import {
  Clock, DollarSign, Plus, Pencil, Trash2, Calendar,
  CheckCircle2, XCircle, Loader2, Search, Phone,
  Wrench, CalendarDays, AlertCircle, EyeOff, Image as ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, type ServiceType, type ServiceBooking } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getNetworkErrorMessage } from '@/lib/validation'
import { serviceTypeSchema, type ServiceTypeFormData, bookingSchema, type BookingFormData } from '@/lib/validations'
import { ErrorState } from '@/components/shared/error-states'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { FormInputField, FormTextareaField, FormSubmitButton } from '@/components/shared/form-fields'

// ============================================
// Helpers
// ============================================
import { formatETB } from '@/lib/format'

function bookingStatusBadge(status: string) {
  switch (status) {
    case 'scheduled': return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Scheduled</Badge>
    case 'completed': return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Completed</Badge>
    case 'cancelled': return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">Cancelled</Badge>
    case 'no_show': return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300">No Show</Badge>
    default: return <Badge variant="outline">{status}</Badge>
  }
}

function formatBookingDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function addMinutesToTime(time: string | undefined | null, minutes: number): string {
  if (!time) return '0:00'
  const [h, m] = time.split(':').map(Number)
  const totalMinutes = (h * 60 + m + minutes) % (24 * 60)
  const newH = Math.floor(totalMinutes / 60)
  const newM = totalMinutes % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}

// ============================================
// Service Type Dialog
// ============================================
function ServiceTypeDialog({
  open,
  onOpenChange,
  serviceType,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  serviceType: ServiceType | null
  onSaved: () => void
}) {
  const { currentOrg } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const isEditing = !!serviceType

  const form = useForm<ServiceTypeFormData>({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: {
      name: '',
      description: '',
      duration: 30,
      price: 0,
      imageUrl: '',
    },
  })

  useEffect(() => {
    if (open) {
      if (serviceType) {
        form.reset({
          name: serviceType.name,
          description: serviceType.description || '',
          duration: serviceType.duration,
          price: serviceType.price,
          imageUrl: serviceType.imageUrl || '',
        })
      } else {
        form.reset({
          name: '',
          description: '',
          duration: 30,
          price: 0,
          imageUrl: '',
        })
      }
    }
  }, [open, serviceType, form])

  const handleSave = async (data: ServiceTypeFormData) => {
    if (!currentOrg) return
    setSaving(true)
    try {
      if (isEditing && serviceType) {
        await api.updateServiceType(serviceType.id, currentOrg.id, {
          name: data.name.trim(),
          description: data.description?.trim() || undefined,
          duration: data.duration ?? 30,
          price: data.price ?? 0,
          imageUrl: data.imageUrl?.trim() || undefined,
        })
        toast.success('Service type updated')
      } else {
        await api.createServiceType(currentOrg.id, {
          name: data.name.trim(),
          description: data.description?.trim() || undefined,
          duration: data.duration ?? 30,
          price: data.price ?? 0,
          imageUrl: data.imageUrl?.trim() || undefined,
        })
        toast.success('Service type created')
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Service Type' : 'Add Service Type'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the service details' : 'Define a new service you offer'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <FormInputField name="name" label="Service Name" placeholder="e.g., Haircut, Consultation" required />
            <FormTextareaField name="description" label="Description" placeholder="Brief description of this service..." rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <FormInputField name="duration" label="Duration (min)" type="number" min={5} />
              <FormInputField name="price" label="Price (ETB)" type="number" min={0} step="0.01" placeholder="0.00" />
            </div>
            <FormInputField name="imageUrl" label={<span className="flex items-center gap-1.5"><ImageIcon className="size-3.5" /> Image URL</span>} placeholder="https://example.com/image.jpg" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <FormSubmitButton isLoading={saving} loadingText={isEditing ? 'Saving...' : 'Creating...'}>
                {isEditing ? 'Save' : 'Create'}
              </FormSubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Booking Dialog
// ============================================
function BookingDialog({
  open,
  onOpenChange,
  serviceTypes,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  serviceTypes: ServiceType[]
  onSaved: () => void
}) {
  const { currentOrg, currentShop } = useAuthStore()
  const [saving, setSaving] = useState(false)

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      serviceTypeId: '',
      customerName: '',
      customerPhone: '',
      bookingDate: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '09:30',
      notes: '',
    },
  })

  const watchedServiceTypeId = form.watch('serviceTypeId')
  const watchedStartTime = form.watch('startTime')
  const selectedService = serviceTypes.find(st => st.id === watchedServiceTypeId)

  // Auto-calculate end time when service or start time changes
  useEffect(() => {
    if (selectedService && watchedStartTime) {
      form.setValue('endTime', addMinutesToTime(watchedStartTime, selectedService.duration))
    }
  }, [selectedService, watchedStartTime, form])

  useEffect(() => {
    if (open) {
      form.reset({
        serviceTypeId: '',
        customerName: '',
        customerPhone: '',
        bookingDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '09:30',
        notes: '',
      })
    }
  }, [open, form])

  const handleSave = async (data: BookingFormData) => {
    if (!currentOrg) return
    setSaving(true)
    try {
      await api.createServiceBooking(currentOrg.id, {
        serviceTypeId: data.serviceTypeId,
        customerName: data.customerName.trim(),
        customerPhone: data.customerPhone?.trim() || undefined,
        bookingDate: data.bookingDate,
        startTime: data.startTime,
        endTime: data.endTime || addMinutesToTime(data.startTime, selectedService?.duration || 30),
        notes: data.notes?.trim() || undefined,
        shopId: currentShop?.id,
      })
      toast.success('Booking created')
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const activeServiceTypes = serviceTypes.filter(st => st.isActive)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Booking</DialogTitle>
          <DialogDescription>Schedule a new service appointment</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <FormField
              name="serviceTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeServiceTypes.map(st => (
                        <SelectItem key={st.id} value={st.id}>
                          {st.name} — {formatETB(st.price)} ({st.duration} min)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInputField name="customerName" label="Customer Name" placeholder="Customer name" required />
              <FormInputField name="customerPhone" label="Phone" placeholder="+251 9XX..." type="tel" />
            </div>
            <FormInputField name="bookingDate" label="Date" type="date" required />
            <div className="grid grid-cols-2 gap-3">
              <FormInputField name="startTime" label="Start Time" type="time" required />
              <FormField
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="time" value={field.value || ''} onChange={(e) => field.onChange(e.target.value)} />
                    </FormControl>
                    {selectedService && (
                      <p className="text-[11px] text-muted-foreground">Auto-calculated from duration ({selectedService.duration} min)</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormTextareaField name="notes" label="Notes" placeholder="Optional notes..." rows={2} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <FormSubmitButton isLoading={saving} loadingText="Booking...">Book</FormSubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Service Types Tab
// ============================================
function ServiceTypesTab({ orgId, onRefresh }: { orgId: string; onRefresh: () => void }) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<ServiceType | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setFetchError(null)
      const data = await api.getServiceTypes(orgId)
      setServiceTypes(data.serviceTypes || [])
    } catch (err) {
      setFetchError(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleToggle = async (st: ServiceType) => {
    try {
      await api.updateServiceType(st.id, orgId, { isActive: !st.isActive })
      toast.success(st.isActive ? 'Service deactivated' : 'Service activated')
      fetchData()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.deleteServiceType(deleteId, orgId)
      toast.success('Service type deleted')
      setDeleteId(null)
      fetchData()
      onRefresh()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
      </div>
    )
  }

  if (fetchError) {
    return <ErrorState title="Failed to load service types" error={fetchError} onRetry={fetchData} />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingType(null); setDialogOpen(true) }} className="gap-2">
          <Plus className="size-4" /> Add Service Type
        </Button>
      </div>

      {serviceTypes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wrench className="size-12 text-muted-foreground mx-auto mb-4" />
            <p className="font-medium text-muted-foreground">No service types yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first service type to get started</p>
            <Button className="mt-4 gap-2" onClick={() => { setEditingType(null); setDialogOpen(true) }}>
              <Plus className="size-4" /> Add Service Type
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {serviceTypes.map(st => (
            <Card key={st.id} className={`transition-opacity ${!st.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold truncate">{st.name}</h4>
                    {st.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{st.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="size-3.5" /> {st.duration} min</span>
                      <span className="flex items-center gap-1"><DollarSign className="size-3.5" /> {formatETB(st.price)}</span>
                    </div>
                  </div>
                  <Switch checked={st.isActive} onCheckedChange={() => handleToggle(st)} />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={st.isActive ? 'default' : 'secondary'} className="text-xs">
                    {st.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="gap-1 flex-1" onClick={() => { setEditingType(st); setDialogOpen(true) }}>
                    <Pencil className="size-3" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive gap-1" onClick={() => setDeleteId(st.id)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ServiceTypeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        serviceType={editingType}
        onSaved={() => { fetchData(); onRefresh() }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service type? This action cannot be undone.
              The service type and all its configuration will be permanently deleted.
              Any existing bookings using this service type will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================
// Bookings Tab
// ============================================
function BookingsTab({ orgId, shopId, serviceTypes }: { orgId: string; shopId?: string; serviceTypes: ServiceType[] }) {
  const [bookings, setBookings] = useState<ServiceBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null)

  const fetchBookings = useCallback(async () => {
    try {
      setFetchError(null)
      const data = await api.getServiceBookings(orgId, {
        date: dateFilter || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        shopId,
      })
      setBookings(data.bookings || [])
    } catch (err) {
      setFetchError(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [orgId, dateFilter, statusFilter, shopId])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  const handleStatusUpdate = async (bookingId: string, status: string) => {
    setUpdatingBookingId(bookingId)
    try {
      await api.updateServiceBooking(bookingId, orgId, { status })
      toast.success('Booking updated')
      fetchBookings()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setUpdatingBookingId(null)
    }
  }

  // Quick stats
  const todayScheduled = bookings.filter(b => b.status === 'scheduled').length
  const todayCompleted = bookings.filter(b => b.status === 'completed').length
  const todayCancelled = bookings.filter(b => b.status === 'cancelled').length

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
  }

  if (fetchError) {
    return <ErrorState title="Failed to load bookings" error={fetchError} onRetry={fetchBookings} />
  }

  return (
    <div className="space-y-4">
      {/* Today's date display */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            {dateFilter ? formatBookingDate(dateFilter) : 'All Bookings'}
          </h3>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="size-4" /> New Booking
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-sm font-semibold text-blue-600">{todayScheduled}</p>
            <p className="text-xs text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-sm font-semibold text-emerald-600">{todayCompleted}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-sm font-semibold text-red-600">{todayCancelled}</p>
            <p className="text-xs text-muted-foreground">Cancelled</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full sm:w-44" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="no_show">No Show</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="size-12 text-muted-foreground mx-auto mb-4" />
            <p className="font-medium text-muted-foreground">No bookings found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {dateFilter ? `No bookings for ${formatBookingDate(dateFilter)}` : 'Create your first booking'}
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Desktop table + Mobile cards */
        <>
          <div className="hidden md:block">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Customer</th>
                    <th className="text-left p-3 text-sm font-medium">Service</th>
                    <th className="text-left p-3 text-sm font-medium">Time</th>
                    <th className="text-left p-3 text-sm font-medium">Status</th>
                    <th className="text-right p-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bookings.map(b => (
                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div className="font-medium text-sm">{b.customerName}</div>
                        {b.customerPhone && <div className="text-xs text-muted-foreground">{b.customerPhone}</div>}
                      </td>
                      <td className="p-3 text-sm">{b.serviceType?.name || '—'}</td>
                      <td className="p-3 text-sm whitespace-nowrap">{b.startTime} — {b.endTime}</td>
                      <td className="p-3">{bookingStatusBadge(b.status)}</td>
                      <td className="p-3 text-right">
                        {b.status === 'scheduled' && (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" className="text-primary gap-1 h-7 text-xs" onClick={() => handleStatusUpdate(b.id, 'completed')} disabled={updatingBookingId === b.id}>
                              {updatingBookingId === b.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />} Done
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 gap-1 h-7 text-xs" onClick={() => handleStatusUpdate(b.id, 'cancelled')} disabled={updatingBookingId === b.id}>
                              <XCircle className="size-3" /> Cancel
                            </Button>
                            <Button size="sm" variant="outline" className="text-gray-600 gap-1 h-7 text-xs" onClick={() => handleStatusUpdate(b.id, 'no_show')} disabled={updatingBookingId === b.id}>
                              <EyeOff className="size-3" /> No Show
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="md:hidden space-y-3">
            {bookings.map(b => (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-sm">{b.customerName}</h4>
                    {b.customerPhone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="size-3" />{b.customerPhone}</p>}
                  </div>
                  {bookingStatusBadge(b.status)}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Wrench className="size-3" />{b.serviceType?.name || '—'}</span>
                  <span className="flex items-center gap-1"><Clock className="size-3" />{b.startTime} — {b.endTime}</span>
                </div>
                {b.status === 'scheduled' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-primary gap-1 flex-1 h-8 text-xs" onClick={() => handleStatusUpdate(b.id, 'completed')} disabled={updatingBookingId === b.id}>
                      {updatingBookingId === b.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />} Complete
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 gap-1 flex-1 h-8 text-xs" onClick={() => handleStatusUpdate(b.id, 'cancelled')} disabled={updatingBookingId === b.id}>
                      <XCircle className="size-3" /> Cancel
                    </Button>
                    <Button size="sm" variant="outline" className="text-gray-600 gap-1 h-8 text-xs" onClick={() => handleStatusUpdate(b.id, 'no_show')} disabled={updatingBookingId === b.id}>
                      <EyeOff className="size-3" />
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      <BookingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        serviceTypes={serviceTypes}
        onSaved={fetchBookings}
      />
    </div>
  )
}

// ============================================
// Main Services Page
// ============================================
export function ServicesPage() {
  const { currentOrg, currentShop } = useAuthStore()
  const orgId = currentOrg?.id || ''
  const shopId = currentShop?.id
  const [activeTab, setActiveTab] = useState('service-types')
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchServiceTypes = useCallback(async () => {
    if (!orgId) return
    try {
      const data = await api.getServiceTypes(orgId)
      setServiceTypes(data.serviceTypes || [])
    } catch {
      // silent - error handled in child tabs
    }
  }, [orgId])

  useEffect(() => { fetchServiceTypes() }, [fetchServiceTypes, refreshKey]) // eslint-disable-line react-hooks/set-state-in-effect

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<Wrench />}
        title="Services"
        subtitle="Manage service types and bookings"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="service-types" className="gap-2">
            <Wrench className="size-4" />
            <span className="hidden sm:inline">Service Types</span>
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-2">
            <CalendarDays className="size-4" />
            <span className="hidden sm:inline">Bookings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="service-types" className="mt-4">
          <ServiceTypesTab orgId={orgId} onRefresh={() => setRefreshKey(k => k + 1)} />
        </TabsContent>

        <TabsContent value="bookings" className="mt-4">
          <BookingsTab orgId={orgId} shopId={shopId} serviceTypes={serviceTypes} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

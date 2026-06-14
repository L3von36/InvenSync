'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import {
  Plus, Trash2, Loader2, RefreshCw, Clock, Send,
  CalendarDays, FileText, Mail, MessageCircle, Phone,
  ToggleLeft, ToggleRight, AlertCircle,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { getNetworkErrorMessage } from '@/lib/validation'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Form } from '@/components/ui/form'
import { toast } from 'sonner'
import { z } from 'zod'
import { formatDateTime } from '@/lib/format'

// ============================================
// Types & Schema
// ============================================

interface ScheduledReport {
  id: string
  organizationId: string
  name: string
  reportType: string
  frequency: string
  deliveryMethod: string
  deliveryConfig: string
  isActive: boolean
  lastSentAt: string | null
  nextSendAt: string | null
  createdAt: string
  updatedAt: string
}

const REPORT_TYPES = [
  { value: 'daily_sales', label: 'Daily Sales' },
  { value: 'weekly_summary', label: 'Weekly Summary' },
  { value: 'monthly_pnl', label: 'Monthly P&L' },
  { value: 'inventory_status', label: 'Inventory Status' },
]

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const DELIVERY_METHODS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'telegram', label: 'Telegram', icon: MessageCircle },
  { value: 'whatsapp', label: 'WhatsApp', icon: Phone },
]

const reportFormSchema = z.object({
  name: z.string().min(1, 'Name is required').min(2, 'Name must be at least 2 characters'),
  reportType: z.string().min(1, 'Report type is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  deliveryMethod: z.string().min(1, 'Delivery method is required'),
  email: z.string().optional(),
  chatId: z.string().optional(),
  phoneNumber: z.string().optional(),
})

type ReportFormData = z.infer<typeof reportFormSchema>

// ============================================
// Helpers
// ============================================

const REPORT_TYPE_LABELS: Record<string, string> = {
  daily_sales: 'Daily Sales',
  weekly_summary: 'Weekly Summary',
  monthly_pnl: 'Monthly P&L',
  inventory_status: 'Inventory Status',
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

const DELIVERY_LABELS: Record<string, string> = {
  email: 'Email',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
}

function getDeliveryConfig(report: ScheduledReport): string {
  try {
    const config = JSON.parse(report.deliveryConfig)
    if (report.deliveryMethod === 'email') return config.email || '—'
    if (report.deliveryMethod === 'telegram') return config.chatId ? `Chat: ${config.chatId}` : '—'
    if (report.deliveryMethod === 'whatsapp') return config.phoneNumber || '—'
    return JSON.stringify(config)
  } catch {
    return '—'
  }
}

// ============================================
// Main Component
// ============================================

export function ScheduledReportsPage() {
  const { currentOrg } = useAuthStore()
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ScheduledReport | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      name: '',
      reportType: '',
      frequency: '',
      deliveryMethod: '',
      email: '',
      chatId: '',
      phoneNumber: '',
    },
  })

  const deliveryMethod = form.watch('deliveryMethod')

  const fetchReports = useCallback(async () => {
    if (!currentOrg) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await authFetch(`/api/scheduled-reports?organizationId=${currentOrg.id}`)
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to fetch scheduled reports')
      }
      const result = await response.json()
      setReports(result.reports || [])
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [currentOrg])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  function openCreateDialog() {
    form.reset({
      name: '',
      reportType: '',
      frequency: '',
      deliveryMethod: '',
      email: '',
      chatId: '',
      phoneNumber: '',
    })
    setDialogOpen(true)
  }

  async function onSubmit(formData: ReportFormData) {
    if (!currentOrg) return
    setIsSaving(true)
    try {
      // Build delivery config based on method
      const deliveryConfig: Record<string, string> = {}
      if (formData.deliveryMethod === 'email') {
        if (!formData.email) {
          toast.error('Email address is required for email delivery')
          setIsSaving(false)
          return
        }
        deliveryConfig.email = formData.email
      } else if (formData.deliveryMethod === 'telegram') {
        if (!formData.chatId) {
          toast.error('Telegram Chat ID is required for Telegram delivery')
          setIsSaving(false)
          return
        }
        deliveryConfig.chatId = formData.chatId
      } else if (formData.deliveryMethod === 'whatsapp') {
        if (!formData.phoneNumber) {
          toast.error('Phone number is required for WhatsApp delivery')
          setIsSaving(false)
          return
        }
        deliveryConfig.phoneNumber = formData.phoneNumber
      }

      const payload = {
        organizationId: currentOrg.id,
        name: formData.name,
        reportType: formData.reportType,
        frequency: formData.frequency,
        deliveryMethod: formData.deliveryMethod,
        deliveryConfig,
      }

      const res = await authFetch('/api/scheduled-reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to create scheduled report')
      }
      toast.success('Scheduled report created successfully')
      setDialogOpen(false)
      fetchReports()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleActive(report: ScheduledReport) {
    if (!currentOrg) return
    setTogglingId(report.id)
    try {
      const res = await authFetch(`/api/scheduled-reports/${report.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          organizationId: currentOrg.id,
          isActive: !report.isActive,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to update report')
      }
      toast.success(report.isActive ? 'Report deactivated' : 'Report activated')
      fetchReports()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete() {
    if (!currentOrg || !deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await authFetch(`/api/scheduled-reports/${deleteTarget.id}?organizationId=${currentOrg.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to delete report')
      }
      toast.success('Scheduled report deleted successfully')
      setDeleteTarget(null)
      fetchReports()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setIsDeleting(false)
    }
  }

  if (error) {
    return <ErrorState title="Failed to load Scheduled Reports" message={error} onRetry={fetchReports} />
  }

  const activeCount = reports.filter(r => r.isActive).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scheduled Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Automate your business reports delivery
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchReports} disabled={isLoading}>
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="size-4" />
            New Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">Total Reports</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-7 w-10 inline-block" /> : reports.length}
                </p>
              </div>
              <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
                <FileText className="size-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">Active</p>
                <p className="text-xl sm:text-2xl font-bold text-emerald-600">
                  {isLoading ? <Skeleton className="h-7 w-10 inline-block" /> : activeCount}
                </p>
              </div>
              <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <ToggleRight className="size-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">Inactive</p>
                <p className="text-xl sm:text-2xl font-bold text-muted-foreground">
                  {isLoading ? <Skeleton className="h-7 w-10 inline-block" /> : reports.length - activeCount}
                </p>
              </div>
              <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
                <ToggleLeft className="size-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          title="No scheduled reports"
          message="Create your first scheduled report to automate business insights delivery"
          action={{ label: 'Create Report', onClick: openCreateDialog }}
          icon={<Send className="size-7 text-muted-foreground" />}
        />
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {reports.map((report) => (
            <Card key={report.id} className={!report.isActive ? 'opacity-60' : ''}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{report.name}</h3>
                      <Badge variant={report.isActive ? 'default' : 'secondary'}>
                        {report.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="size-3.5" />
                        {REPORT_TYPE_LABELS[report.reportType] || report.reportType}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3.5" />
                        {FREQUENCY_LABELS[report.frequency] || report.frequency}
                      </span>
                      <span className="flex items-center gap-1">
                        <Send className="size-3.5" />
                        {DELIVERY_LABELS[report.deliveryMethod] || report.deliveryMethod}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Delivery to: {getDeliveryConfig(report)}</span>
                      {report.lastSentAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          Last sent: {formatDateTime(report.lastSentAt)}
                        </span>
                      )}
                      {report.nextSendAt && report.isActive && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          Next send: {formatDateTime(report.nextSendAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={report.isActive}
                        onCheckedChange={() => handleToggleActive(report)}
                        disabled={togglingId === report.id}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(report)}
                    >
                      <Trash2 className="size-3.5" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Report Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create Scheduled Report</DialogTitle>
            <DialogDescription>
              Set up an automated report to be delivered on a schedule
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Report Name <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="e.g. Daily Sales Report"
                  {...form.register('name')}
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              {/* Report Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Report Type <span className="text-destructive">*</span>
                </label>
                <Select
                  value={form.watch('reportType')}
                  onValueChange={(val) => form.setValue('reportType', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.reportType && (
                  <p className="text-xs text-destructive">{form.formState.errors.reportType.message}</p>
                )}
              </div>

              {/* Frequency */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Frequency <span className="text-destructive">*</span>
                </label>
                <Select
                  value={form.watch('frequency')}
                  onValueChange={(val) => form.setValue('frequency', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(freq => (
                      <SelectItem key={freq.value} value={freq.value}>{freq.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.frequency && (
                  <p className="text-xs text-destructive">{form.formState.errors.frequency.message}</p>
                )}
              </div>

              {/* Delivery Method */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Delivery Method <span className="text-destructive">*</span>
                </label>
                <Select
                  value={form.watch('deliveryMethod')}
                  onValueChange={(val) => form.setValue('deliveryMethod', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select delivery method" />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_METHODS.map(method => (
                      <SelectItem key={method.value} value={method.value}>
                        <span className="flex items-center gap-2">
                          <method.icon className="size-3.5" />
                          {method.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.deliveryMethod && (
                  <p className="text-xs text-destructive">{form.formState.errors.deliveryMethod.message}</p>
                )}
              </div>

              {/* Delivery Config — Email */}
              {deliveryMethod === 'email' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Email Address <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="email"
                    placeholder="recipient@example.com"
                    {...form.register('email')}
                  />
                </div>
              )}

              {/* Delivery Config — Telegram */}
              {deliveryMethod === 'telegram' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Telegram Chat ID <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g. -1001234567890"
                    {...form.register('chatId')}
                  />
                  <p className="text-xs text-muted-foreground">
                    You can get the Chat ID by messaging @userinfobot on Telegram
                  </p>
                </div>
              )}

              {/* Delivery Config — WhatsApp */}
              {deliveryMethod === 'whatsapp' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Phone Number <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="+251912345678"
                    {...form.register('phoneNumber')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Include country code (e.g. +251 for Ethiopia)
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : 'Create Report'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scheduled Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This will stop all future deliveries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

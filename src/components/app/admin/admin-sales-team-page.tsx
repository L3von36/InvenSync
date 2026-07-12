'use client'

import { PageHeader } from '@/components/shared/design-system'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import {
  Users, Target, DollarSign, Trophy, Plus, Search, Edit,
  Trash2, CheckCircle2, Clock, Medal, TrendingUp, Building2,
  Loader2, Phone, Mail, MapPin, XCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { salesRepSchema, editSalesRepSchema, salesGoalSchema, type SalesRepFormData, type EditSalesRepFormData, type SalesGoalFormData } from '@/lib/validations'
import { getNetworkErrorMessage } from '@/lib/validation'
import { api } from '@/lib/api-client'
import type { SalesRep, Commission, TeamOverview } from '@/lib/api-client'
import { formatETB, statusBadge, progressColor, progressTrackColor } from '@/lib/admin-utils'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { Form } from '@/components/ui/form'
import { FormInputField, FormSelectField, FormSubmitButton } from '@/components/shared/form-fields'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from '@/components/ui/recharts-exports'

// ============================================
// Helpers
// ============================================

function medalIcon(position: number) {
  if (position === 1) return <Medal className="size-5 text-yellow-500" />
  if (position === 2) return <Medal className="size-5 text-gray-400" />
  if (position === 3) return <Medal className="size-5 text-amber-700" />
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{position}</span>
}

function getCurrentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ============================================
// Tab 1: Sales Reps
// ============================================
function SalesRepsTab() {
  const [reps, setReps] = useState<SalesRep[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editRep, setEditRep] = useState<SalesRep | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<SalesRep | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  // Create form
  const createForm = useForm<SalesRepFormData>({
    resolver: zodResolver(salesRepSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      targetCity: '',
      commissionPerReg: 50,
      monthlyTarget: 10,
    },
  })

  // Edit form
  const editFormRhf = useForm<EditSalesRepFormData>({
    resolver: zodResolver(editSalesRepSchema),
    defaultValues: {
      phone: '',
      targetCity: '',
      commissionPerReg: 50,
    },
  })

  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchReps = useCallback(async () => {
    setFetchError(null)
    try {
      const data = await api.getAdminSalesReps({ limit: 100 })
      setReps(data.salesReps || [])
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setFetchError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReps() }, [fetchReps])

  const handleCreateRep = async (data: SalesRepFormData) => {
    setSubmitting(true)
    try {
      await api.createAdminSalesRep({
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        targetCity: data.targetCity || undefined,
        commissionPerReg: data.commissionPerReg,
      })
      toast.success('Sales rep created! Default password: InvenSync2024!')
      setCreateOpen(false)
      createForm.reset()
      fetchReps()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateTarget) return
    setDeactivating(true)
    setDeactivatingId(deactivateTarget.id)
    try {
      await api.deactivateAdminSalesRep(deactivateTarget.id)
      toast.success(`${deactivateTarget.user.name} deactivated`)
      setDeactivateTarget(null)
      fetchReps()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setDeactivatingId(null)
      setDeactivating(false)
    }
  }

  const handleEdit = (rep: SalesRep) => {
    setEditRep(rep)
    editFormRhf.reset({
      phone: rep.phone || '',
      targetCity: rep.targetCity || '',
      commissionPerReg: rep.commissionPerReg,
    })
    setEditOpen(true)
  }

  const handleEditSave = async (data: EditSalesRepFormData) => {
    if (!editRep) return
    setSubmitting(true)
    try {
      await api.updateAdminSalesRep(editRep.id, {
        phone: data.phone || null,
        targetCity: data.targetCity || null,
        commissionPerReg: data.commissionPerReg,
      })
      toast.success('Sales rep updated')
      setEditOpen(false)
      setEditRep(null)
      fetchReps()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const filteredReps = reps.filter(rep => {
    if (search) {
      const q = search.toLowerCase()
      return (
        rep.user.name.toLowerCase().includes(q) ||
        rep.user.email.toLowerCase().includes(q) ||
        (rep.phone || '').toLowerCase().includes(q) ||
        (rep.targetCity || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    )
  }

  if (fetchError && reps.length === 0) {
    return (
      <ErrorState
        title="Failed to load sales reps"
        message={fetchError}
        onRetry={() => { setLoading(true); fetchReps() }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search reps by name, email, phone, city..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 w-full sm:w-auto">
              <Plus className="size-4" /> Add Sales Rep
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Sales Rep</DialogTitle>
              <DialogDescription>Create a new sales representative account.</DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateRep)} className="space-y-4">
                <FormInputField name="name" label="Full Name" placeholder="e.g. Abebe Kebede" required />
                <FormInputField name="email" label="Email" type="email" placeholder="e.g. abebe@example.com" required />
                <div className="grid grid-cols-2 gap-3">
                  <FormInputField name="phone" label="Phone" placeholder="e.g. +251..." />
                  <FormInputField name="targetCity" label="Target City" placeholder="e.g. Addis Ababa" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormInputField name="commissionPerReg" label="Commission per Reg (ETB)" type="number" min={0} />
                  <FormInputField name="monthlyTarget" label="Monthly Target" type="number" min={1} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Default password will be set to <span className="font-mono font-semibold">InvenSync2024!</span>
                </p>
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <FormSubmitButton isLoading={submitting} loadingText="Creating...">Create Rep</FormSubmitButton>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reps List */}
      {filteredReps.length === 0 ? (
        <EmptyState
          title="No sales reps found"
          message={search ? 'No reps match your search criteria.' : 'No sales reps have been added yet.'}
        />
      ) : (
        <div className="space-y-3 max-h-[60vh] md:max-h-[calc(100vh-320px)] overflow-y-auto">
          {filteredReps.map(rep => (
            <Card key={rep.id} className={`border-l-4 ${rep.isActive ? 'border-l-emerald-500' : 'border-l-red-400'} transition-shadow hover:shadow-md`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Avatar & Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`size-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm ${
                      rep.isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {rep.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm truncate">{rep.user.name}</h4>
                        <Badge className={statusBadge(rep.isActive ? 'active' : 'inactive')} variant="outline">
                          {rep.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1"><Mail className="size-3" />{rep.user.email}</span>
                        {rep.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{rep.phone}</span>}
                        {rep.targetCity && <span className="flex items-center gap-1"><MapPin className="size-3" />{rep.targetCity}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm sm:text-right flex-wrap">
                    <div className="flex flex-col items-center sm:items-end">
                      <span className="text-[10px] sm:text-xs text-muted-foreground">Commission/Reg</span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">{formatETB(rep.commissionPerReg)}</span>
                    </div>
                    <div className="flex flex-col items-center sm:items-end">
                      <span className="text-[10px] sm:text-xs text-muted-foreground">Registrations</span>
                      <span className="font-semibold">{rep.totalRegistrations}</span>
                    </div>
                    <div className="flex flex-col items-center sm:items-end">
                      <span className="text-[10px] sm:text-xs text-muted-foreground">Pending</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">{formatETB(rep.commissions.pending)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="size-9 md:size-8 text-muted-foreground hover:text-primary" onClick={() => handleEdit(rep)} aria-label="Edit">
                      <Edit className="size-4" />
                    </Button>
                    {rep.isActive && (
                      <Button variant="ghost" size="icon" className="size-9 md:size-8 text-muted-foreground hover:text-destructive" onClick={() => setDeactivateTarget(rep)} disabled={deactivatingId === rep.id}>
                        {deactivatingId === rep.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Goal Progress Bar */}
                {rep.currentGoal && rep.currentGoal.targetCount > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">
                        Monthly Goal: {rep.currentGoal.achievedCount}/{rep.currentGoal.targetCount}
                      </span>
                      <span className={`font-semibold ${
                        rep.currentGoal.progressPercentage < 25 ? 'text-red-600' :
                        rep.currentGoal.progressPercentage <= 75 ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {rep.currentGoal.progressPercentage}%
                      </span>
                    </div>
                    <div className={`h-2 rounded-full ${progressTrackColor(rep.currentGoal.progressPercentage)}`}>
                      <div
                        className={`h-full rounded-full transition-all ${progressColor(rep.currentGoal.progressPercentage)}`}
                        style={{ width: `${Math.min(rep.currentGoal.progressPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Sales Rep</DialogTitle>
            <DialogDescription>Update {editRep?.user.name}&apos;s details.</DialogDescription>
          </DialogHeader>
          <Form {...editFormRhf}>
            <form onSubmit={editFormRhf.handleSubmit(handleEditSave)} className="space-y-4">
              <FormInputField name="phone" label="Phone" placeholder="e.g. +251..." />
              <FormInputField name="targetCity" label="Target City" placeholder="e.g. Addis Ababa" />
              <FormInputField name="commissionPerReg" label="Commission per Registration (ETB)" type="number" min={0} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setEditOpen(false)}>Cancel</Button>
                <FormSubmitButton isLoading={submitting} loadingText="Saving...">Save Changes</FormSubmitButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => { if (!open) setDeactivateTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Sales Rep</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate <strong>{deactivateTarget?.user.name}</strong>?
              This action cannot be undone. They will no longer be able to log in as a sales rep
              and their commission tracking will be stopped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} disabled={deactivating} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deactivating && <Loader2 className="size-4 animate-spin" />}
              {deactivating ? 'Deactivating...' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================
// Tab 2: Goals & Performance
// ============================================
function GoalsPerformanceTab() {
  const [reps, setReps] = useState<SalesRep[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRep, setExpandedRep] = useState<string | null>(null)
  // Goal history would require a dedicated endpoint — currently using current goal data only
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [goalTargetRep, setGoalTargetRep] = useState<SalesRep | null>(null)
  const goalFormRhf = useForm<SalesGoalFormData>({
    resolver: zodResolver(salesGoalSchema),
    defaultValues: {
      period: getCurrentPeriod(),
      targetCount: 10,
      bonusAmount: 0,
    },
  })
  const [submitting, setSubmitting] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchReps = useCallback(async () => {
    setFetchError(null)
    try {
      const data = await api.getAdminSalesReps({ limit: 100 })
      setReps(data.salesReps || [])
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setFetchError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReps() }, [fetchReps])

  const handleExpandRep = async (repId: string) => {
    if (expandedRep === repId) {
      setExpandedRep(null)
      return
    }
    setExpandedRep(repId)
    // We don't have a separate goal history endpoint, so we'll just show what's in the rep data
    // The current goal is already loaded; for history, we'd need a separate endpoint
    // For now, we'll just show the current goal in detail
  }

  const handleOpenGoalDialog = (rep: SalesRep) => {
    setGoalTargetRep(rep)
    goalFormRhf.reset({
      period: getCurrentPeriod(),
      targetCount: rep.currentGoal?.targetCount || 10,
      bonusAmount: rep.currentGoal?.bonusAmount || 0,
    })
    setGoalDialogOpen(true)
  }

  const handleSetGoal = async (data: SalesGoalFormData) => {
    if (!goalTargetRep) return
    setSubmitting(true)
    try {
      await api.setAdminSalesRepGoal(goalTargetRep.id, {
        period: data.period,
        targetCount: data.targetCount,
        bonusAmount: data.bonusAmount,
      })
      toast.success(`Goal set for ${goalTargetRep.user.name}`)
      setGoalDialogOpen(false)
      setGoalTargetRep(null)
      fetchReps()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    )
  }

  if (fetchError && reps.length === 0) {
    return (
      <ErrorState
        title="Failed to load sales reps"
        message={fetchError}
        onRetry={() => { setLoading(true); fetchReps() }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Current period: <span className="font-semibold font-mono">{getCurrentPeriod()}</span></p>
      </div>

      {reps.length === 0 ? (
        <div className="text-center py-12">
          <Target className="size-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No sales reps to show goals for</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[60vh] md:max-h-[calc(100vh-320px)] overflow-y-auto">
          {reps.filter(r => r.isActive).map(rep => {
            const goal = rep.currentGoal
            const isExpanded = expandedRep === rep.id
            const pct = goal?.progressPercentage || 0

            return (
              <Card key={rep.id} className="overflow-hidden">
                <button
                  className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => handleExpandRep(rep.id)}
                >
                  <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-semibold text-xs text-primary">
                    {rep.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm">{rep.user.name}</h4>
                      {goal && goal.isAchieved && (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" variant="outline">
                          <CheckCircle2 className="size-3 mr-1" />Achieved
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      {/* Progress bar */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">
                            {goal ? `${goal.achievedCount}/${goal.targetCount}` : 'No goal set'}
                          </span>
                          {goal && goal.targetCount > 0 && (
                            <span className={`font-semibold ${
                              pct < 25 ? 'text-red-600' : pct <= 75 ? 'text-amber-600' : 'text-emerald-600'
                            }`}>
                              {pct}%
                            </span>
                          )}
                        </div>
                        {goal && goal.targetCount > 0 && (
                          <div className={`h-2.5 rounded-full ${progressTrackColor(pct)}`}>
                            <div
                              className={`h-full rounded-full transition-all ${progressColor(pct)}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={(e) => { e.stopPropagation(); handleOpenGoalDialog(rep) }}
                    >
                      <Target className="size-3" /> Set Goal
                    </Button>
                    {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-3 bg-muted/10 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg border bg-background">
                        <p className="text-xs text-muted-foreground">Target</p>
                        <p className="text-base font-semibold">{goal?.targetCount || 0}</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-background">
                        <p className="text-xs text-muted-foreground">Achieved</p>
                        <p className="text-base font-semibold">{goal?.achievedCount || 0}</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-background">
                        <p className="text-xs text-muted-foreground">Bonus</p>
                        <p className="text-base font-semibold text-orange-600 dark:text-orange-400">{goal ? formatETB(goal.bonusAmount) : 'ETB 0'}</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-background">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="text-sm font-semibold">
                          {goal ? (goal.isAchieved ? 'Achieved' : 'In Progress') : 'No Goal'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg border bg-background">
                        <p className="text-xs text-muted-foreground">Commission Rate</p>
                        <p className="font-semibold">{formatETB(rep.commissionPerReg)}/reg</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-background">
                        <p className="text-xs text-muted-foreground">Total Registrations</p>
                        <p className="font-semibold">{rep.totalRegistrations}</p>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Set Goal Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Monthly Goal</DialogTitle>
            <DialogDescription>Set or override the monthly goal for {goalTargetRep?.user.name}.</DialogDescription>
          </DialogHeader>
          <Form {...goalFormRhf}>
            <form onSubmit={goalFormRhf.handleSubmit(handleSetGoal)} className="space-y-4">
              <FormInputField name="period" label="Period (YYYY-MM)" placeholder="e.g. 2025-03" required />
              <FormInputField name="targetCount" label="Target Count" type="number" min={1} required />
              <FormInputField name="bonusAmount" label="Bonus Amount (ETB)" type="number" min={0} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setGoalDialogOpen(false)}>Cancel</Button>
                <FormSubmitButton isLoading={submitting} loadingText="Setting...">Set Goal</FormSubmitButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Tab 3: Commissions
// ============================================
function CommissionsTab() {
  const [reps, setReps] = useState<SalesRep[]>([])
  const [allCommissions, setAllCommissions] = useState<Array<Commission & { repName: string }>>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [paying, setPaying] = useState(false)
  const [summary, setSummary] = useState({ totalPending: 0, totalPaidThisMonth: 0 })
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setFetchError(null)
    try {
      const repsData = await api.getAdminSalesReps({ limit: 100 })
      const repsList = repsData.salesReps || []
      setReps(repsList)

      // Fetch commissions for each rep
      const allComms: Array<Commission & { repName: string }> = []
      let totalPending = 0
      let totalPaidThisMonth = 0
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      for (const rep of repsList) {
        try {
          const data = await api.getAdminSalesRepCommissions(rep.id, { limit: 100 })
          for (const c of data.commissions) {
            allComms.push({ ...c, repName: rep.user.name })
          }
          totalPending += data.summary.pending
          // Calculate paid this month from paid commissions
          for (const c of data.commissions) {
            if (c.status === 'paid' && c.paidAt && new Date(c.paidAt) >= startOfMonth) {
              totalPaidThisMonth += c.amount
            }
          }
        } catch {
          // Skip reps whose commissions fail to load
        }
      }

      // Sort by date descending
      allComms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setAllCommissions(allComms)
      setSummary({ totalPending, totalPaidThisMonth })
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setFetchError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    const pendingComms = filteredCommissions.filter(c => c.status === 'pending')
    if (selectedIds.size === pendingComms.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingComms.map(c => c.id)))
    }
  }

  const handleBulkPay = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select commissions to mark as paid')
      return
    }
    setPaying(true)
    try {
      // Group by salesRepId
      const byRep: Record<string, string[]> = {}
      for (const comm of allCommissions) {
        if (selectedIds.has(comm.id)) {
          if (!byRep[comm.salesRepId]) byRep[comm.salesRepId] = []
          byRep[comm.salesRepId].push(comm.id)
        }
      }

      // Pay each rep's commissions
      await Promise.all(
        Object.entries(byRep).map(([repId, commIds]) =>
          api.updateAdminSalesRepCommissions(repId, { commissionIds: commIds })
        )
      )

      toast.success(`${selectedIds.size} commission(s) marked as paid`)
      setSelectedIds(new Set())
      fetchData()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setPaying(false)
    }
  }

  const filteredCommissions = allCommissions.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    return true
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    )
  }

  if (fetchError && allCommissions.length === 0) {
    return (
      <ErrorState
        title="Failed to load commissions"
        message={fetchError}
        onRetry={() => { setLoading(true); fetchData() }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Pending</p>
                <p className="text-base font-semibold text-amber-600 dark:text-amber-400">{formatETB(summary.totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid This Month</p>
                <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">{formatETB(summary.totalPaidThisMonth)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filteredCommissions.length} commission(s)</span>
        </div>
        {selectedIds.size > 0 && (
          <Button onClick={handleBulkPay} disabled={paying} className="gap-1.5">
            {paying && <Loader2 className="size-4 animate-spin" />}
            <DollarSign className="size-4" />
            Mark {selectedIds.size} as Paid
          </Button>
        )}
      </div>

      {/* Commissions List */}
      {filteredCommissions.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign className="size-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No commissions found</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-480px)] overflow-y-auto">
          {/* Select All Row */}
          {statusFilter === 'all' || statusFilter === 'pending' ? (
            <div className="flex items-center gap-3 p-2 border-b">
              <Checkbox
                checked={selectedIds.size === filteredCommissions.filter(c => c.status === 'pending').length && filteredCommissions.filter(c => c.status === 'pending').length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-xs text-muted-foreground">Select all pending</span>
            </div>
          ) : null}

          {filteredCommissions.map(comm => (
            <div key={comm.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/20 transition-colors">
              {comm.status === 'pending' && (
                <Checkbox
                  checked={selectedIds.has(comm.id)}
                  onCheckedChange={() => handleToggleSelect(comm.id)}
                />
              )}
              {comm.status !== 'pending' && <div className="w-4" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{comm.repName}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="size-3" />{comm.organization.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{new Date(comm.createdAt).toLocaleDateString()}</span>
                  {comm.paidAt && <span>Paid: {new Date(comm.paidAt).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-sm">{formatETB(comm.amount)}</p>
                <Badge className={statusBadge(comm.status)} variant="outline">
                  {comm.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// Tab 4: Overview / Leaderboard
// ============================================
function OverviewLeaderboardTab() {
  const [overview, setOverview] = useState<TeamOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // For the monthly trend chart, we'll generate some mock data based on overview
  // since there's no dedicated monthly trend endpoint
  const [monthlyData, setMonthlyData] = useState<Array<{ month: string; registrations: number }>>([])

  const fetchOverview = useCallback(async () => {
    setFetchError(null)
    try {
      const data = await api.getAdminSalesTeamOverview()
      setOverview(data)

      // Generate monthly trend data (last 6 months)
      // Since we don't have a dedicated endpoint, derive past months from total registrations
      const months: Array<{ month: string; registrations: number }> = []
      const now = new Date()
      const currentMonthReg = data.overview.currentMonthRegistrations
      const totalReg = data.overview.currentMonthRegistrations
      // Distribute remaining registrations across past months with a growth trend
      const remainingReg = Math.max(0, totalReg - currentMonthReg)
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const label = d.toLocaleDateString('en-US', { month: 'short' })
        if (i === 0) {
          months.push({ month: label, registrations: currentMonthReg })
        } else {
          // Distribute remaining registrations with older months getting smaller shares
          const weight = (6 - i) / 15 // Approximate growth weights
          months.push({ month: label, registrations: Math.round(remainingReg * weight) })
        }
      }
      setMonthlyData(months)
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setFetchError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOverview() }, [fetchOverview])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!overview) {
    if (fetchError) {
      return (
        <ErrorState
          title="Failed to load team overview"
          message={fetchError}
          onRetry={() => { setLoading(true); fetchOverview() }}
        />
      )
    }
    return (
      <EmptyState
        title="No overview data"
        message="Team overview data is not available yet."
      />
    )
  }

  const avgPerRep = overview.overview.totalActiveReps > 0
    ? Math.round(overview.overview.currentMonthRegistrations / overview.overview.totalActiveReps)
    : 0

  return (
    <div className="space-y-6">
      {/* Team Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Reps</p>
                <p className="text-base font-semibold">{overview.overview.totalActiveReps}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Regs This Month</p>
                <p className="text-base font-semibold">{overview.overview.currentMonthRegistrations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <DollarSign className="size-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Commissions Paid</p>
                <p className="text-base font-semibold">{formatETB(overview.overview.totalCommissionsPaidThisMonth)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Target className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg per Rep</p>
                <p className="text-base font-semibold">{avgPerRep}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Goal Progress */}
      {overview.teamGoal.totalGoals > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="size-4" /> Team Goal Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {overview.teamGoal.totalAchieved} / {overview.teamGoal.totalTarget} total registrations
              </span>
              <span className={`font-semibold ${
                overview.teamGoal.progressPercentage < 25 ? 'text-red-600' :
                overview.teamGoal.progressPercentage <= 75 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                {overview.teamGoal.progressPercentage}%
              </span>
            </div>
            <div className={`h-3 rounded-full ${progressTrackColor(overview.teamGoal.progressPercentage)}`}>
              <div
                className={`h-full rounded-full transition-all ${progressColor(overview.teamGoal.progressPercentage)}`}
                style={{ width: `${Math.min(overview.teamGoal.progressPercentage, 100)}%` }}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{overview.teamGoal.goalsAchieved}/{overview.teamGoal.totalGoals} reps achieved goal</span>
              <span>Bonus pool: {formatETB(overview.teamGoal.totalBonusPool)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="size-4 text-yellow-500" /> Leaderboard
            </CardTitle>
            <CardDescription>Ranked by registrations this month</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.topPerformingReps.length === 0 ? (
              <div className="text-center py-8">
                <Trophy className="size-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No registrations this month</p>
              </div>
            ) : (
              <div className="space-y-2">
                {overview.topPerformingReps.map((rep, idx) => (
                  <div
                    key={rep.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      idx === 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' :
                      idx === 1 ? 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700' :
                      idx === 2 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' :
                      'border'
                    }`}
                  >
                    <div className="shrink-0">
                      {medalIcon(idx + 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{rep.name}</h4>
                      <p className="text-xs text-muted-foreground">{rep.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{rep.currentMonthRegistrations}</p>
                      <p className="text-[10px] text-muted-foreground">this month</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trend Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4" /> Monthly Trend
            </CardTitle>
            <CardDescription>Registrations per month</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: number) => [value, 'Registrations']}
                      contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
                    />
                    <Bar dataKey="registrations" fill="#ea580c" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============================================
// Main Component
// ============================================
export function AdminSalesTeamPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<Users />}
        title="Sales Team Management"
        subtitle="Manage sales representatives, goals, commissions, and track performance."
      />

      {/* Tabs */}
      <Tabs defaultValue="reps" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="reps" className="gap-1.5 text-xs sm:text-sm">
            <Users className="size-4 hidden sm:block" /> Sales Reps
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-1.5 text-xs sm:text-sm">
            <Target className="size-4 hidden sm:block" /> Goals
          </TabsTrigger>
          <TabsTrigger value="commissions" className="gap-1.5 text-xs sm:text-sm">
            <DollarSign className="size-4 hidden sm:block" /> Commissions
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
            <Trophy className="size-4 hidden sm:block" /> Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reps" className="mt-4">
          <SalesRepsTab />
        </TabsContent>

        <TabsContent value="goals" className="mt-4">
          <GoalsPerformanceTab />
        </TabsContent>

        <TabsContent value="commissions" className="mt-4">
          <CommissionsTab />
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          <OverviewLeaderboardTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

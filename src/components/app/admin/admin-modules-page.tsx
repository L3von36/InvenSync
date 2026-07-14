'use client'

import { PageHeader } from '@/components/shared/design-system'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import {
  Puzzle, Plus, Search, DollarSign, Users, BarChart3,
  Clock, Building2,
  ShieldCheck, Eye, XCircle, CheckCircle2, ChevronDown,
  ChevronUp, Zap, Palette, Link2, Tag, Edit3, Trash2,
  RefreshCw, TrendingUp, ShoppingCart,
  Loader2, PackageCheck, ThumbsUp, ThumbsDown, Ban,
  Layers, ArrowUpRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatETB, businessTypeBadge, categoryBadge, moduleStatusBadge, CHART_COLORS, daysUntil } from '@/lib/admin-utils'
import { type AdminOrg, type OrgModuleInfo, type AdminModule } from '@/types/admin'
import { adminModuleSchema, type AdminModuleFormData } from '@/lib/validations'
import { getNetworkErrorMessage } from '@/lib/validation'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { Form } from '@/components/ui/form'
import { FormInputField, FormTextareaField, FormSelectField, FormSwitchField, FormSubmitButton } from '@/components/shared/form-fields'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from '@/components/ui/recharts-exports'

const CARD_ACCENT: Record<string, string> = {
  core: 'border-l-emerald-500',
  ai: 'border-l-purple-500',
  integration: 'border-l-cyan-500',
  analytics: 'border-l-amber-500',
  communication: 'border-l-pink-500',
  reporting: 'border-l-orange-500',
}

const PRICE_COLORS: Record<string, { bg: string; text: string }> = {
  free: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300' },
  paid: { bg: 'bg-muted', text: 'text-foreground' },
}

function getModuleIcon(iconName: string) {
  const iconMap: Record<string, React.ReactNode> = {
    'package': <ShoppingCart className="size-5" />,
    'bar-chart': <BarChart3 className="size-5" />,
    'brain': <Zap className="size-5" />,
    'puzzle': <Puzzle className="size-5" />,
    'palette': <Palette className="size-5" />,
    'link': <Link2 className="size-5" />,
    'shield': <ShieldCheck className="size-5" />,
    'eye': <Eye className="size-5" />,
    'tag': <Tag className="size-5" />,
    'clock': <Clock className="size-5" />,
  }
  return iconMap[iconName] || <Puzzle className="size-5" />
}

// ============================================
// Tab 1: Module Catalog
// ============================================
function ModuleCatalogTab() {
  const [modules, setModules] = useState<AdminModule[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const [editPriceValue, setEditPriceValue] = useState('')
  const [editingTrial, setEditingTrial] = useState<string | null>(null)
  const [editTrialValue, setEditTrialValue] = useState('')

  // Quick Assign state
  const [quickAssignModule, setQuickAssignModule] = useState<string | null>(null) // module key
  const [quickAssignOrgs, setQuickAssignOrgs] = useState<AdminOrg[]>([])
  const [quickAssignOrgSearch, setQuickAssignOrgSearch] = useState('')
  const [quickAssignSelectedOrg, setQuickAssignSelectedOrg] = useState('')
  const [quickAssignLoading, setQuickAssignLoading] = useState(false)
  const [quickAssignOrgsLoading, setQuickAssignOrgsLoading] = useState(false)

  // Create form
  const createForm = useForm<AdminModuleFormData>({
    resolver: zodResolver(adminModuleSchema),
    defaultValues: {
      key: '',
      name: '',
      description: '',
      icon: 'puzzle',
      category: 'core',
      priceETB: 0,
      billingCycle: 'monthly',
      isFree: true,
      freeTrialDays: 30,
      order: 0,
    },
  })

  const [fetchError, setFetchError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminModule | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchModules = useCallback(async () => {
    setFetchError(null)
    try {
      const data = await api.getAdminModules()
      setModules(data.modules || [])
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setFetchError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchModules() }, [fetchModules])

  const handleCreateModule = async (data: AdminModuleFormData) => {
    setCreating(true)
    try {
      await api.createAdminModule(data)
      toast.success('Module created successfully')
      setCreateOpen(false)
      createForm.reset()
      fetchModules()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const handleToggleFree = async (mod: AdminModule) => {
    try {
      await api.updateAdminModule(mod.id, { isFree: !mod.isFree, priceETB: !mod.isFree ? 0 : mod.priceETB || 500 })
      toast.success(`${mod.name} is now ${!mod.isFree ? 'free' : 'paid'}`)
      fetchModules()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    }
  }

  const handlePriceSave = async (mod: AdminModule) => {
    const price = parseFloat(editPriceValue)
    if (isNaN(price) || price < 0) {
      toast.error('Price must be a valid non-negative number')
      return
    }
    try {
      await api.updateAdminModule(mod.id, { priceETB: price })
      toast.success('Price updated')
      setEditingPrice(null)
      fetchModules()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    }
  }

  const handleTrialSave = async (mod: AdminModule) => {
    const days = parseInt(editTrialValue)
    if (isNaN(days) || days < 0) {
      toast.error('Trial days must be a valid non-negative number')
      return
    }
    try {
      await api.updateAdminModule(mod.id, { freeTrialDays: days })
      toast.success('Trial days updated')
      setEditingTrial(null)
      fetchModules()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeletingId(deleteTarget.id)
    try {
      await api.deleteAdminModule(deleteTarget.id)
      toast.success('Module deactivated')
      setDeleteTarget(null)
      fetchModules()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setDeletingId(null)
      setDeleting(false)
    }
  }

  const handleOpenQuickAssign = async (moduleKey: string) => {
    setQuickAssignModule(moduleKey)
    setQuickAssignSelectedOrg('')
    setQuickAssignOrgSearch('')
    setQuickAssignOrgsLoading(true)
    try {
      const data = await api.getAdminOrganizations({ limit: 100 })
      setQuickAssignOrgs(data.organizations || [])
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setQuickAssignOrgsLoading(false)
    }
  }

  const handleQuickAssign = async () => {
    if (!quickAssignSelectedOrg || !quickAssignModule) {
      toast.error('Select an organization')
      return
    }
    setQuickAssignLoading(true)
    try {
      await api.assignModuleToOrg(quickAssignSelectedOrg, { moduleKey: quickAssignModule, status: 'trial', durationDays: 30 })
      toast.success('Module assigned with 30-day trial')
      setQuickAssignModule(null)
      setQuickAssignSelectedOrg('')
      fetchModules()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setQuickAssignLoading(false)
    }
  }

  const filteredModules = modules.filter(m => {
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.key.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
        </div>
      </div>
    )
  }

  if (fetchError && modules.length === 0) {
    return (
      <ErrorState
        title="Failed to load modules"
        message={fetchError}
        onRetry={() => { setLoading(true); fetchModules() }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search modules..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="core">Core</SelectItem>
              <SelectItem value="ai">AI</SelectItem>
              <SelectItem value="integration">Integration</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
              <SelectItem value="communication">Communication</SelectItem>
              <SelectItem value="reporting">Reporting</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 w-full sm:w-auto">
              <Plus className="size-4" /> Create Module
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Module</DialogTitle>
              <DialogDescription>Add a new module to the platform catalog.</DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateModule)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormInputField name="key" label="Module Key" placeholder="e.g. ai-analytics" required />
                  <FormInputField name="name" label="Display Name" placeholder="e.g. AI Analytics" required />
                </div>
                <FormTextareaField name="description" label="Description" placeholder="What does this module do?" rows={2} />
                <div className="grid grid-cols-2 gap-3">
                  <FormSelectField name="category" label="Category" options={[
                    { value: 'core', label: 'Core' },
                    { value: 'ai', label: 'AI' },
                    { value: 'integration', label: 'Integration' },
                    { value: 'analytics', label: 'Analytics' },
                    { value: 'communication', label: 'Communication' },
                    { value: 'reporting', label: 'Reporting' },
                  ]} />
                  <FormSelectField name="icon" label="Icon" options={[
                    { value: 'puzzle', label: 'Puzzle' },
                    { value: 'package', label: 'Package' },
                    { value: 'bar-chart', label: 'Bar Chart' },
                    { value: 'brain', label: 'Brain/AI' },
                    { value: 'palette', label: 'Palette' },
                    { value: 'link', label: 'Link' },
                    { value: 'shield', label: 'Shield' },
                    { value: 'eye', label: 'Eye' },
                    { value: 'tag', label: 'Tag' },
                    { value: 'clock', label: 'Clock' },
                  ]} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormInputField name="priceETB" label="Price (ETB/month)" type="number" min={0} />
                  <FormSelectField name="billingCycle" label="Billing Cycle" options={[
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'yearly', label: 'Yearly' },
                    { value: 'one-time', label: 'One-time' },
                  ]} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <FormSwitchField name="isFree" label="Free module" className="flex-1" />
                  <FormInputField name="freeTrialDays" label="Free Trial Days" type="number" min={0} max={365} inputClassName="w-24" />
                </div>
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <FormSubmitButton isLoading={creating} loadingText="Creating...">Create Module</FormSubmitButton>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Module Grid */}
      {filteredModules.length === 0 ? (
        <div className="text-center py-12">
          <Puzzle className="size-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No modules found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModules.map(mod => {
            const priceType = mod.isFree ? 'free' : 'paid'
            return (
              <Card
                key={mod.id}
                className={`border-l-4 ${CARD_ACCENT[mod.category] || 'border-l-gray-400'} transition-shadow hover:shadow-md ${!mod.isActive ? 'opacity-60' : ''}`}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
                        mod.category === 'ai' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' :
                        mod.category === 'integration' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600' :
                        mod.category === 'core' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' :
                        'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                      }`}>
                        {getModuleIcon(mod.icon)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate">{mod.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono">{mod.key}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="size-9 md:size-7 text-muted-foreground hover:text-sky-600" title="Quick Assign" aria-label="Quick assign module" onClick={() => handleOpenQuickAssign(mod.key)}>
                        <PackageCheck className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-9 md:size-7 text-muted-foreground hover:text-destructive" aria-label="Delete module" onClick={() => setDeleteTarget(mod)} disabled={deletingId === mod.id}>
                        {deletingId === mod.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground line-clamp-2">{mod.description || 'No description'}</p>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge className={categoryBadge(mod.category)} variant="outline">{mod.category}</Badge>
                    {mod.isFree && <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" variant="outline">Free</Badge>}
                    {!mod.isActive && <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" variant="outline">Inactive</Badge>}
                    <Badge variant="outline" className="text-[0.769rem]">{mod.billingCycle}</Badge>
                  </div>

                  <Separator />

                  {/* Price - Inline Editable */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {editingPrice === mod.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">ETB</span>
                          <Input
                            type="number"
                            min={0}
                            value={editPriceValue}
                            onChange={e => setEditPriceValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handlePriceSave(mod); if (e.key === 'Escape') setEditingPrice(null) }}
                            className="w-24 h-7 text-xs"
                            autoFocus
                          />
                          <Button variant="ghost" size="icon" className="size-8 md:size-6" aria-label="Save price" onClick={() => handlePriceSave(mod)}>
                            <CheckCircle2 className="size-3.5 text-emerald-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 md:size-6" aria-label="Cancel price edit" onClick={() => setEditingPrice(null)}>
                            <XCircle className="size-3.5 text-red-500" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="flex items-center gap-1 group cursor-pointer"
                          onClick={() => { setEditingPrice(mod.id); setEditPriceValue(mod.priceETB.toString()) }}
                        >
                          <span className={`text-sm font-bold ${PRICE_COLORS[priceType].text}`}>
                            {mod.isFree ? 'Free' : formatETB(mod.priceETB)}
                          </span>
                          <Edit3 className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                      <span className="text-[0.769rem] text-muted-foreground">/mo</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{mod.orgCount} orgs</span>
                  </div>

                  {/* Trial Days - Inline Editable */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="size-3 text-muted-foreground" />
                      {editingTrial === mod.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={365}
                            value={editTrialValue}
                            onChange={e => setEditTrialValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleTrialSave(mod); if (e.key === 'Escape') setEditingTrial(null) }}
                            className="w-16 h-6 text-xs"
                            autoFocus
                          />
                          <span className="text-[0.769rem]">days trial</span>
                          <Button variant="ghost" size="icon" className="size-7 md:size-5" aria-label="Save trial period" onClick={() => handleTrialSave(mod)}>
                            <CheckCircle2 className="size-3 text-emerald-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7 md:size-5" aria-label="Cancel trial edit" onClick={() => setEditingTrial(null)}>
                            <XCircle className="size-3 text-red-500" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="flex items-center gap-1 group cursor-pointer"
                          onClick={() => { setEditingTrial(mod.id); setEditTrialValue(mod.freeTrialDays.toString()) }}
                        >
                          <span>{mod.freeTrialDays}-day trial</span>
                          <Edit3 className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{mod.isFree ? 'Free' : 'Paid'}</span>
                      <Switch
                        checked={mod.isFree}
                        onCheckedChange={() => handleToggleFree(mod)}
                        className="scale-75"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Module</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate <strong>&quot;{deleteTarget?.name}&quot;</strong>?
              This action cannot be undone. The module will be set as inactive and organizations
              currently using it will lose access to its features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {deleting ? 'Deactivating...' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Assign Dialog */}
      <Dialog open={quickAssignModule !== null} onOpenChange={(open) => { if (!open) setQuickAssignModule(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Assign Module</DialogTitle>
            <DialogDescription>
              Assign <span className="font-semibold">{quickAssignModule}</span> to an organization with a 30-day trial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Search & Select Organization</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by org name..."
                  value={quickAssignOrgSearch}
                  onChange={e => setQuickAssignOrgSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {quickAssignOrgsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select value={quickAssignSelectedOrg} onValueChange={setQuickAssignSelectedOrg}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an organization..." />
                </SelectTrigger>
                <SelectContent>
                  {quickAssignOrgs
                    .filter(org => !quickAssignOrgSearch || org.name.toLowerCase().includes(quickAssignOrgSearch.toLowerCase()))
                    .map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} <span className="text-muted-foreground">({org.businessType})</span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAssignModule(null)}>Cancel</Button>
            <Button onClick={handleQuickAssign} disabled={!quickAssignSelectedOrg || quickAssignLoading}>
              {quickAssignLoading && <Loader2 className="size-4 animate-spin mr-1" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Tab 2: Organization Subscriptions
// ============================================
function OrgSubscriptionsTab() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null)
  const [orgModules, setOrgModules] = useState<Record<string, OrgModuleInfo[]>>({})
  const [loadingModules, setLoadingModules] = useState<Record<string, boolean>>({})
  const [allModules, setAllModules] = useState<AdminModule[]>([])
  const [assigningOrg, setAssigningOrg] = useState<string | null>(null)
  const [assignModuleKey, setAssignModuleKey] = useState('')
  const [bulkAssignOrg, setBulkAssignOrg] = useState<string | null>(null)
  const [bulkAssignLoading, setBulkAssignLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [orgsFetchError, setOrgsFetchError] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<{ orgId: string; moduleKey: string; moduleName: string; orgName: string } | null>(null)
  const [revoking, setRevoking] = useState(false)

  const fetchOrgs = useCallback(async () => {
    setOrgsFetchError(null)
    try {
      const data = await api.getAdminOrganizations({ limit: 100 })
      setOrgs(data.organizations || [])
      // Pre-populate org modules from the API response
      const modulesMap: Record<string, OrgModuleInfo[]> = {}
      data.organizations?.forEach(org => {
        modulesMap[org.id] = org.modules || []
      })
      setOrgModules(modulesMap)
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setOrgsFetchError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAllModules = useCallback(async () => {
    try {
      const data = await api.getAdminModules()
      setAllModules(data.modules || [])
    } catch {
      // Non-critical — modules list is supplementary for assign dropdown
    }
  }, [])

  useEffect(() => {
    fetchOrgs()
    fetchAllModules()
  }, [fetchOrgs, fetchAllModules])

  const handleExpandOrg = async (orgId: string) => {
    if (expandedOrg === orgId) {
      setExpandedOrg(null)
      return
    }
    setExpandedOrg(orgId)
    if (!orgModules[orgId] || orgModules[orgId].length === 0) {
      setLoadingModules(prev => ({ ...prev, [orgId]: true }))
      try {
        const data = await api.getOrgModules(orgId)
        setOrgModules(prev => ({ ...prev, [orgId]: data.modules || [] }))
      } catch (err) {
        toast.error(getNetworkErrorMessage(err))
      } finally {
        setLoadingModules(prev => ({ ...prev, [orgId]: false }))
      }
    }
  }

  const handleRenew = async (orgId: string, moduleKey: string) => {
    const key = `renew-${orgId}-${moduleKey}`
    setActionLoading(key)
    try {
      await api.updateOrgModule(orgId, { moduleKey, status: 'trial', durationDays: 30 })
      toast.success('Module renewed for 30 days')
      // Refresh org modules
      const data = await api.getOrgModules(orgId)
      setOrgModules(prev => ({ ...prev, [orgId]: data.modules || [] }))
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setActionLoading(null)
    }
  }

  const handleActivate = async (orgId: string, moduleKey: string) => {
    const key = `activate-${orgId}-${moduleKey}`
    setActionLoading(key)
    try {
      await api.updateOrgModule(orgId, { moduleKey, status: 'active', isActive: true })
      toast.success('Module activated')
      const data = await api.getOrgModules(orgId)
      setOrgModules(prev => ({ ...prev, [orgId]: data.modules || [] }))
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    const { orgId, moduleKey } = revokeTarget
    const key = `revoke-${orgId}-${moduleKey}`
    setRevoking(true)
    setActionLoading(key)
    try {
      await api.revokeModuleFromOrg(orgId, moduleKey)
      toast.success('Module revoked')
      setRevokeTarget(null)
      const data = await api.getOrgModules(orgId)
      setOrgModules(prev => ({ ...prev, [orgId]: data.modules || [] }))
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setActionLoading(null)
      setRevoking(false)
    }
  }

  const handleAssign = async (orgId: string) => {
    if (!assignModuleKey) {
      toast.error('Select a module to assign')
      return
    }
    const key = `assign-${orgId}`
    setActionLoading(key)
    try {
      await api.assignModuleToOrg(orgId, { moduleKey: assignModuleKey, status: 'trial', durationDays: 30 })
      toast.success('Module assigned with 30-day trial')
      setAssigningOrg(null)
      setAssignModuleKey('')
      const data = await api.getOrgModules(orgId)
      setOrgModules(prev => ({ ...prev, [orgId]: data.modules || [] }))
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setActionLoading(null)
    }
  }

  const handleApproveRequest = async (orgId: string, moduleKey: string) => {
    const key = `approve-${orgId}-${moduleKey}`
    setActionLoading(key)
    try {
      await api.assignModuleToOrg(orgId, { moduleKey, status: 'active', durationDays: 30 })
      toast.success('Module request approved and activated')
      const data = await api.getOrgModules(orgId)
      setOrgModules(prev => ({ ...prev, [orgId]: data.modules || [] }))
      fetchOrgs()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectRequest = async (orgId: string, moduleKey: string) => {
    const key = `reject-${orgId}-${moduleKey}`
    setActionLoading(key)
    try {
      await api.updateOrgModule(orgId, { moduleKey, status: 'cancelled', isActive: false })
      toast.success('Module request rejected')
      const data = await api.getOrgModules(orgId)
      setOrgModules(prev => ({ ...prev, [orgId]: data.modules || [] }))
      fetchOrgs()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkAssignAll = async (orgId: string) => {
    const modules = orgModules[orgId] || []
    const assignedKeys = modules.map(m => m.key)
    const modulesToAssign = allModules.filter(m => !assignedKeys.includes(m.key) && m.isActive)
    if (modulesToAssign.length === 0) {
      toast.error('No new modules to assign')
      return
    }
    setBulkAssignLoading(true)
    try {
      await Promise.all(
        modulesToAssign.map(m =>
          api.assignModuleToOrg(orgId, { moduleKey: m.key, status: 'trial', durationDays: 30 })
        )
      )
      toast.success(`${modulesToAssign.length} module(s) assigned with 30-day trial`)
      setBulkAssignOrg(null)
      const data = await api.getOrgModules(orgId)
      setOrgModules(prev => ({ ...prev, [orgId]: data.modules || [] }))
      fetchOrgs()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setBulkAssignLoading(false)
    }
  }

  const filteredOrgs = orgs.filter(org => {
    if (search && !org.name.toLowerCase().includes(search.toLowerCase()) && !(org.city || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    )
  }

  if (orgsFetchError && orgs.length === 0) {
    return (
      <ErrorState
        title="Failed to load organizations"
        message={orgsFetchError}
        onRetry={() => { setLoading(true); fetchOrgs() }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input placeholder="Search organizations by name or city..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Orgs List */}
      {filteredOrgs.length === 0 ? (
        <EmptyState
          title="No organizations found"
          message="No organizations match your search criteria."
        />
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
          {filteredOrgs.map(org => {
            const isExpanded = expandedOrg === org.id
            const modules = orgModules[org.id] || []
            const assignedKeys = modules.map(m => m.key)
            const availableModules = allModules.filter(m => !assignedKeys.includes(m.key) && m.isActive)
            const requestedCount = modules.filter(m => m.status === 'requested').length

            return (
              <Card key={org.id} className="overflow-hidden">
                <button
                  className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => handleExpandOrg(org.id)}
                >
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="size-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-sm truncate">{org.name}</h4>
                      <Badge className={businessTypeBadge(org.businessType)} variant="outline">{org.businessType}</Badge>
                      {requestedCount > 0 && (
                        <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" variant="outline">
                          {requestedCount} requested
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {org.city && <span>{org.city}</span>}
                      <span>{org.memberCount} members</span>
                      <span>{modules.length} module{modules.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-muted/10">
                    {loadingModules[org.id] ? (
                      <div className="space-y-2 py-2">
                        <Skeleton className="h-8" />
                        <Skeleton className="h-8" />
                      </div>
                    ) : modules.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No modules assigned</p>
                    ) : (
                      <div className="space-y-2">
                        {modules.map(mod => {
                          const days = daysUntil(mod.expiresAt)
                          return (
                            <div key={mod.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{mod.name}</span>
                                  <Badge className={moduleStatusBadge(mod.status)} variant="outline">
                                    {mod.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                  <span className="font-mono">{mod.key}</span>
                                  {mod.status === 'requested' ? (
                                    <span className="text-sky-600 dark:text-sky-400">Pending approval</span>
                                  ) : mod.expiresAt && (
                                    <span>
                                      {mod.status === 'trial' && days !== null && days > 0
                                        ? `${days} days remaining`
                                        : mod.status === 'expired'
                                        ? 'Expired'
                                        : `Expires: ${new Date(mod.expiresAt).toLocaleDateString()}`
                                      }
                                    </span>
                                  )}
                                  {mod.priceAtActivation > 0 && <span>{formatETB(mod.priceAtActivation)}/mo</span>}
                                  {mod.autoRenew && <span className="flex items-center gap-0.5"><RefreshCw className="size-3" /> Auto-renew</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {mod.status === 'requested' && (
                                  <>
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleApproveRequest(org.id, mod.key)} disabled={actionLoading === `approve-${org.id}-${mod.key}`}>
                                      {actionLoading === `approve-${org.id}-${mod.key}` ? <Loader2 className="size-3 animate-spin" /> : <ThumbsUp className="size-3" />} {actionLoading === `approve-${org.id}-${mod.key}` ? 'Approving...' : 'Approve'}
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleRejectRequest(org.id, mod.key)} disabled={actionLoading === `reject-${org.id}-${mod.key}`}>
                                      {actionLoading === `reject-${org.id}-${mod.key}` ? <Loader2 className="size-3 animate-spin" /> : <ThumbsDown className="size-3" />} {actionLoading === `reject-${org.id}-${mod.key}` ? 'Rejecting...' : 'Reject'}
                                    </Button>
                                  </>
                                )}
                                {mod.status === 'trial' && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleRenew(org.id, mod.key)} disabled={actionLoading === `renew-${org.id}-${mod.key}`}>
                                    {actionLoading === `renew-${org.id}-${mod.key}` ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />} {actionLoading === `renew-${org.id}-${mod.key}` ? 'Renewing...' : 'Renew'}
                                  </Button>
                                )}
                                {(mod.status === 'trial' || mod.status === 'expired') && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleActivate(org.id, mod.key)} disabled={actionLoading === `activate-${org.id}-${mod.key}`}>
                                    {actionLoading === `activate-${org.id}-${mod.key}` ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />} {actionLoading === `activate-${org.id}-${mod.key}` ? 'Activating...' : 'Activate'}
                                  </Button>
                                )}
                                {mod.status !== 'cancelled' && mod.status !== 'requested' && (
                                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setRevokeTarget({ orgId: org.id, moduleKey: mod.key, moduleName: mod.name, orgName: org.name })} disabled={actionLoading === `revoke-${org.id}-${mod.key}`}>
                                    {actionLoading === `revoke-${org.id}-${mod.key}` ? <Loader2 className="size-3 animate-spin" /> : <Ban className="size-3" />} {actionLoading === `revoke-${org.id}-${mod.key}` ? 'Revoking...' : 'Revoke'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Assign New Module & Bulk Assign */}
                    {availableModules.length > 0 && (
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        {assigningOrg === org.id ? (
                          <div className="flex items-center gap-2 w-full">
                            <Select value={assignModuleKey} onValueChange={setAssignModuleKey}>
                              <SelectTrigger className="flex-1 h-8 text-xs">
                                <SelectValue placeholder="Select module to assign..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableModules.map(m => (
                                  <SelectItem key={m.id} value={m.key}>
                                    {m.name} {m.isFree ? '(Free)' : `(${formatETB(m.priceETB)}/mo)`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" className="h-8 text-xs" onClick={() => handleAssign(org.id)} disabled={actionLoading === `assign-${org.id}`}>
                              {actionLoading === `assign-${org.id}` && <Loader2 className="size-3 animate-spin" />}
                              {actionLoading === `assign-${org.id}` ? 'Assigning...' : 'Assign'}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAssigningOrg(null); setAssignModuleKey('') }}>Cancel</Button>
                          </div>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setAssigningOrg(org.id)}>
                              <Plus className="size-3" /> Assign New Module
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setBulkAssignOrg(org.id)}>
                              <Layers className="size-3" /> Assign All Modules
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                    {availableModules.length === 0 && (
                      <div className="pt-2">
                        <p className="text-xs text-muted-foreground">All available modules are already assigned.</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Bulk Assign Confirmation Dialog */}
      <Dialog open={bulkAssignOrg !== null} onOpenChange={(open) => { if (!open) setBulkAssignOrg(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign All Modules</DialogTitle>
            <DialogDescription>
              This will assign all available modules to this organization with a 30-day trial period.
              {bulkAssignOrg && (
                <span className="block mt-1 font-medium">
                  {allModules.filter(m => {
                    const mods = orgModules[bulkAssignOrg] || []
                    const assignedKeys = mods.map(mod => mod.key)
                    return !assignedKeys.includes(m.key) && m.isActive
                  }).length} module(s) will be assigned.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignOrg(null)}>Cancel</Button>
            <Button onClick={() => bulkAssignOrg && handleBulkAssignAll(bulkAssignOrg)} disabled={bulkAssignLoading}>
              {bulkAssignLoading && <Loader2 className="size-4 animate-spin mr-1" />}
              Assign All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Module Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke <strong>&quot;{revokeTarget?.moduleName}&quot;</strong> from <strong>{revokeTarget?.orgName}</strong>?
              This action cannot be undone. The organization will immediately lose access to this module and all its features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} disabled={revoking} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {revoking && <Loader2 className="size-4 animate-spin" />}
              {revoking ? 'Revoking...' : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================
// Tab 3: Revenue Summary
// ============================================
function RevenueSummaryTab() {
  const [modules, setModules] = useState<AdminModule[]>([])
  const [orgs, setOrgs] = useState<AdminOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setFetchError(null)
    try {
      const [modData, orgData] = await Promise.all([
        api.getAdminModules(),
        api.getAdminOrganizations({ limit: 100 }),
      ])
      setModules(modData.modules || [])
      setOrgs(orgData.organizations || [])
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setFetchError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (fetchError && modules.length === 0 && orgs.length === 0) {
    return (
      <ErrorState
        title="Failed to load revenue data"
        message={fetchError}
        onRetry={() => { setLoading(true); fetchData() }}
      />
    )
  }

  // Calculate revenue metrics
  const paidModules = modules.filter(m => !m.isFree && m.isActive)

  const monthlyRecurringRevenue = orgs.reduce((sum, org) => {
    return sum + (org.modules?.filter(m => m.status === 'active' && m.priceAtActivation > 0)
      .reduce((s, m) => s + m.priceAtActivation, 0) || 0)
  }, 0)

  const totalTrialSubs = orgs.reduce((sum, org) => {
    return sum + (org.modules?.filter(m => m.status === 'trial').length || 0)
  }, 0)

  const totalActiveSubs = orgs.reduce((sum, org) => {
    return sum + (org.modules?.filter(m => m.status === 'active').length || 0)
  }, 0)

  const conversionRate = totalTrialSubs + totalActiveSubs > 0
    ? Math.round((totalActiveSubs / (totalTrialSubs + totalActiveSubs)) * 100)
    : 0

  // Revenue by module
  const revenueByModule = paidModules.map(mod => {
    const revenue = orgs.reduce((sum, org) => {
      const sub = org.modules?.find(m => m.key === mod.key && (m.status === 'active' || m.status === 'trial'))
      return sum + (sub?.priceAtActivation || 0)
    }, 0)
    const subs = orgs.filter(org => org.modules?.some(m => m.key === mod.key && (m.status === 'active' || m.status === 'trial'))).length
    return { name: mod.name, revenue, subs, category: mod.category }
  }).filter(m => m.subs > 0).sort((a, b) => b.revenue - a.revenue)

  // Revenue by business type
  const revenueByType = ['retail', 'service', 'mixed'].map(type => {
    const typeOrgs = orgs.filter(o => o.businessType === type)
    const revenue = typeOrgs.reduce((sum, org) => {
      return sum + (org.modules?.filter(m => m.status === 'active' && m.priceAtActivation > 0)
        .reduce((s, m) => s + m.priceAtActivation, 0) || 0)
    }, 0)
    return { type: type.charAt(0).toUpperCase() + type.slice(1), revenue, count: typeOrgs.length }
  }).filter(t => t.count > 0)

  // Adoption data for chart
  const adoptionData = modules
    .filter(m => m.isActive)
    .sort((a, b) => b.orgCount - a.orgCount)
    .slice(0, 8)
    .map(m => ({ name: m.name.length > 15 ? m.name.slice(0, 15) + '...' : m.name, orgs: m.orgCount }))

  // MRR is the primary metric of this tab; the rest are neutral counts.
  const stats = [
    { title: 'Monthly Recurring Revenue', value: formatETB(monthlyRecurringRevenue), icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10' },
    { title: 'Active Subscriptions', value: totalActiveSubs, icon: CheckCircle2, color: 'text-muted-foreground', bg: 'bg-muted' },
    { title: 'Trial Subscriptions', value: totalTrialSubs, icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted' },
    { title: 'Trial→Active Rate', value: `${conversionRate}%`, icon: TrendingUp, color: 'text-muted-foreground', bg: 'bg-muted' },
  ]

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon className={`size-5 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{s.title}</p>
                  <p className="text-base font-semibold truncate">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by Module */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" /> Revenue by Module
            </CardTitle>
            <CardDescription>Which modules generate the most revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByModule.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueByModule} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: '0.846rem' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: '0.846rem' }} width={100} />
                  <Tooltip formatter={(value: number) => formatETB(value)} />
                  <Bar dataKey="revenue" fill="#ea580c" radius={[0, 4, 4, 0]} name="Revenue (ETB)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No revenue data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Business Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="size-4 text-primary" /> Revenue by Business Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={revenueByType}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={90}
                    paddingAngle={4} dataKey="revenue"
                    label={({ type, revenue }: { type: string; revenue: number }) => `${type} (${formatETB(revenue)})`}
                  >
                    {revenueByType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatETB(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Module Adoption */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpRight className="size-4 text-primary" /> Module Adoption Rates
          </CardTitle>
          <CardDescription>Number of organizations using each module</CardDescription>
        </CardHeader>
        <CardContent>
          {adoptionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={adoptionData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: '0.769rem' }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: '0.846rem' }} />
                <Tooltip />
                <Bar dataKey="orgs" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Organizations" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No adoption data</p>
          )}
        </CardContent>
      </Card>

      {/* Revenue Breakdown Table */}
      {revenueByModule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="size-4 text-primary" /> Revenue Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {revenueByModule.map((mod, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg flex items-center justify-center bg-muted shrink-0">
                      {getModuleIcon('puzzle')}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{mod.name}</p>
                      <p className="text-xs text-muted-foreground">{mod.subs} subscription{mod.subs !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-sm">{formatETB(mod.revenue)}/mo</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================
// Main Page
// ============================================
export function AdminModulesPage() {
  const [activeTab, setActiveTab] = useState('catalog')

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<Puzzle />}
        title="Module Management"
        subtitle="Manage platform modules, pricing, and organization subscriptions"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="catalog" className="gap-1.5 text-xs sm:text-sm">
            <Puzzle className="size-4" /><span className="hidden sm:inline">Module Catalog</span>
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-1.5 text-xs sm:text-sm">
            <Users className="size-4" /><span className="hidden sm:inline">Org Subscriptions</span>
          </TabsTrigger>
          <TabsTrigger value="revenue" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="size-4" /><span className="hidden sm:inline">Revenue</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          <ModuleCatalogTab />
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4">
          <OrgSubscriptionsTab />
        </TabsContent>

        <TabsContent value="revenue" className="mt-4">
          <RevenueSummaryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

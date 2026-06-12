'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Building2, Search, MapPin, Users, Store, CreditCard,
  Eye, Ban, CheckCircle2, ArrowRightLeft, Loader2,
  RefreshCw, ChevronRight, Package, Calendar,
  DollarSign, Globe2, AlertTriangle, Pencil, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { getNetworkErrorMessage } from '@/lib/validation'
import { businessTypeBadge, planBadge, statusBadge, moduleStatusBadge, formatDate } from '@/lib/admin-utils'
import { type AdminOrg } from '@/types/admin'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { swrFetch, invalidateKey } from '@/lib/client-cache'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const PAGE_SIZE = 10

// ============================================
// Tab 1: Organizations List
// ============================================
function OrganizationsListTab({
  onSelectOrg,
}: {
  onSelectOrg: (org: AdminOrg) => void
}) {
  const [orgs, setOrgs] = useState<AdminOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [businessTypeFilter, setBusinessTypeFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [regions, setRegions] = useState<Array<{ id: string; name: string; orgCount?: number }>>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)

  // Change plan dialog
  const [changePlanOrg, setChangePlanOrg] = useState<AdminOrg | null>(null)
  const [newPlan, setNewPlan] = useState('')
  const [changingPlan, setChangingPlan] = useState(false)

  // Suspend/Activate dialog
  const [statusOrg, setStatusOrg] = useState<AdminOrg | null>(null)
  const [changingStatus, setChangingStatus] = useState(false)

  // Edit org dialog
  const [editOrg, setEditOrg] = useState<AdminOrg | null>(null)
  const [editName, setEditName] = useState('')
  const [editBusinessType, setEditBusinessType] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Delete org dialog
  const [deleteOrg, setDeleteOrg] = useState<AdminOrg | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Fetch regions for filter
  useEffect(() => {
    api.getAdminRegions({ includeStats: true }).then(data => {
      setRegions(data.regions.map(r => ({ id: r.id, name: r.name, orgCount: r.orgCount })))
    }).catch(() => {})
  }, [])

  const fetchOrgs = useCallback(async () => {
    setFetchError(null)
    setIsRateLimited(false)
    setRetryAfter(null)
    try {
      // Use client-side SWR cache for organization list (YouTube pattern)
      const cacheKey = `admin:orgs:${search}:${page}:${regionFilter}`
      const data = await swrFetch(
        cacheKey,
        () => api.getAdminOrganizations({
          search: search || undefined,
          page,
          limit: PAGE_SIZE,
          regionId: regionFilter !== 'all' ? regionFilter : undefined,
        }),
        { dedupingInterval: 15_000 }
      )
      const allOrgs = data.organizations || []
      // Client-side filters for businessType, plan, status
      const filtered = allOrgs.filter(org => {
        if (businessTypeFilter !== 'all' && org.businessType !== businessTypeFilter) return false
        if (planFilter !== 'all' && org.subscriptionPlan !== planFilter) return false
        if (statusFilter !== 'all' && org.subscriptionStatus !== statusFilter) return false
        return true
      })
      setOrgs(filtered)
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      // Check if rate limited (429 error)
      if (msg.toLowerCase().includes('too many requests') || msg.toLowerCase().includes('rate limit')) {
        setIsRateLimited(true)
        setRetryAfter(60) // Default retry after 60 seconds
        setFetchError('Rate limit reached. Please wait before trying again.')
      } else {
        setFetchError(msg)
        toast.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [search, page, businessTypeFilter, planFilter, statusFilter, regionFilter])

  useEffect(() => {
    const timer = setTimeout(() => fetchOrgs(), 300)
    return () => clearTimeout(timer)
  }, [fetchOrgs])

  // Rate limit countdown
  useEffect(() => {
    if (!isRateLimited || retryAfter === null) return
    if (retryAfter <= 0) {
      setIsRateLimited(false)
      setRetryAfter(null)
      return
    }
    const timer = setTimeout(() => setRetryAfter(prev => prev !== null ? prev - 1 : null), 1000)
    return () => clearTimeout(timer)
  }, [isRateLimited, retryAfter])

  const handleChangePlan = async () => {
    if (!changePlanOrg || !newPlan) return
    setChangingPlan(true)
    try {
      await api.updateAdminOrgSubscription(changePlanOrg.id, { subscriptionPlan: newPlan })
      toast.success(`${changePlanOrg.name} plan changed to ${newPlan}`)
      setChangePlanOrg(null)
      setNewPlan('')
      invalidateKey('admin:orgs')
      fetchOrgs()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setChangingPlan(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!statusOrg) return
    setChangingStatus(true)
    try {
      const newStatus = statusOrg.subscriptionStatus === 'suspended' ? 'active' : 'suspended'
      await api.updateAdminOrgStatus(statusOrg.id, { subscriptionStatus: newStatus })
      toast.success(`${statusOrg.name} ${newStatus === 'suspended' ? 'suspended' : 'activated'}`)
      setStatusOrg(null)
      invalidateKey('admin:orgs')
      fetchOrgs()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setChangingStatus(false)
    }
  }

  const openEditOrg = (org: AdminOrg) => {
    setEditOrg(org)
    setEditName(org.name)
    setEditBusinessType(org.businessType)
    setEditDescription('')
    setEditAddress('')
    setEditCity(org.city || '')
    setEditPhone('')
  }

  const handleEditOrgSave = async () => {
    if (!editOrg) return
    setEditLoading(true)
    try {
      const data: Record<string, unknown> = {}
      if (editName.trim() !== editOrg.name) data.name = editName.trim()
      if (editBusinessType !== editOrg.businessType) data.businessType = editBusinessType
      if (editCity !== (editOrg.city || '')) data.city = editCity
      if (editDescription) data.description = editDescription
      if (editAddress) data.address = editAddress
      if (editPhone) data.phone = editPhone

      if (Object.keys(data).length === 0) {
        setEditOrg(null)
        setEditLoading(false)
        return
      }

      await api.updateAdminOrg(editOrg.id, data)
      toast.success(`Organization "${editName.trim()}" updated successfully`)
      setEditOrg(null)
      invalidateKey('admin:orgs')
      fetchOrgs()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeleteOrg = async () => {
    if (!deleteOrg) return
    setDeleteLoading(true)
    try {
      const result = await api.deleteAdminOrg(deleteOrg.id)
      toast.success(result.message || 'Organization deleted successfully')
      setDeleteOrg(null)
      invalidateKey('admin:orgs')
      fetchOrgs()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    )
  }

  if (fetchError && orgs.length === 0) {
    return (
      <ErrorState
        title="Failed to load organizations"
        message={fetchError}
        onRetry={() => { setLoading(true); fetchOrgs() }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Rate Limit Warning */}
      {isRateLimited && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-900/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Rate limit reached
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Too many requests. {retryAfter !== null && retryAfter > 0
                    ? `Please wait ${retryAfter}s before trying again.`
                    : 'You can try again now.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">

                {retryAfter !== null && retryAfter > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="text-xs"
                  >
                    <Loader2 className="size-3 animate-spin mr-1" />
                    {retryAfter}s
                  </Button>
                )}
                {retryAfter !== null && retryAfter <= 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => { setIsRateLimited(false); setLoading(true); fetchOrgs() }}
                  >
                    <RefreshCw className="size-3 mr-1" />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or city..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={businessTypeFilter} onValueChange={v => { setBusinessTypeFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="retail">Retail</SelectItem>
            <SelectItem value="service">Service</SelectItem>
            <SelectItem value="mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={v => { setPlanFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        {regions.length > 0 && (
          <Select value={regionFilter} onValueChange={v => { setRegionFilter(v); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="font-medium">All Regions</span>
              </SelectItem>
              {regions.map(r => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="flex items-center gap-2">
                    <Globe2 className="size-3 text-muted-foreground" />
                    <span>{r.name}</span>
                    <span className="text-muted-foreground text-xs">({r.orgCount ?? 0})</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">{orgs.length} organization(s) on this page</p>

      {/* Orgs List */}
      {orgs.length === 0 ? (
        <EmptyState
          title="No organizations found"
          message="No organizations match your search criteria."
        />
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto">
          {orgs.map(org => (
            <Card key={org.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Info */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onSelectOrg(org)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') onSelectOrg(org) }}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm truncate">{org.name}</h4>
                      <Badge className={businessTypeBadge(org.businessType)} variant="outline">
                        {org.businessType}
                      </Badge>
                      <Badge className={planBadge(org.subscriptionPlan)} variant="outline">
                        {org.subscriptionPlan}
                      </Badge>
                      <Badge className={statusBadge(org.subscriptionStatus)} variant="outline">
                        {org.subscriptionStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                      {org.city && <span className="flex items-center gap-1"><MapPin className="size-3" />{org.city}</span>}
                      {org.region && <span className="flex items-center gap-1"><Globe2 className="size-3" />{org.region.name}</span>}
                      <span className="flex items-center gap-1"><Users className="size-3" />{org.memberCount} members</span>
                      <span className="flex items-center gap-1"><Store className="size-3" />{org.shopCount} shops</span>
                      <span className="flex items-center gap-1"><DollarSign className="size-3" />{org.salesCount} sales</span>
                      <span className="flex items-center gap-1"><Calendar className="size-3" />{formatDate(org.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => onSelectOrg(org)}
                    >
                      <Eye className="size-3.5" />
                      <span className="hidden sm:inline">Details</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-8 text-xs gap-1 ${org.subscriptionStatus === 'suspended' ? 'text-emerald-600 hover:text-emerald-700' : 'text-red-600 hover:text-red-700'}`}
                      onClick={() => setStatusOrg(org)}
                    >
                      {org.subscriptionStatus === 'suspended' ? <CheckCircle2 className="size-3.5" /> : <Ban className="size-3.5" />}
                      <span className="hidden sm:inline">{org.subscriptionStatus === 'suspended' ? 'Activate' : 'Suspend'}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1 text-primary hover:text-primary"
                      onClick={() => { setChangePlanOrg(org); setNewPlan(org.subscriptionPlan) }}
                    >
                      <ArrowRightLeft className="size-3.5" />
                      <span className="hidden sm:inline">Plan</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1 text-muted-foreground hover:text-primary"
                      onClick={() => openEditOrg(org)}
                    >
                      <Pencil className="size-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1 text-muted-foreground hover:text-red-600"
                      onClick={() => setDeleteOrg(org)}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Change Plan Dialog */}
      <Dialog open={!!changePlanOrg} onOpenChange={open => { if (!open) setChangePlanOrg(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>
              Change subscription plan for <strong>{changePlanOrg?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <Select value={newPlan} onValueChange={setNewPlan}>
            <SelectTrigger>
              <SelectValue placeholder="Select plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanOrg(null)}>Cancel</Button>
            <Button onClick={handleChangePlan} disabled={changingPlan || !newPlan || newPlan === changePlanOrg?.subscriptionPlan}>
              {changingPlan && <Loader2 className="size-4 animate-spin mr-1" />}
              Change Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend/Activate Confirmation Dialog */}
      <Dialog open={!!statusOrg} onOpenChange={open => { if (!open) setStatusOrg(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{statusOrg?.subscriptionStatus === 'suspended' ? 'Activate Organization' : 'Suspend Organization'}</DialogTitle>
            <DialogDescription>
              {statusOrg?.subscriptionStatus === 'suspended'
                ? `Are you sure you want to activate ${statusOrg?.name}? They will regain access to their account.`
                : `Are you sure you want to suspend ${statusOrg?.name}? They will lose access to their account.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOrg(null)}>Cancel</Button>
            <Button
              onClick={handleToggleStatus}
              disabled={changingStatus}
              variant={statusOrg?.subscriptionStatus === 'suspended' ? 'default' : 'destructive'}
            >
              {changingStatus && <Loader2 className="size-4 animate-spin mr-1" />}
              {statusOrg?.subscriptionStatus === 'suspended' ? 'Activate' : 'Suspend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Dialog */}
      <Dialog open={!!editOrg} onOpenChange={open => { if (!open) setEditOrg(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>Update organization details.</DialogDescription>
          </DialogHeader>
          {editOrg && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Organization Name</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Organization name" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Business Type</Label>
                <Select value={editBusinessType} onValueChange={setEditBusinessType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">City</Label>
                <Input value={editCity} onChange={e => setEditCity(e.target.value)} placeholder="City" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Address</Label>
                <Input value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Address" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Phone</Label>
                <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Description</Label>
                <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Brief description..." rows={2} />
              </div>
              {/* Current plan/status (read-only) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-xs text-muted-foreground">Current Plan</p>
                  <Badge className={planBadge(editOrg.subscriptionPlan)} variant="outline">{editOrg.subscriptionPlan}</Badge>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={statusBadge(editOrg.subscriptionStatus)} variant="outline">{editOrg.subscriptionStatus}</Badge>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrg(null)} disabled={editLoading}>Cancel</Button>
            <Button onClick={handleEditOrgSave} disabled={editLoading}>
              {editLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Organization Confirmation */}
      <AlertDialog open={!!deleteOrg} onOpenChange={open => { if (!open) setDeleteOrg(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              Delete Organization
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to delete <strong>{deleteOrg?.name}</strong>?
                  This action cannot be undone.
                </p>
                <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-200">
                  <strong>Warning:</strong> This will permanently delete all data including shops, members, products, sales, customers, debts, and all other records for this organization.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrg}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Delete Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================
// Tab 2: Organization Detail
// ============================================
function OrgDetailTab({ org, onBack }: { org: AdminOrg; onBack: () => void }) {
  const [allModules, setAllModules] = useState<Array<{ key: string; name: string }>>([])
  const [assignModuleKey, setAssignModuleKey] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    api.getAdminModules().then(data => {
      setAllModules((data.modules || []).map(m => ({ key: m.key, name: m.name })))
    }).catch(() => {})
  }, [])

  const handleAssignModule = async () => {
    if (!assignModuleKey) {
      toast.error('Select a module to assign')
      return
    }
    setAssigning(true)
    try {
      await api.assignModuleToOrg(org.id, { moduleKey: assignModuleKey, status: 'trial', durationDays: 30 })
      toast.success(`Module assigned with 30-day trial`)
      setAssignModuleKey('')
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setAssigning(false)
    }
  }

  const assignedKeys = (org.modules || []).map(m => m.key)
  const availableModules = allModules.filter(m => !assignedKeys.includes(m.key))

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
        <ChevronRight className="size-4 rotate-180" />
        Back to List
      </Button>

      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            {org.name}
          </CardTitle>
          <CardDescription>Organization overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground">Business Type</p>
              <Badge className={businessTypeBadge(org.businessType)} variant="outline">{org.businessType}</Badge>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground">City</p>
              <p className="text-sm font-medium">{org.city || 'N/A'}</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground">Plan</p>
              <Badge className={planBadge(org.subscriptionPlan)} variant="outline">{org.subscriptionPlan}</Badge>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge className={statusBadge(org.subscriptionStatus)} variant="outline">{org.subscriptionStatus}</Badge>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground">Members</p>
              <p className="text-sm font-medium">{org.memberCount}</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm font-medium">{formatDate(org.createdAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Members List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="size-4 text-primary" />
              Members ({org.members?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!org.members || org.members.length === 0) ? (
              <p className="text-xs text-muted-foreground text-center py-4">No members</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {org.members.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded-lg border bg-muted/20">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0 ml-2">{member.role}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shops List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Store className="size-4 text-primary" />
              Shops ({org.shops?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!org.shops || org.shops.length === 0) ? (
              <p className="text-xs text-muted-foreground text-center py-4">No shops</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {org.shops.map(shop => (
                  <div key={shop.id} className="flex items-center justify-between p-2 rounded-lg border bg-muted/20">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{shop.name}</p>
                      <p className="text-xs text-muted-foreground">{shop.city || 'No city'}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ml-2 ${shop.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400'}`}
                    >
                      {shop.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Modules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="size-4 text-primary" />
            Active Modules ({org.modules?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!org.modules || org.modules.length === 0) ? (
            <p className="text-xs text-muted-foreground text-center py-4">No active modules</p>
          ) : (
            <>
              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Module</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {org.modules.map(mod => (
                      <TableRow key={mod.id}>
                        <TableCell className="text-sm font-medium">{mod.name}</TableCell>
                        <TableCell>
                          <Badge className={moduleStatusBadge(mod.status)} variant="outline">{mod.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {mod.expiresAt ? formatDate(mod.expiresAt) : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile card view */}
              <div className="md:hidden space-y-2">
                {org.modules.map(mod => (
                  <div key={mod.id} className="p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{mod.name}</span>
                      <Badge className={moduleStatusBadge(mod.status)} variant="outline">{mod.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Expires: {mod.expiresAt ? formatDate(mod.expiresAt) : 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Revenue Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="size-4 text-primary" />
            Sales Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Products</p>
              <p className="text-base font-semibold">{org.productCount}</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Total Sales</p>
              <p className="text-base font-semibold text-primary">{org.salesCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Assign Module */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={assignModuleKey} onValueChange={setAssignModuleKey}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select module to assign..." />
              </SelectTrigger>
              <SelectContent>
                {availableModules.length === 0 ? (
                  <SelectItem value="_none" disabled>All modules already assigned</SelectItem>
                ) : (
                  availableModules.map(m => (
                    <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAssignModule}
              disabled={assigning || !assignModuleKey || assignModuleKey === '_none'}
              className="gap-1.5"
            >
              {assigning && <Loader2 className="size-4 animate-spin" />}
              <Package className="size-4" />
              Assign Module
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// Main Page Component
// ============================================
export function AdminOrganizationsPage() {
  const [activeTab, setActiveTab] = useState('list')
  const [selectedOrg, setSelectedOrg] = useState<AdminOrg | null>(null)

  const handleSelectOrg = (org: AdminOrg) => {
    setSelectedOrg(org)
    setActiveTab('detail')
  }

  const handleBackToList = () => {
    setSelectedOrg(null)
    setActiveTab('list')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight">
            Organizations
          </h1>
          <p className="text-muted-foreground text-sm">Manage organizations, subscriptions, and modules</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list" className="gap-1.5 text-xs sm:text-sm">
            <Building2 className="size-4" />
            <span className="hidden sm:inline">All Organizations</span>
          </TabsTrigger>
          {selectedOrg && (
            <TabsTrigger value="detail" className="gap-1.5 text-xs sm:text-sm">
              <Eye className="size-4" />
              <span className="hidden sm:inline">Detail</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <OrganizationsListTab onSelectOrg={handleSelectOrg} />
        </TabsContent>

        {selectedOrg && (
          <TabsContent value="detail" className="mt-4">
            <OrgDetailTab org={selectedOrg} onBack={handleBackToList} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

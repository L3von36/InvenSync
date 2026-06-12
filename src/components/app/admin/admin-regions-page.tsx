'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MapPin, Building2, Users, DollarSign, Store, Plus, Search,
  RefreshCw, ArrowLeft, Edit2, Trash2, TrendingUp, ChevronRight,
  Globe2, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, type RegionData, type RegionDetailData } from '@/lib/api-client'
import { useAppStore } from '@/lib/stores/app-store'
import { getNetworkErrorMessage } from '@/lib/validation'
import { formatETB, slugify } from '@/lib/admin-utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from '@/components/ui/recharts-exports'

// ============================================
// Region Form Dialog (Add / Edit)
// ============================================
interface RegionFormData {
  name: string
  slug: string
  country: string
  latitude: string
  longitude: string
  population: string
  description: string
}

const emptyForm: RegionFormData = {
  name: '',
  slug: '',
  country: 'Ethiopia',
  latitude: '',
  longitude: '',
  population: '',
  description: '',
}

function RegionFormDialog({
  open,
  onOpenChange,
  mode,
  region,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'edit'
  region?: RegionData | null
  onSuccess: () => void
}) {
  const [form, setForm] = useState<RegionFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && region) {
        setForm({
          name: region.name,
          slug: region.slug,
          country: region.country || 'Ethiopia',
          latitude: region.latitude != null ? String(region.latitude) : '',
          longitude: region.longitude != null ? String(region.longitude) : '',
          population: region.population != null ? String(region.population) : '',
          description: region.description || '',
        })
        setSlugManuallyEdited(true)
      } else {
        setForm(emptyForm)
        setSlugManuallyEdited(false)
      }
    }
  }, [open, mode, region])

  const handleNameChange = (name: string) => {
    setForm(prev => {
      const newSlug = slugManuallyEdited ? prev.slug : slugify(name)
      return { ...prev, name, slug: newSlug }
    })
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error('Name and slug are required')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        country: form.country.trim() || 'Ethiopia',
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        population: form.population ? parseInt(form.population, 10) : null,
        description: form.description.trim() || null,
      }
      if (mode === 'edit' && region) {
        await api.updateAdminRegion(region.id, payload)
        toast.success('Region updated successfully')
      } else {
        await api.createAdminRegion(payload)
        toast.success('Region created successfully')
      }
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Region' : 'Add Region'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name *</label>
            <Input
              placeholder="e.g. Addis Ababa"
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Slug *</label>
            <Input
              placeholder="e.g. addis-ababa"
              value={form.slug}
              onChange={e => { setForm(prev => ({ ...prev, slug: e.target.value })); setSlugManuallyEdited(true) }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Country</label>
            <Input
              placeholder="Ethiopia"
              value={form.country}
              onChange={e => setForm(prev => ({ ...prev, country: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Latitude</label>
              <Input
                placeholder="9.0250"
                value={form.latitude}
                onChange={e => setForm(prev => ({ ...prev, latitude: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Longitude</label>
              <Input
                placeholder="38.7469"
                value={form.longitude}
                onChange={e => setForm(prev => ({ ...prev, longitude: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Population</label>
            <Input
              placeholder="e.g. 3000000"
              value={form.population}
              onChange={e => setForm(prev => ({ ...prev, population: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Input
              placeholder="Brief description of the region"
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.name.trim() || !form.slug.trim()}>
            {saving && <Loader2 className="size-4 animate-spin mr-1" />}
            {mode === 'edit' ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Delete Confirmation Dialog
// ============================================
function DeleteRegionDialog({
  open,
  onOpenChange,
  region,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  region: RegionData | null
  onSuccess: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!region) return
    setDeleting(true)
    try {
      await api.deleteAdminRegion(region.id)
      toast.success('Region deleted successfully')
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Region</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <strong>{region?.name}</strong>? Organizations and sales reps in this region will be unlinked. This action cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting && <Loader2 className="size-4 animate-spin mr-1" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Main Component
// ============================================
export function AdminRegionsPage() {
  const { setPage } = useAppStore()

  // Data state
  const [regions, setRegions] = useState<RegionData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [regionDetail, setRegionDetail] = useState<RegionDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState('overview')

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editRegion, setEditRegion] = useState<RegionData | null>(null)
  const [deleteRegion, setDeleteRegion] = useState<RegionData | null>(null)

  // Search in region detail
  const [orgSearch, setOrgSearch] = useState('')

  // Fetch regions list
  const fetchRegions = useCallback(async () => {
    try {
      const data = await api.getAdminRegions({ includeStats: 'true' })
      setRegions(data.regions || [])
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch region detail
  const fetchRegionDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const detail = await api.getAdminRegion(id)
      setRegionDetail(detail)
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchRegions()
  }, [fetchRegions])

  // Fetch detail when selected region changes
  useEffect(() => {
    if (selectedRegionId) {
      fetchRegionDetail(selectedRegionId)
    } else {
      setRegionDetail(null)
    }
  }, [selectedRegionId, fetchRegionDetail])

  // Auto-switch to detail tab when region selected
  const handleSelectRegion = (id: string | null) => {
    setSelectedRegionId(id)
    if (id) {
      setActiveTab('detail')
    } else {
      setActiveTab('overview')
    }
  }

  // Computed stats
  const totalOrgs = regions.reduce((sum, r) => sum + (r.orgCount || 0), 0)
  const totalRevenue = regions.reduce((sum, r) => sum + (r.revenue || 0), 0)
  const avgOrgsPerRegion = regions.length > 0 ? Math.round(totalOrgs / regions.length) : 0

  // Chart data
  const orgChartData = regions.map(r => ({ name: r.name, orgs: r.orgCount || 0 }))
  const revenueChartData = regions.map(r => ({ name: r.name, revenue: r.revenue || 0 }))

  // Filtered organizations in region detail
  const filteredOrgs = regionDetail?.organizations?.filter(org =>
    !orgSearch || org.name.toLowerCase().includes(orgSearch.toLowerCase())
  ) || []

  // Refresh
  const handleRefresh = () => {
    setLoading(true)
    fetchRegions()
    if (selectedRegionId) {
      fetchRegionDetail(selectedRegionId)
    }
  }

  // ============================================
  // Loading skeleton
  // ============================================
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-32 shrink-0" />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    )
  }

  // ============================================
  // Render
  // ============================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Regions & Cities</h1>
          <p className="text-muted-foreground text-sm">Manage cities where InvenSync operates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRefresh}>
            <RefreshCw className="size-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAddDialogOpen(true)}>
            <Plus className="size-4" />
            Add Region
          </Button>
        </div>
      </div>

      {/* Region Selector Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <button
          className={`shrink-0 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
            !selectedRegionId
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card text-card-foreground border-border hover:bg-muted/50'
          }`}
          onClick={() => handleSelectRegion(null)}
        >
          All
        </button>
        {regions.map(region => (
          <button
            key={region.id}
            className={`shrink-0 px-4 py-2 rounded-lg border text-sm transition-colors ${
              selectedRegionId === region.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-card-foreground border-border hover:bg-muted/50'
            }`}
            onClick={() => handleSelectRegion(region.id)}
          >
            <span className="font-medium">{region.name}</span>
            <span className={`ml-1.5 text-xs ${selectedRegionId === region.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
              ({region.orgCount ?? 0})
            </span>
          </button>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
            <Globe2 className="size-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          {selectedRegionId && (
            <TabsTrigger value="detail" className="gap-1.5 text-xs sm:text-sm">
              <MapPin className="size-4" />
              <span className="hidden sm:inline">Region Detail</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="comparison" className="gap-1.5 text-xs sm:text-sm">
            <TrendingUp className="size-4" />
            <span className="hidden sm:inline">Comparison</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Globe2 className="size-4" />
                  <span className="text-xs">Total Regions</span>
                </div>
                <p className="text-xl font-semibold">{regions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Building2 className="size-4" />
                  <span className="text-xs">Total Orgs</span>
                </div>
                <p className="text-xl font-semibold">{totalOrgs}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="size-4" />
                  <span className="text-xs">Total Revenue</span>
                </div>
                <p className="text-xl font-semibold">{formatETB(totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="size-4" />
                  <span className="text-xs">Avg Orgs/Region</span>
                </div>
                <p className="text-xl font-semibold">{avgOrgsPerRegion}</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Organizations by Region</CardTitle>
              </CardHeader>
              <CardContent>
                {orgChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={orgChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="orgs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Revenue by Region</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => formatETB(value)} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Region Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {regions.map(region => (
              <Card key={region.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MapPin className="size-4 text-primary" />
                      {region.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setEditRegion(region)}
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                        onClick={() => setDeleteRegion(region)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  {region.description && (
                    <CardDescription className="text-xs line-clamp-2">{region.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {region.population != null && (
                    <p className="text-xs text-muted-foreground">
                      Pop: {region.population.toLocaleString()}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-md bg-muted/30 border">
                      <p className="text-muted-foreground">Orgs</p>
                      <p className="font-semibold">{region.orgCount ?? 0}</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/30 border">
                      <p className="text-muted-foreground">Users</p>
                      <p className="font-semibold">{region.userCount ?? 0}</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/30 border">
                      <p className="text-muted-foreground">Shops</p>
                      <p className="font-semibold">{region.shopCount ?? 0}</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/30 border">
                      <p className="text-muted-foreground">Revenue</p>
                      <p className="font-semibold">{formatETB(region.revenue ?? 0)}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs"
                    onClick={() => handleSelectRegion(region.id)}
                  >
                    View Details
                    <ChevronRight className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {regions.length === 0 && (
            <div className="text-center py-12">
              <Globe2 className="size-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-medium">No regions found</h3>
              <p className="text-xs text-muted-foreground mt-1">Add a region to get started.</p>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Region Detail */}
        {selectedRegionId && (
          <TabsContent value="detail" className="mt-4 space-y-4">
            {/* Back Button */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => handleSelectRegion(null)}
            >
              <ArrowLeft className="size-4" />
              Back to Overview
            </Button>

            {detailLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
                </div>
                <Skeleton className="h-48" />
              </div>
            ) : regionDetail ? (
              <>
                {/* Region Info Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MapPin className="size-5 text-primary" />
                        {regionDetail.name}
                      </CardTitle>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => setEditRegion(regionDetail)}
                        >
                          <Edit2 className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs text-red-600 hover:text-red-700"
                          onClick={() => setDeleteRegion(regionDetail)}
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    {regionDetail.description && (
                      <CardDescription>{regionDetail.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg border bg-muted/30">
                        <p className="text-xs text-muted-foreground">Country</p>
                        <p className="text-sm font-medium">{regionDetail.country}</p>
                      </div>
                      {regionDetail.population != null && (
                        <div className="p-3 rounded-lg border bg-muted/30">
                          <p className="text-xs text-muted-foreground">Population</p>
                          <p className="text-sm font-medium">{regionDetail.population.toLocaleString()}</p>
                        </div>
                      )}
                      {regionDetail.latitude != null && regionDetail.longitude != null && (
                        <div className="p-3 rounded-lg border bg-muted/30">
                          <p className="text-xs text-muted-foreground">Coordinates</p>
                          <p className="text-sm font-medium">
                            {regionDetail.latitude.toFixed(4)}, {regionDetail.longitude.toFixed(4)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Building2 className="size-4" />
                        <span className="text-xs">Organizations</span>
                      </div>
                      <p className="text-xl font-semibold">{regionDetail.orgCount ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Users className="size-4" />
                        <span className="text-xs">Users</span>
                      </div>
                      <p className="text-xl font-semibold">{regionDetail.userCount ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Store className="size-4" />
                        <span className="text-xs">Shops</span>
                      </div>
                      <p className="text-xl font-semibold">{regionDetail.shopCount ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <DollarSign className="size-4" />
                        <span className="text-xs">Revenue</span>
                      </div>
                      <p className="text-xl font-semibold">{formatETB(regionDetail.revenue ?? 0)}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Organizations List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="size-4 text-primary" />
                      Organizations ({regionDetail.organizations?.length ?? 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        placeholder="Search organizations..."
                        value={orgSearch}
                        onChange={e => setOrgSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {filteredOrgs.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        {orgSearch ? 'No organizations match your search' : 'No organizations in this region'}
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredOrgs.map(org => (
                          <div
                            key={org.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{org.name}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                <Badge variant="outline" className="text-[10px]">{org.businessType}</Badge>
                                <Badge variant="outline" className="text-[10px]">{org.subscriptionPlan}</Badge>
                                <span className="flex items-center gap-1">
                                  <Users className="size-3" />{org.memberCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Store className="size-3" />{org.shopCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <DollarSign className="size-3" />{formatETB(org.revenue)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Sales Reps */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="size-4 text-primary" />
                      Assigned Sales Reps ({regionDetail.salesReps?.length ?? 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!regionDetail.salesReps || regionDetail.salesReps.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No sales reps assigned</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {regionDetail.salesReps.map(rep => (
                          <div
                            key={rep.id}
                            className="flex items-center justify-between p-2 rounded-lg border bg-muted/20"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{rep.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{rep.email}</p>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <p className="text-xs text-muted-foreground">
                                {rep.registrations} registrations
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {rep.commissionRate}% commission
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">Failed to load region details</p>
              </div>
            )}
          </TabsContent>
        )}

        {/* Tab 3: Comparison */}
        <TabsContent value="comparison" className="mt-4 space-y-4">
          {regions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">No regions to compare</p>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Region Comparison</CardTitle>
                <CardDescription>Compare all regions side by side</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Region</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Orgs</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Users</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Shops</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Revenue</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Avg Rev/Org</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regions.map(region => {
                        const avgRevPerOrg = (region.orgCount ?? 0) > 0
                          ? Math.round((region.revenue ?? 0) / (region.orgCount ?? 1))
                          : 0
                        return (
                          <tr key={region.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <MapPin className="size-3.5 text-primary shrink-0" />
                                <span className="font-medium truncate">{region.name}</span>
                              </div>
                            </td>
                            <td className="text-right py-2.5 px-3">{region.orgCount ?? 0}</td>
                            <td className="text-right py-2.5 px-3">{region.userCount ?? 0}</td>
                            <td className="text-right py-2.5 px-3">{region.shopCount ?? 0}</td>
                            <td className="text-right py-2.5 px-3">{formatETB(region.revenue ?? 0)}</td>
                            <td className="text-right py-2.5 px-3">{formatETB(avgRevPerOrg)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold bg-muted/20">
                        <td className="py-2.5 px-3">Total</td>
                        <td className="text-right py-2.5 px-3">{totalOrgs}</td>
                        <td className="text-right py-2.5 px-3">
                          {regions.reduce((sum, r) => sum + (r.userCount || 0), 0)}
                        </td>
                        <td className="text-right py-2.5 px-3">
                          {regions.reduce((sum, r) => sum + (r.shopCount || 0), 0)}
                        </td>
                        <td className="text-right py-2.5 px-3">{formatETB(totalRevenue)}</td>
                        <td className="text-right py-2.5 px-3">
                          {formatETB(totalOrgs > 0 ? Math.round(totalRevenue / totalOrgs) : 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <RegionFormDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        mode="add"
        onSuccess={handleRefresh}
      />
      <RegionFormDialog
        open={!!editRegion}
        onOpenChange={open => { if (!open) setEditRegion(null) }}
        mode="edit"
        region={editRegion}
        onSuccess={handleRefresh}
      />
      <DeleteRegionDialog
        open={!!deleteRegion}
        onOpenChange={open => { if (!open) setDeleteRegion(null) }}
        region={deleteRegion}
        onSuccess={handleRefresh}
      />
    </div>
  )
}

'use client'

import { PageHeader } from '@/components/shared/design-system'

import React, { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import {
  Store, MapPin, Phone, Users, Package, ChevronDown, ChevronUp,
  Pencil, UserPlus, Trash2, Loader2, Plus, Building2,
} from 'lucide-react'
import { api, type ShopWithDetails } from '@/lib/api-client'
import { LocationPicker } from '@/components/app/shared/location-picker'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { getNetworkErrorMessage } from '@/lib/validation'
import { shopSchema, type ShopFormData } from '@/lib/validations'
import { ErrorState } from '@/components/shared/error-states'
import { Form } from '@/components/ui/form'
import { FormInputField, FormSubmitButton } from '@/components/shared/form-fields'

// ============================================
// Branches Page — Business Dashboard
// ============================================
// This page gives business users direct access to manage their
// branches (shops) without navigating to Settings → Shops.
// Admin users should NOT see this page — branches belong to businesses.

export function BranchesPage() {
  const { currentOrg, shops, currentShop, setCurrentShop } = useAuthStore()
  const orgId = currentOrg?.id || ''

  const [branchList, setBranchList] = useState<ShopWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [editingShopId, setEditingShopId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedShop, setExpandedShop] = useState<string | null>(null)

  const [orgMembers, setOrgMembers] = useState<Array<{
    id: string; userId: string; role: string;
    user: { id: string; name: string; email: string }
  }>>([])

  const [showAddMember, setShowAddMember] = useState<string | null>(null)
  const [addMemberUserId, setAddMemberUserId] = useState('')
  const [addMemberRole, setAddMemberRole] = useState('cashier')
  const [addMemberSaving, setAddMemberSaving] = useState(false)

  // Shop form
  const shopForm = useForm<ShopFormData>({
    resolver: zodResolver(shopSchema),
    defaultValues: { name: '', address: '', city: '', phone: '', latitude: null, longitude: null },
  })

  const fetchShops = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      setFetchError(null)
      const data = await api.getShops(orgId)
      setBranchList(data.shops)
    } catch (err) {
      setFetchError(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [orgId])

  const fetchOrgMembers = useCallback(async () => {
    if (!orgId) return
    try {
      const data = await api.getOrganization(orgId)
      setOrgMembers(data.organization.members || [])
    } catch {
      // Member assignment needs this list — tell the user instead of
      // showing an inexplicably empty selector
      toast.error('Could not load team members. Refresh the page to retry.')
    }
  }, [orgId])

  useEffect(() => { fetchShops(); fetchOrgMembers() }, [fetchShops, fetchOrgMembers])

  const openCreateDialog = () => {
    setEditingShopId(null)
    shopForm.reset({ name: '', address: '', city: '', phone: '', latitude: null, longitude: null })
    setShowDialog(true)
  }

  const openEditDialog = (shop: typeof branchList[0]) => {
    setEditingShopId(shop.id)
    shopForm.reset({
      name: shop.name,
      address: shop.address || '',
      city: shop.city || '',
      phone: shop.phone || '',
      latitude: shop.latitude ?? null,
      longitude: shop.longitude ?? null,
    })
    setShowDialog(true)
  }

  const handleSaveShop = async (data: ShopFormData) => {
    setSaving(true)
    try {
      if (editingShopId) {
        await api.updateShop(editingShopId, orgId, {
          name: data.name, address: data.address || undefined, city: data.city || undefined,
          phone: data.phone || undefined, latitude: data.latitude || undefined, longitude: data.longitude || undefined,
        })
        toast.success('Branch updated successfully')
      } else {
        await api.createShop(orgId, {
          name: data.name, address: data.address || undefined, city: data.city || undefined,
          phone: data.phone || undefined, latitude: data.latitude || undefined, longitude: data.longitude || undefined,
        })
        toast.success('Branch created successfully')
      }
      setShowDialog(false); fetchShops()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally { setSaving(false) }
  }

  const handleToggleActive = async (shop: typeof branchList[0]) => {
    try {
      await api.updateShop(shop.id, orgId, { isActive: !shop.isActive })
      toast.success(shop.isActive ? 'Branch deactivated' : 'Branch activated')
      fetchShops()
    } catch (err) { toast.error(getNetworkErrorMessage(err)) }
  }

  const handleAddMember = async () => {
    if (!addMemberUserId) { toast.error('Please select a member'); return }
    setAddMemberSaving(true)
    try {
      await api.addShopMember(showAddMember!, orgId, { userId: addMemberUserId, role: addMemberRole })
      toast.success('Member added to branch')
      setShowAddMember(null); setAddMemberUserId(''); setAddMemberRole('cashier')
      fetchShops()
    } catch (err: unknown) {
      toast.error(getNetworkErrorMessage(err))
    } finally { setAddMemberSaving(false) }
  }

  const handleUpdateMemberRole = async (shopId: string, memberId: string, role: string) => {
    try {
      await api.updateShopMember(shopId, memberId, orgId, { role })
      toast.success('Role updated'); fetchShops()
    } catch (err) { toast.error(getNetworkErrorMessage(err)) }
  }

  const [removeMemberTarget, setRemoveMemberTarget] = useState<{ shopId: string; memberId: string; memberName: string; shopName: string } | null>(null)
  const [removingMember, setRemovingMember] = useState(false)

  const handleRemoveMember = async () => {
    if (!removeMemberTarget) return
    const { shopId, memberId } = removeMemberTarget
    setRemovingMember(true)
    try {
      await api.removeShopMember(shopId, memberId, orgId)
      toast.success('Member removed from branch')
      setRemoveMemberTarget(null)
      fetchShops()
    } catch (err) { toast.error(getNetworkErrorMessage(err)) }
    finally { setRemovingMember(false) }
  }

  // Stats
  const activeBranches = branchList.filter(s => s.isActive).length
  const totalProducts = branchList.reduce((sum, s) => sum + s._count.products, 0)
  const totalMembers = branchList.reduce((sum, s) => sum + s.members.length, 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}><CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" />
          </CardContent></Card>
        ))}
      </div>
    )
  }

  if (fetchError) {
    return <ErrorState title="Failed to load branches" error={fetchError} onRetry={fetchShops} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<Store />}
        title="Branches"
        subtitle="Manage your shop locations and branch teams"
        actions={
          <Button onClick={openCreateDialog} className="gap-2 w-full sm:w-auto">
            <Plus className="size-4" /> Add Branch
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0">
                <Store className="size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total Branches</p>
                <p className="text-xl sm:text-2xl font-semibold tabular-nums">{branchList.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <Building2 className="size-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-xl sm:text-2xl font-semibold tabular-nums">{activeBranches}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Package className="size-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total Products</p>
                <p className="text-xl sm:text-2xl font-semibold tabular-nums">{totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                <Users className="size-5 text-violet-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Team Members</p>
                <p className="text-xl sm:text-2xl font-semibold tabular-nums">{totalMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branches List */}
      {branchList.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Store className="size-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-semibold mb-1">No branches yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your first shop location to get started</p>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="size-4" /> Add First Branch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {branchList.map((shop) => (
            <Collapsible key={shop.id} open={expandedShop === shop.id} onOpenChange={(open) => setExpandedShop(open ? shop.id : null)}>
              <Card className={!shop.isActive ? 'opacity-60' : ''}>
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="size-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0">
                        <Store className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold truncate">{shop.name}</h4>
                          <Badge variant="outline" className={shop.isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' : 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700'}>
                            {shop.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {currentShop?.id === shop.id && (
                            <Badge className="bg-primary text-primary-foreground text-[10px]">Current</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                          {shop.address && <span className="flex items-center gap-1 truncate"><MapPin className="size-3.5 shrink-0" /><span className="truncate">{shop.address}</span></span>}
                          {shop.city && <span>{shop.city}</span>}
                          {shop.phone && <span className="flex items-center gap-1"><Phone className="size-3.5 shrink-0" />{shop.phone}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="size-3.5" />{shop.members.length} member{shop.members.length !== 1 ? 's' : ''}</span>
                          <span className="flex items-center gap-1"><Package className="size-3.5" />{shop._count.products} product{shop._count.products !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {currentShop?.id !== shop.id && shop.isActive && (
                        <Button variant="outline" size="sm" className="flex gap-1" onClick={() => setCurrentShop(shop)}>
                          <span className="sm:hidden">↗</span>
                          <span>Switch</span>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="size-9 md:size-8" onClick={() => openEditDialog(shop)} aria-label="Edit"><Pencil className="size-4" /></Button>
                      <Switch checked={shop.isActive} onCheckedChange={() => handleToggleActive(shop)} />
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1">
                          {expandedShop === shop.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                          <span className="hidden sm:inline">Team</span>
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardContent>
                <CollapsibleContent>
                  <div className="border-t px-4 md:px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-medium">Branch Team</h5>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setShowAddMember(shop.id); setAddMemberUserId(''); setAddMemberRole('cashier') }}>
                        <UserPlus className="size-3.5" />Add Member
                      </Button>
                    </div>
                    {shop.members.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No members assigned to this branch yet</p>
                    ) : (
                      <div className="space-y-2">
                        {shop.members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                {member.user.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{member.user.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Select value={member.role} onValueChange={(role) => handleUpdateMemberRole(shop.id, member.id, role)}>
                                <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="manager">Manager</SelectItem>
                                  <SelectItem value="cashier">Cashier</SelectItem>
                                  <SelectItem value="warehouse">Warehouse</SelectItem>
                                  <SelectItem value="sales">Sales</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-destructive" onClick={() => setRemoveMemberTarget({ shopId: shop.id, memberId: member.id, memberName: member.user.name, shopName: shop.name })} aria-label="Delete">
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Add/Edit Branch Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        if (!open) shopForm.reset()
        setShowDialog(open)
      }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingShopId ? 'Edit Branch' : 'Add New Branch'}</DialogTitle>
            <DialogDescription>{editingShopId ? 'Update branch details' : 'Add a new branch location to your organization'}</DialogDescription>
          </DialogHeader>
          <Form {...shopForm}>
            <form onSubmit={shopForm.handleSubmit(handleSaveShop)} className="space-y-4">
              <FormInputField<ShopFormData>
                name="name"
                label="Branch Name"
                placeholder="e.g. Bole Main Branch"
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInputField<ShopFormData>
                  name="address"
                  label="Address"
                  placeholder="e.g. Bole Road, Atlas Building"
                />
                <FormInputField<ShopFormData>
                  name="city"
                  label="City"
                  placeholder="e.g. Addis Ababa"
                />
              </div>
              <FormInputField<ShopFormData>
                name="phone"
                label="Phone"
                placeholder="e.g. +251111234567"
              />
              <div className="space-y-2">
                <Label>Location</Label>
                <LocationPicker
                  latitude={shopForm.watch('latitude') ?? null}
                  longitude={shopForm.watch('longitude') ?? null}
                  onChange={(lat, lng) => {
                    shopForm.setValue('latitude', lat)
                    shopForm.setValue('longitude', lng)
                  }}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowDialog(false); shopForm.reset() }}>Cancel</Button>
                <FormSubmitButton
                  isLoading={saving}
                  loadingText="Saving..."
                >
                  {editingShopId ? 'Save Changes' : 'Create Branch'}
                </FormSubmitButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={!!showAddMember} onOpenChange={(open) => { if (!open) setShowAddMember(null) }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Branch Member</DialogTitle>
            <DialogDescription>Select an organization member and assign a branch role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Member</Label>
              <Select value={addMemberUserId} onValueChange={setAddMemberUserId}>
                <SelectTrigger><SelectValue placeholder="Select a member..." /></SelectTrigger>
                <SelectContent>
                  {orgMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>{m.user.name} ({m.user.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branch Role</Label>
              <Select value={addMemberRole} onValueChange={setAddMemberRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMember(null)}>Cancel</Button>
            <Button onClick={handleAddMember} disabled={addMemberSaving || !addMemberUserId}>
              {addMemberSaving && <Loader2 className="size-4 animate-spin" />}
              {addMemberSaving ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={!!removeMemberTarget} onOpenChange={(open) => { if (!open) setRemoveMemberTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{removeMemberTarget?.memberName}</strong> from <strong>{removeMemberTarget?.shopName}</strong>?
              This action cannot be undone. They will lose access to this branch and its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingMember}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} disabled={removingMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {removingMember && <Loader2 className="size-4 animate-spin" />}
              {removingMember ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

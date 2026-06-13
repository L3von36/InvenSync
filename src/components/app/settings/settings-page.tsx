'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Building2, CreditCard, Plug, Save, Check, X,
  Send, MessageSquare, UserPlus, Shield, Crown, Loader2,
  Store, Package, ShoppingCart, HandCoins, Users, Truck,
  BarChart3, AlertTriangle, TrendingUp, Brain, ScanSearch,
  Pencil, MapPin, Phone, ChevronDown, ChevronUp, Trash2,
  Search, LayoutGrid, Sparkles, Zap, Wrench
} from 'lucide-react'
import { api, type Organization } from '@/lib/api-client'
import { LocationPicker } from '@/components/app/shared/location-picker'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
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
import { toast } from 'sonner'
import { getNetworkErrorMessage } from '@/lib/validation'
import { formatETB } from '@/lib/format'
import { orgSettingsSchema, type OrgSettingsFormData, inviteMemberSchema, type InviteMemberFormData, shopSchema, type ShopFormData } from '@/lib/validations'
import { ErrorState } from '@/components/shared/error-states'
import { Form } from '@/components/ui/form'
import { FormInputField, FormSelectField, FormSubmitButton } from '@/components/shared/form-fields'
import { IntegrationsTab } from '@/components/app/settings/integrations-tab'
import { SecurityTab } from '@/components/app/settings/security-tab'

// ============================================
// Helpers
// ============================================

// ============================================
// Main Component
// ============================================
export function SettingsPage() {
  const { currentOrg } = useAuthStore()
  const orgId = currentOrg?.id || ''

  const [activeTab, setActiveTab] = useState('organization')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your organization, subscription, and integrations</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="organization" className="gap-1.5 text-xs sm:text-sm">
            <Building2 className="size-4" />
            <span className="hidden sm:inline">Organization</span>
          </TabsTrigger>
          <TabsTrigger value="shops" className="gap-1.5 text-xs sm:text-sm">
            <Store className="size-4" />
            <span className="hidden sm:inline">Shops</span>
          </TabsTrigger>
          <TabsTrigger value="modules" className="gap-1.5 text-xs sm:text-sm">
            <LayoutGrid className="size-4" />
            <span className="hidden sm:inline">Modules</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-1.5 text-xs sm:text-sm">
            <CreditCard className="size-4" />
            <span className="hidden sm:inline">Subscription</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5 text-xs sm:text-sm">
            <Plug className="size-4" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 text-xs sm:text-sm">
            <Shield className="size-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organization">
          <OrganizationTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="shops">
          <ShopsTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="modules">
          <ModulesTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="subscription">
          <SubscriptionTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsTab orgId={orgId} />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================
// Organization Tab
// ============================================
function OrganizationTab({ orgId }: { orgId: string }) {
  const [orgData, setOrgData] = useState<{
    organization: Organization & {
      members: Array<{
        id: string
        userId: string
        role: string
        user: { id: string; name: string; email: string; avatarUrl?: string | null }
      }>
    }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Org settings form
  const orgForm = useForm<OrgSettingsFormData>({
    resolver: zodResolver(orgSettingsSchema),
    defaultValues: { orgName: '', orgLogoUrl: '', orgCurrency: 'ETB', orgCountry: 'Ethiopia' },
  })

  // Invite form
  const inviteForm = useForm<InviteMemberFormData>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '', role: 'member' },
  })

  // Invite dialog
  const [showInvite, setShowInvite] = useState(false)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)

  const fetchOrg = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      setFetchError(null)
      const data = await api.getOrganization(orgId)
      setOrgData(data)
      orgForm.reset({
        orgName: data.organization.name,
        orgLogoUrl: data.organization.slug || '',
        orgCurrency: data.organization.currency || 'ETB',
        orgCountry: data.organization.country || 'Ethiopia',
      })
    } catch (err) {
      setFetchError(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchOrg()
  }, [fetchOrg])

  const handleSave = async (data: OrgSettingsFormData) => {
    if (!orgId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sb_token')}`,
        },
        body: JSON.stringify({
          name: data.orgName,
          currency: data.orgCurrency,
          country: data.orgCountry,
          logoUrl: data.orgLogoUrl || undefined,
        }),
      })
      if (!res.ok) {
        throw new Error(`Failed to update organization (${res.status})`)
      }
      toast.success('Organization updated successfully')
      fetchOrg()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleInvite = async (data: InviteMemberFormData) => {
    setInviteSubmitting(true)
    try {
      // Simulated invite - no actual API endpoint
      await new Promise((r) => setTimeout(r, 1000))
      toast.success(`Invitation sent to ${data.email}`)
      setShowInvite(false)
      inviteForm.reset()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setInviteSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (fetchError) {
    return <ErrorState title="Failed to load organization settings" error={fetchError} onRetry={fetchOrg} />
  }

  const members = orgData?.organization.members || []

  return (
    <div className="space-y-6">
      {/* Org Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>Update your organization information</CardDescription>
        </CardHeader>
        <Form {...orgForm}>
          <form onSubmit={orgForm.handleSubmit(handleSave)}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInputField<OrgSettingsFormData>
                  name="orgName"
                  label="Organization Name"
                  required
                />
                <FormInputField<OrgSettingsFormData>
                  name="orgLogoUrl"
                  label="Logo URL"
                  placeholder="https://..."
                />
                <FormSelectField<OrgSettingsFormData>
                  name="orgCurrency"
                  label="Currency"
                  options={[
                    { value: 'ETB', label: 'ETB - Ethiopian Birr' },
                    { value: 'USD', label: 'USD - US Dollar' },
                    { value: 'EUR', label: 'EUR - Euro' },
                    { value: 'GBP', label: 'GBP - British Pound' },
                    { value: 'KES', label: 'KES - Kenyan Shilling' },
                  ]}
                />
                <FormSelectField<OrgSettingsFormData>
                  name="orgCountry"
                  label="Country"
                  options={[
                    { value: 'Ethiopia', label: 'Ethiopia' },
                    { value: 'Kenya', label: 'Kenya' },
                    { value: 'Nigeria', label: 'Nigeria' },
                    { value: 'Ghana', label: 'Ghana' },
                    { value: 'South Africa', label: 'South Africa' },
                    { value: 'United States', label: 'United States' },
                    { value: 'United Kingdom', label: 'United Kingdom' },
                  ]}
                />
              </div>
            </CardContent>
            <CardFooter>
              <FormSubmitButton isLoading={saving} loadingText="Saving..." className="gap-2">
                <><Save className="size-4" /> Save Changes</>
              </FormSubmitButton>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage who has access to your organization</CardDescription>
            </div>
            <Button onClick={() => setShowInvite(true)} className="gap-2">
              <UserPlus className="size-4" />
              Invite
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {member.user.name.charAt(0).toUpperCase()}
                        </div>
                        {member.user.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.user.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          member.role === 'owner'
                            ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700'
                            : member.role === 'manager'
                              ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
                              : 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700'
                        }
                      >
                        {member.role === 'owner' && <Crown className="size-3 mr-1" />}
                        {member.role === 'manager' && <Shield className="size-3 mr-1" />}
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {members.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      No members found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {/* Mobile card view */}
          <div className="md:hidden divide-y p-3 space-y-3">
            {members.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No members found</p>
            ) : (
              members.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {member.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{member.user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      member.role === 'owner'
                        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700 shrink-0 ml-2'
                        : member.role === 'manager'
                          ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700 shrink-0 ml-2'
                          : 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700 shrink-0 ml-2'
                    }
                  >
                    {member.role === 'owner' && <Crown className="size-3 mr-1" />}
                    {member.role === 'manager' && <Shield className="size-3 mr-1" />}
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={(open) => {
        if (!open) inviteForm.reset()
        setShowInvite(open)
      }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>Send an invitation to join your organization</DialogDescription>
          </DialogHeader>
          <Form {...inviteForm}>
            <form onSubmit={inviteForm.handleSubmit(handleInvite)} className="space-y-4">
              <FormInputField<InviteMemberFormData>
                name="email"
                label="Email Address"
                type="email"
                placeholder="colleague@example.com"
                required
              />
              <FormSelectField<InviteMemberFormData>
                name="role"
                label="Role"
                options={[
                  { value: 'member', label: 'Member' },
                  { value: 'manager', label: 'Manager' },
                ]}
              />
            </form>
          </Form>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowInvite(false); inviteForm.reset() }}>
              Cancel
            </Button>
            <FormSubmitButton
              isLoading={inviteSubmitting}
              loadingText="Sending..."
              onClick={inviteForm.handleSubmit(handleInvite)}
            >
              Send Invitation
            </FormSubmitButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Subscription Tab
// ============================================
function SubscriptionTab({ orgId }: { orgId: string }) {
  const [subscription, setSubscription] = useState<{
    subscription: {
      id: string
      name: string
      subscriptionPlan: string
      subscriptionStatus: string
      subscriptionExpiresAt?: string | null
    }
    planLimits: {
      maxProducts: number
      maxUsers: number
      features: string[]
    }
    plans: Array<{
      name: string
      maxProducts: number
      maxUsers: number
      features: string[]
    }>
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [changingPlan, setChangingPlan] = useState<string | null>(null)

  const fetchSubscription = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const data = await api.getSubscription(orgId)
      setSubscription(data as unknown as typeof subscription)
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  const handleChangePlan = async (plan: string) => {
    if (!orgId) return
    setChangingPlan(plan)
    try {
      await api.updateSubscription(orgId, plan)
      toast.success(`Plan updated to ${plan.charAt(0).toUpperCase() + plan.slice(1)}`)
      fetchSubscription()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setChangingPlan(null)
    }
  }

  // Plan display data with updated Ethiopian pricing
  const planDisplay = [
    {
      key: 'starter',
      name: 'Starter',
      price: 'Free',
      priceDetail: '',
      features: [
        'Basic inventory management',
        'Basic sales tracking',
        '1 user included',
        'Debt management',
        '50 products max',
      ],
      color: 'bg-gray-50 dark:bg-gray-900/30',
      border: 'border-gray-200 dark:border-gray-700',
      popular: false,
    },
    {
      key: 'growth',
      name: 'Growth',
      price: 'ETB 150',
      priceDetail: '/month',
      features: [
        'Everything in Starter',
        '500 products',
        '2 users included',
        'Debts & credit tracking',
        'Customer management',
      ],
      color: 'bg-sky-50 dark:bg-sky-950/30',
      border: 'border-sky-300 dark:border-sky-700',
      popular: false,
    },
    {
      key: 'professional',
      name: 'Professional',
      price: 'ETB 300',
      priceDetail: '/month',
      features: [
        'Everything in Growth',
        '2,000 products',
        '10 users included',
        'AI Business Assistant',
        'Advanced reports & analytics',
        'Telegram bot integration',
        'Supplier management',
      ],
      color: 'bg-brand-50 dark:bg-brand-900/20',
      border: 'border-brand-100 dark:border-brand-900/30',
      popular: true,
    },
    {
      key: 'premium',
      name: 'Premium',
      price: 'ETB 500',
      priceDetail: '/month',
      features: [
        'Everything in Professional',
        'Unlimited products & users',
        'AI Inventory Assistant',
        'AI-powered insights',
        'WhatsApp Business integration',
        'API access',
        'Custom integrations',
        'Priority support',
      ],
      color: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-300 dark:border-amber-700',
      popular: false,
    },
  ]

  const currentPlan = subscription?.subscription.subscriptionPlan || 'starter'

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-6 w-32" />
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                <CreditCard className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-sm font-semibold capitalize">
                  {currentPlan === 'premium' ? 'Premium' : currentPlan}
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge
                variant="outline"
                className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700"
              >
                {subscription?.subscription.subscriptionStatus === 'active' ? 'Active' : subscription?.subscription.subscriptionStatus}
              </Badge>
              {subscription?.subscription.subscriptionExpiresAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Expires {new Date(subscription.subscription.subscriptionExpiresAt).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric'
                  })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {planDisplay.map((plan) => {
          const isCurrent = currentPlan === plan.key
          const isPopular = plan.popular
          return (
            <Card
              key={plan.key}
              className={`relative transition-all ${
                isCurrent
                  ? 'border-2 border-primary shadow-md'
                  : isPopular
                    ? 'border-2 border-primary shadow-sm'
                    : 'border hover:border-brand-100 dark:hover:border-brand-900/30'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Current Plan</Badge>
                </div>
              )}
              {isPopular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}
              <CardHeader className={`${plan.color} rounded-t-lg`}>
                <CardTitle className="text-sm font-semibold">{plan.name}</CardTitle>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-semibold">{plan.price}</span>
                  {plan.priceDetail && (
                    <span className="text-sm text-muted-foreground">{plan.priceDetail}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <ul className="space-y-2.5">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="size-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="p-4 md:p-6 pt-0">
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={isPopular ? 'default' : 'outline'}
                    onClick={() => handleChangePlan(plan.key)}
                    disabled={changingPlan !== null}
                  >
                    {changingPlan === plan.key ? (
                      <>
                        <Loader2 className="size-4 animate-spin mr-2" />
                        Updating...
                      </>
                    ) : (
                      currentPlan === 'premium' && plan.key !== 'premium'
                        ? 'Downgrade'
                        : 'Upgrade'
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {/* Plan Limits Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Plan Limits</CardTitle>
          <CardDescription>Current usage and limits for your plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <span className="text-sm">Max Products</span>
              <Badge variant="secondary">
                {subscription?.planLimits.maxProducts === -1
                  ? 'Unlimited'
                  : subscription?.planLimits.maxProducts || 100}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <span className="text-sm">Max Users</span>
              <Badge variant="secondary">
                {subscription?.planLimits.maxUsers === -1
                  ? 'Unlimited'
                  : subscription?.planLimits.maxUsers || 2}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// Integrations Tab — imported from separate component
// ============================================
// The IntegrationsTab is now in integrations-tab.tsx for maintainability

// ============================================
// Icon Map for Modules
// ============================================
const MODULE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Package,
  ShoppingCart,
  HandCoins,
  Users,
  Truck,
  Store,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Brain,
  ScanSearch,
  Send,
  MessageSquare,
}

// ============================================
// Shops Tab
// ============================================
function ShopsTab({ orgId }: { orgId: string }) {
  const [shops, setShops] = useState<Array<{
    id: string
    name: string
    address: string | null
    city: string | null
    phone: string | null
    isActive: boolean
    members: Array<{ id: string; userId: string; role: string; user: { id: string; name: string; email: string; avatarUrl?: string | null } }>
    _count: { products: number; sales: number }
  }>>([])
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
      setShops(data.shops)
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
    } catch { /* silently fail */ }
  }, [orgId])

  useEffect(() => { fetchShops(); fetchOrgMembers() }, [fetchShops, fetchOrgMembers])

  const openCreateDialog = () => {
    setEditingShopId(null)
    shopForm.reset({ name: '', address: '', city: '', phone: '', latitude: null, longitude: null })
    setShowDialog(true)
  }

  const openEditDialog = (shop: typeof shops[0]) => {
    setEditingShopId(shop.id)
    shopForm.reset({
      name: shop.name,
      address: shop.address || '',
      city: shop.city || '',
      phone: shop.phone || '',
      latitude: null,
      longitude: null,
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
        toast.success('Shop updated successfully')
      } else {
        await api.createShop(orgId, {
          name: data.name, address: data.address || undefined, city: data.city || undefined,
          phone: data.phone || undefined, latitude: data.latitude || undefined, longitude: data.longitude || undefined,
        })
        toast.success('Shop created successfully')
      }
      setShowDialog(false); fetchShops()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally { setSaving(false) }
  }

  const handleToggleActive = async (shop: typeof shops[0]) => {
    try {
      await api.updateShop(shop.id, orgId, { isActive: !shop.isActive })
      toast.success(shop.isActive ? 'Shop deactivated' : 'Shop activated')
      fetchShops()
    } catch (err) { toast.error(getNetworkErrorMessage(err)) }
  }

  const handleAddMember = async () => {
    if (!addMemberUserId) { toast.error('Please select a member'); return }
    setAddMemberSaving(true)
    try {
      await api.addShopMember(showAddMember!, orgId, { userId: addMemberUserId, role: addMemberRole })
      toast.success('Member added to shop')
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
      toast.success('Member removed from shop')
      setRemoveMemberTarget(null)
      fetchShops()
    } catch (err) { toast.error(getNetworkErrorMessage(err)) }
    finally { setRemovingMember(false) }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}><CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" />
            <div className="flex gap-4"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-20" /></div>
          </CardContent></Card>
        ))}
      </div>
    )
  }

  if (fetchError) {
    return <ErrorState title="Failed to load shops" error={fetchError} onRetry={fetchShops} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Shop Locations</h3>
          <p className="text-sm text-muted-foreground">{shops.length} shop{shops.length !== 1 ? 's' : ''} in your organization</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2 w-full sm:w-auto"><Store className="size-4" />Add Shop</Button>
      </div>

      {shops.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Store className="size-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No shops yet. Add your first shop location.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {shops.map((shop) => (
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
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openEditDialog(shop)}><Pencil className="size-4" /></Button>
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
                      <h5 className="text-sm font-medium">Shop Team</h5>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setShowAddMember(shop.id); setAddMemberUserId(''); setAddMemberRole('cashier') }}>
                        <UserPlus className="size-3.5" />Add Member
                      </Button>
                    </div>
                    {shop.members.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No members assigned to this shop yet</p>
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
                              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => setRemoveMemberTarget({ shopId: shop.id, memberId: member.id, memberName: member.user.name, shopName: shop.name })}>
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

      {/* Add/Edit Shop Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        if (!open) shopForm.reset()
        setShowDialog(open)
      }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingShopId ? 'Edit Shop' : 'Add New Shop'}</DialogTitle>
            <DialogDescription>{editingShopId ? 'Update shop details' : 'Add a new shop location to your organization'}</DialogDescription>
          </DialogHeader>
          <Form {...shopForm}>
            <form onSubmit={shopForm.handleSubmit(handleSaveShop)} className="space-y-4">
              <FormInputField<ShopFormData>
                name="name"
                label="Name"
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
                  latitude={shopForm.watch('latitude')}
                  longitude={shopForm.watch('longitude')}
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
                  {editingShopId ? 'Save Changes' : 'Create Shop'}
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
            <DialogTitle>Add Shop Member</DialogTitle>
            <DialogDescription>Select an organization member and assign a shop role</DialogDescription>
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
              <Label>Shop Role</Label>
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
              This action cannot be undone. They will lose access to this shop and its data.
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

// ============================================
// Modules Tab (Module Marketplace)
// ============================================
function ModulesTab({ orgId }: { orgId: string }) {
  const [modules, setModules] = useState<Array<{
    id: string; key: string; name: string; description: string; icon: string;
    category: string; priceETB: number; isActive: boolean; order: number;
  }>>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<typeof modules[0] | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const fetchModules = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      setFetchError(null)
      const data = await api.getModules(orgId)
      setModules(data.modules)
    } catch (err) {
      setFetchError(getNetworkErrorMessage(err))
    } finally { setLoading(false) }
  }, [orgId])

  useEffect(() => { fetchModules() }, [fetchModules])

  const handleToggleModule = async (mod: typeof modules[0]) => {
    const activating = !mod.isActive
    // Require confirmation before deactivating
    if (!activating) {
      setDeactivateTarget(mod)
      return
    }
    setTogglingKey(mod.key)
    try {
      await api.activateModule(orgId, mod.key)
      toast.success(`${mod.name} activated`)
      fetchModules()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    }
    finally { setTogglingKey(null) }
  }

  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return
    setDeactivating(true)
    setTogglingKey(deactivateTarget.key)
    try {
      await api.deactivateModule(orgId, deactivateTarget.key)
      toast.success(`${deactivateTarget.name} deactivated`)
      setDeactivateTarget(null)
      fetchModules()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    }
    finally { setTogglingKey(null); setDeactivating(false) }
  }

  const filteredModules = modules.filter((m) => {
    const matchesSearch = search === '' || m.name.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const activeModules = modules.filter(m => m.isActive)
  const totalMonthlyCost = activeModules.reduce((sum, m) => sum + m.priceETB, 0)

  const categories = [
    { key: 'all', label: 'All' },
    { key: 'core', label: 'Core' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'ai', label: 'AI' },
    { key: 'integration', label: 'Integrations' },
  ]

  const categoryIconClass = (category: string) => {
    switch (category) {
      case 'core': return 'bg-brand-50 dark:bg-brand-900/20 text-primary'
      case 'analytics': return 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'
      case 'ai': return 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
      case 'integration': return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
      default: return 'bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3">
              <Skeleton className="h-10 w-10 rounded-lg" /><Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-20" />
            </CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  if (fetchError) {
    return <ErrorState title="Failed to load modules" error={fetchError} onRetry={fetchModules} />
  }

  return (
    <div className="space-y-6">
      {/* Active Module Summary */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                <LayoutGrid className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Modules</p>
                <p className="text-sm font-semibold">{activeModules.length} of {modules.length}</p>
              </div>
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-10" />
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <Zap className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Module Cost</p>
                <p className="text-sm font-semibold">{totalMonthlyCost === 0 ? 'Free' : formatETB(totalMonthlyCost) + '/mo'}</p>
              </div>
            </div>
          </div>
          {activeModules.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t">
              {activeModules.map((m) => (
                <Badge key={m.key} variant="secondary" className="gap-1 text-xs">
                  {React.createElement(MODULE_ICON_MAP[m.icon] || Package, { className: 'size-3' })}
                  {m.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search modules..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((cat) => (
            <Button key={cat.key} variant={categoryFilter === cat.key ? 'default' : 'outline'} size="sm" onClick={() => setCategoryFilter(cat.key)} className="text-xs">
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Module Cards Grid */}
      {filteredModules.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <LayoutGrid className="size-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No modules found matching your search</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModules.map((mod) => {
            const IconComponent = MODULE_ICON_MAP[mod.icon] || Package
            const isToggling = togglingKey === mod.key
            return (
              <Card key={mod.id} className={`transition-all ${mod.isActive ? 'border-primary/30 shadow-sm' : 'hover:border-brand-100 dark:hover:border-brand-900/30'}`}>
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${categoryIconClass(mod.category)}`}>
                      <IconComponent className="size-5" />
                    </div>
                    <Switch checked={mod.isActive} onCheckedChange={() => handleToggleModule(mod)} disabled={isToggling} />
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{mod.name}</h4>
                      {mod.priceETB === 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Included</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{mod.description}</p>
                    {mod.priceETB > 0 && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-sm font-semibold">{formatETB(mod.priceETB)}</span>
                        <span className="text-xs text-muted-foreground">/month</span>
                      </div>
                    )}
                    {mod.priceETB > 0 && !mod.isActive && (
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Sparkles className="size-3" />Upgrade to activate
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Deactivate Module Confirmation Dialog */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => { if (!open) setDeactivateTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Module</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate <strong>{deactivateTarget?.name}</strong>?
              This action cannot be undone. Your organization will immediately lose access to this module
              and all its features. Any data associated with this module may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeactivate} disabled={deactivating} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deactivating && <Loader2 className="size-4 animate-spin" />}
              {deactivating ? 'Deactivating...' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

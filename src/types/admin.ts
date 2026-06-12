// ============================================
// Shared Admin Types
// ============================================
// Previously duplicated across admin-organizations-page and admin-modules-page

export interface AdminOrg {
  id: string
  name: string
  slug: string
  businessType: string
  city: string | null
  subscriptionPlan: string
  subscriptionStatus: string
  createdAt: string
  memberCount: number
  shopCount: number
  productCount: number
  salesCount: number
  region?: { id: string; name: string; slug: string } | null
  members: Array<{ id: string; role: string; name: string; email: string }>
  shops: Array<{ id: string; name: string; city: string | null; isActive: boolean }>
  modules: Array<OrgModuleInfo>
}

export interface OrgModuleInfo {
  id: string
  key: string
  name: string
  status: string
  isActive: boolean
  expiresAt: string | null
  priceAtActivation: number
  autoRenew: boolean
}

export interface AdminModule {
  id: string
  key: string
  name: string
  description: string
  icon: string
  category: string
  priceETB: number
  isFree: boolean
  freeTrialDays: number
  billingCycle: string
  isActive: boolean
  order: number
  orgCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
  createdAt: string
  organizations: Array<{
    id: string
    name: string
    role: string
    businessType: string
  }>
}

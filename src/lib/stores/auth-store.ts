'use client'

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { api, type User, type Organization, type Shop } from '@/lib/api-client'
import { authFetch } from '@/lib/auth-fetch'

/**
 * Thrown when login succeeds but 2FA is required.
 * The auth-flow should catch this and show the TwoFactorPage.
 */
export class TwoFactorRequiredError extends Error {
  tempToken: string
  userEmail: string
  userName: string

  constructor(tempToken: string, userEmail: string, userName: string) {
    super('Two-factor authentication required')
    this.name = 'TwoFactorRequiredError'
    this.tempToken = tempToken
    this.userEmail = userEmail
    this.userName = userName
  }
}

interface AuthState {
  user: User | null
  token: string | null
  organizations: Organization[]
  currentOrg: Organization | null
  isLoading: boolean
  isAuthenticated: boolean
  dbUnreachable: boolean  // True when the Supabase database can't be reached

  // Derived
  currentOrgRole: 'owner' | 'manager' | 'employee' | null
  shopRole: 'manager' | 'cashier' | 'warehouse' | 'sales' | null
  currentShopId: string | null

  // Multi-shop & Module state
  shops: Shop[]
  currentShop: Shop | null
  activeModules: string[]
  modulesLoaded: boolean  // True once fetchModules has completed (success or error)

  // Actions
  login: (email: string, password: string) => Promise<void>
  verify2faLogin: (tempToken: string, code: string) => Promise<void>
  register: (name: string, email: string, password: string, orgName: string, extra?: {
    businessType?: string
    description?: string
    address?: string
    city?: string
    latitude?: number
    longitude?: number
    phone?: string
    referralCode?: string
  }) => Promise<void>
  logout: () => void
  setCurrentOrg: (org: Organization) => void
  setCurrentShop: (shop: Shop) => void
  fetchShops: () => Promise<void>
  fetchModules: () => Promise<void>
  checkAuth: () => Promise<void>
  fetchShopRole: () => Promise<void>
  isAdmin: () => boolean
  isOwner: () => boolean
  isManager: () => boolean
  isEmployee: () => boolean
}

// ============================================
// Abort controller for cancelling background requests on logout
// ============================================
let backgroundAbortController = new AbortController()

function cancelBackgroundRequests() {
  backgroundAbortController.abort()
  backgroundAbortController = new AbortController()
}

// ============================================
// Session ID to detect stale 401 responses
// ============================================
let currentSessionId = 0

function newSession(): number {
  currentSessionId++
  return currentSessionId
}

export const useAuthStore = create<AuthState>()(subscribeWithSelector((set, get) => ({
  user: null,
  token: null,
  organizations: [],
  currentOrg: null,
  isLoading: true,
  isAuthenticated: false,
  dbUnreachable: false,
  currentOrgRole: null,
  shopRole: null,
  currentShopId: null,
  shops: [],
  currentShop: null,
  activeModules: [],
  modulesLoaded: false,

  login: async (email: string, password: string) => {
    // Generate a new session ID to invalidate any stale 401 responses
    const sessionId = newSession()

    // Note: api.login() already clears stale tokens before making the request

    // Normalize email to lowercase before sending to server
    const data = await api.login(email.toLowerCase().trim(), password)

    // Double-check that we're still in the same login session
    // (user didn't click login, then logout, then this response came back)
    if (sessionId !== currentSessionId) return

    // Check if 2FA is required
    if ('requires2FA' in data && (data as { requires2FA: boolean }).requires2FA) {
      const data2fa = data as unknown as { tempToken: string; user: User }
      // Throw a special error so auth-flow can show the TwoFactorPage
      throw new TwoFactorRequiredError(
        data2fa.tempToken,
        data2fa.user.email,
        data2fa.user.name,
      )
    }

    const orgs = (data as { organizations: Organization[] }).organizations
    const currentOrg = orgs.length > 0 ? orgs[0] : null
    set({
      user: (data as { user: User }).user,
      token: (data as { token: string }).token,
      organizations: orgs,
      currentOrg,
      currentOrgRole: (currentOrg?.role as 'owner' | 'manager' | 'employee') || null,
      shopRole: null,
      currentShopId: null,
      shops: [],
      currentShop: null,
      activeModules: [],
      modulesLoaded: false,
      isAuthenticated: true,
      isLoading: false,
    })
    // Fetch shops and modules for the current org (with current abort signal)
    if (currentOrg) {
      get().fetchShops()
      get().fetchModules()
      get().fetchShopRole()
    }
  },

  verify2faLogin: async (tempToken: string, code: string) => {
    const sessionId = newSession()
    const data = await api.verify2faLogin(tempToken, code)
    if (sessionId !== currentSessionId) return

    const orgs = data.organizations
    const currentOrg = orgs.length > 0 ? orgs[0] : null
    set({
      user: data.user,
      token: data.token,
      organizations: orgs,
      currentOrg,
      currentOrgRole: (currentOrg?.role as 'owner' | 'manager' | 'employee') || null,
      shopRole: null,
      currentShopId: null,
      shops: [],
      currentShop: null,
      activeModules: [],
      modulesLoaded: false,
      isAuthenticated: true,
      isLoading: false,
    })
    if (currentOrg) {
      get().fetchShops()
      get().fetchModules()
      get().fetchShopRole()
    }
  },

  register: async (name: string, email: string, password: string, orgName: string, extra?: {
    businessType?: string
    description?: string
    address?: string
    city?: string
    latitude?: number
    longitude?: number
    phone?: string
    referralCode?: string
  }) => {
    // Generate a new session ID
    const sessionId = newSession()

    // Normalize email to lowercase before sending to server
    const data = await api.register(name, email.toLowerCase().trim(), password, orgName, extra)

    // If no token was returned, Supabase requires email verification
    if (!data.token) {
      throw new Error('Please check your email to verify your account before logging in.')
    }

    // Double-check that we're still in the same session
    if (sessionId !== currentSessionId) return

    // JWT mode: set state from registration response
    const org: Organization = {
      id: data.organization.id,
      name: data.organization.name,
      slug: data.organization.slug,
      role: 'owner',
      businessType: data.organization.businessType,
      description: data.organization.description,
      address: data.organization.address,
      city: data.organization.city,
      latitude: data.organization.latitude,
      longitude: data.organization.longitude,
      phone: data.organization.phone,
    }
    set({
      user: data.user,
      token: data.token,
      organizations: [org],
      currentOrg: org,
      currentOrgRole: 'owner',
      shopRole: null,
      currentShopId: null,
      shops: [],
      currentShop: null,
      activeModules: [],
      modulesLoaded: false,
      isAuthenticated: true,
      isLoading: false,
    })
  },

  logout: () => {
    // Generate new session ID to invalidate any in-flight requests
    newSession()

    // Cancel any pending background requests (fetchShops, fetchModules, etc.)
    cancelBackgroundRequests()

    // 1. Clear API client token FIRST to prevent any stale auth headers
    api.clearToken()
    // 2. Clear all localStorage auth state
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sb_token')
      localStorage.removeItem('sb_current_shop')
      localStorage.removeItem('sb_current_org')
    }
    // 3. Reset Zustand state (sets isAuthenticated: false which triggers SessionExpiryHandler cleanup)
    set({
      user: null,
      token: null,
      organizations: [],
      currentOrg: null,
      currentOrgRole: null,
      shopRole: null,
      currentShopId: null,
      shops: [],
      currentShop: null,
      activeModules: [],
      modulesLoaded: false,
      isAuthenticated: false,
      isLoading: false,
    })
    // 4. Fire-and-forget server-side logout (after state is cleared so it doesn't interfere)
    authFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  },

  setCurrentOrg: (org: Organization) => {
    set({
      currentOrg: org,
      currentOrgRole: (org.role as 'owner' | 'manager' | 'employee') || null,
      shopRole: null,
      currentShopId: null,
      shops: [],
      currentShop: null,
      activeModules: [],
      modulesLoaded: false,
    })
    // Fetch shops and modules for the new org
    get().fetchShops()
    get().fetchModules()
    get().fetchShopRole()
  },

  setCurrentShop: (shop: Shop) => {
    set({ currentShop: shop })
    if (typeof window !== 'undefined') {
      localStorage.setItem('sb_current_shop', shop.id)
    }
  },

  fetchShops: async () => {
    const { currentOrg, isAuthenticated } = get()
    if (!currentOrg || !isAuthenticated) return
    try {
      const data = await api.getShops(currentOrg.id)
      // Guard: if user logged out while request was in-flight, discard result
      if (!get().isAuthenticated) return
      const shops = data.shops || []
      // Restore current shop from localStorage
      const savedShopId = typeof window !== 'undefined' ? localStorage.getItem('sb_current_shop') : null
      let currentShop = shops.length > 0 ? shops[0] : null
      if (savedShopId) {
        const saved = shops.find((s: Shop) => s.id === savedShopId)
        if (saved) currentShop = saved
      }
      set({ shops, currentShop })
    } catch {
      // Silently fail - shops will be empty
      if (get().isAuthenticated) {
        set({ shops: [], currentShop: null })
      }
    }
  },

  fetchModules: async () => {
    const { currentOrg, isAuthenticated } = get()
    if (!currentOrg || !isAuthenticated) return
    try {
      const data = await api.getModules(currentOrg.id)
      // Guard: if user logged out while request was in-flight, discard result
      if (!get().isAuthenticated) return
      // Only include modules that are active and not expired/cancelled/requested
      const activeKeys = data.modules
        .filter(m => m.isActive && m.orgStatus?.isActive && !['expired', 'cancelled', 'requested'].includes(m.orgStatus?.status || ''))
        .map(m => m.key)
      set({ activeModules: activeKeys, modulesLoaded: true })
    } catch {
      // Silently fail - modules will be empty, modulesLoaded=true prevents fallback
      if (get().isAuthenticated) {
        set({ activeModules: [], modulesLoaded: true })
      }
    }
  },

  isAdmin: () => {
    const { user } = get()
    return user?.role === 'admin'
  },
  isOwner: () => {
    const { currentOrgRole } = get()
    return currentOrgRole === 'owner'
  },
  isManager: () => {
    const { currentOrgRole } = get()
    return currentOrgRole === 'owner' || currentOrgRole === 'manager'
  },
  isEmployee: () => {
    const { currentOrgRole } = get()
    return currentOrgRole === 'employee'
  },

  fetchShopRole: async () => {
    const { currentOrg, isAuthenticated } = get()
    if (!currentOrg || !isAuthenticated) return

    try {
      const data = await api.getShopMemberInfo(currentOrg.id)
      // Guard: if user logged out while request was in-flight, discard result
      if (!get().isAuthenticated) return
      set({
        shopRole: (data.shopRole as 'manager' | 'cashier' | 'warehouse' | 'sales') || null,
        currentShopId: data.currentShopId,
      })
    } catch {
      // If the user has no shop membership, that's fine — shopRole stays null
      if (get().isAuthenticated) {
        set({ shopRole: null, currentShopId: null })
      }
    }
  },

  checkAuth: async () => {
    try {
      const data = await api.getMe()
      const orgs = data.organizations

      // Try to restore the previously selected org
      const savedOrgId = typeof window !== 'undefined' ? localStorage.getItem('sb_current_org') : null
      let currentOrg = orgs.length > 0 ? orgs[0] : null
      if (savedOrgId) {
        const savedOrg = orgs.find(o => o.id === savedOrgId)
        if (savedOrg) currentOrg = savedOrg
      }

      // Preserve the token from localStorage/API client.
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('sb_token') : null
      const token = storedToken || ''

      set({
        user: data.user,
        token,
        organizations: orgs,
        currentOrg,
        currentOrgRole: (currentOrg?.role as 'owner' | 'manager' | 'employee') || null,
        shopRole: null,
        currentShopId: null,
        shops: [],
        currentShop: null,
        activeModules: [],
        modulesLoaded: false,
        isAuthenticated: true,
        isLoading: false,
      })

      // Fetch shops, modules, and shop role in the background
      if (currentOrg) {
        get().fetchShops()
        get().fetchModules()
        get().fetchShopRole()
      }
    } catch (err) {
      // Check if the error is a database unreachable error
      const isDbUnreachable = err instanceof Error && (err as Error & { code?: string }).code === 'DB_UNREACHABLE'
      
      // If the database is unreachable and the user was previously authenticated,
      // DON'T clear their auth state. This prevents the user from being logged out
      // when the database is temporarily unavailable. They'll see the app in a
      // degraded state but won't lose their session.
      if (isDbUnreachable && get().isAuthenticated) {
        console.warn('[Auth] Database unreachable during checkAuth — preserving session')
        set({ isLoading: false, dbUnreachable: true })
        return
      }

      // Session is invalid or expired — clear ALL auth state
      api.clearToken()
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sb_token')
        localStorage.removeItem('sb_current_shop')
        localStorage.removeItem('sb_current_org')
      }
      set({
        user: null,
        token: null,
        organizations: [],
        currentOrg: null,
        currentOrgRole: null,
        shopRole: null,
        currentShopId: null,
        shops: [],
        currentShop: null,
        activeModules: [],
        modulesLoaded: false,
        isAuthenticated: false,
        isLoading: false,
        dbUnreachable: isDbUnreachable,
      })
    }
  },
})))

// Subscribe to currentOrg changes to persist to localStorage
if (typeof window !== 'undefined') {
  useAuthStore.subscribe(
    (state) => state.currentOrg,
    (currentOrg) => {
      if (currentOrg) {
        localStorage.setItem('sb_current_org', currentOrg.id)
      }
    }
  )
}

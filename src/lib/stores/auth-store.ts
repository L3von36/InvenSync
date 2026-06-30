'use client'

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { api, type User, type Organization, type Shop } from '@/lib/api-client'
import { authFetch } from '@/lib/auth-fetch'
import { db } from '@/lib/db'

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
  isTokenValid: () => boolean
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
    // Cache user profile to IndexedDB for offline access
    db.userProfile.put({
      id: (data as { user: User }).user.id,
      email: (data as { user: User }).user.email,
      name: (data as { user: User }).user.name,
      avatarUrl: (data as { user: User }).user.avatarUrl || null,
      role: (data as { user: User }).user.role || null,
      organizations: JSON.stringify(orgs),
      currentOrgId: currentOrg?.id || null,
      currentShopId: null,
      cachedAt: new Date().toISOString(),
    }).catch(err => console.warn('[Auth] Failed to cache profile:', err))
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
    // Cache user profile to IndexedDB for offline access
    db.userProfile.put({
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      avatarUrl: data.user.avatarUrl || null,
      role: data.user.role || null,
      organizations: JSON.stringify(orgs),
      currentOrgId: currentOrg?.id || null,
      currentShopId: null,
      cachedAt: new Date().toISOString(),
    }).catch(err => console.warn('[Auth] Failed to cache profile:', err))
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
    // Cache user profile to IndexedDB for offline access
    db.userProfile.put({
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      avatarUrl: data.user.avatarUrl || null,
      role: data.user.role || null,
      organizations: JSON.stringify([org]),
      currentOrgId: org.id,
      currentShopId: null,
      cachedAt: new Date().toISOString(),
    }).catch(err => console.warn('[Auth] Failed to cache profile:', err))
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
    // 5. Stop auto-sync engine before clearing local data
    import('@/lib/sync/engine').then(({ getSyncEngine }) => {
      getSyncEngine().stopAutoSync()
    }).catch(() => {})
    // 6. Clear offline data from IndexedDB
    import('@/lib/db/index').then(({ clearLocalDatabase }) => {
      clearLocalDatabase().catch(err => console.error('[Auth] Failed to clear local DB:', err))
    }).catch(() => {})
    // 7. Clear bootstrap flags for all orgs
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('invensync_bootstrapped_'))
      keys.forEach(k => localStorage.removeItem(k))
    }
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

  isTokenValid: () => {
    const token = get().token || (typeof window !== 'undefined' ? localStorage.getItem('sb_token') : null)
    if (!token) return false
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.exp * 1000 > Date.now()
    } catch {
      return false
    }
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

      // Cache user profile to IndexedDB for offline access
      db.userProfile.put({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        avatarUrl: data.user.avatarUrl || null,
        role: data.user.role || null,
        organizations: JSON.stringify(orgs),
        currentOrgId: currentOrg?.id || null,
        currentShopId: null,
        cachedAt: new Date().toISOString(),
      }).catch(err => console.warn('[Auth] Failed to cache profile:', err))

      // Fetch shops, modules, and shop role in the background
      if (currentOrg) {
        get().fetchShops()
        get().fetchModules()
        get().fetchShopRole()
      }
    } catch (err) {
      // Check if the error is a database unreachable error
      const isDbUnreachable = err instanceof Error && (err as Error & { code?: string }).code === 'DB_UNREACHABLE'
      
      // Detect network errors (fetch failures) in addition to DB_UNREACHABLE
      const isNetworkError = err instanceof Error && (
        err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('offline') ||
        err.message.includes('Network error') ||
        err.message.includes('no cached data') ||
        err.message.includes('check your internet') ||
        err.message.includes('server took too long')
      )

      // If the database is unreachable or there's a network error, and the user
      // was previously authenticated, DON'T clear their auth state. This prevents
      // the user from being logged out when the database is temporarily unavailable
      // or when they're offline. They'll see the app in a degraded state but won't
      // lose their session.
      if ((isNetworkError || isDbUnreachable) && get().isAuthenticated) {
        console.warn('[Auth] Network error during checkAuth — preserving session for offline use')
        set({ isLoading: false, dbUnreachable: true })
        return
      }

      // Offline auth: try to restore session from IndexedDB cache
      // when the user has a valid token but network is unavailable
      if (isNetworkError || isDbUnreachable) {
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('sb_token') : null
          if (token && get().isTokenValid()) {
            // Try to load cached profile from IndexedDB
            const profiles = await db.userProfile.toArray()
            if (profiles.length > 0) {
              const profile = profiles[0]
              const orgs: Organization[] = JSON.parse(profile.organizations || '[]')
              const currentOrg = orgs.find(o => o.id === profile.currentOrgId) || orgs[0] || null
              console.log('[Auth] Restored session from IndexedDB cache for offline use')
              set({
                user: {
                  id: profile.id,
                  email: profile.email,
                  name: profile.name,
                  avatarUrl: profile.avatarUrl,
                  role: profile.role || undefined,
                },
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
                dbUnreachable: true,
              })
              if (currentOrg) {
                get().fetchShops()
                get().fetchModules()
              }
              return
            }
          }
        } catch (cacheErr) {
          console.warn('[Auth] Failed to restore session from IndexedDB:', cacheErr)
        }
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

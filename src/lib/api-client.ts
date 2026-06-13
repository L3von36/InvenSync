// ============================================
// API Client - Centralized API communication
// ============================================

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  role?: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  role: string
  currency?: string
  country?: string
  subscriptionPlan?: string
  subscriptionStatus?: string
  businessType?: 'retail' | 'service' | 'mixed' | null
  description?: string | null
  address?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  phone?: string | null
}

export interface ProductType {
  id: string
  organizationId: string
  name: string
  icon?: string | null
  createdAt: string
  updatedAt: string
  attributes?: AttributeDefinition[]
  _count?: { products: number }
}

export interface AttributeDefinition {
  id: string
  productTypeId: string
  name: string
  fieldType: string
  options?: string | null
  required: boolean
  order: number
}

export interface Product {
  id: string
  productTypeId: string
  organizationId: string
  sku?: string | null
  name: string
  description?: string | null
  imageUrl?: string | null
  quantity: number
  costPrice: number
  sellingPrice: number
  lowStockThreshold: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  productType?: { id: string; name: string; icon?: string | null }
  attributeValues?: ProductAttributeValue[]
}

export interface ProductAttributeValue {
  id: string
  productId: string
  attributeDefinitionId: string
  value: string
  attributeDefinition?: { id: string; name: string; fieldType: string }
}

export interface StockMovement {
  id: string
  organizationId: string
  productId: string
  type: string
  quantity: number
  previousStock: number
  newStock: number
  reason?: string | null
  reference?: string | null
  createdAt: string
  product?: { id: string; name: string; sku?: string | null }
}

export interface Customer {
  id: string
  organizationId: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  shopId?: string | null
  createdAt: string
  updatedAt: string
  _count?: { sales: number; debts: number }
}

export interface Supplier {
  id: string
  organizationId: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  shopId?: string | null
  createdAt: string
  updatedAt: string
}

export interface Sale {
  id: string
  organizationId: string
  customerId?: string | null
  invoiceNumber: string
  status: string
  paymentMethod: string
  subtotal: number
  discount: number
  tax: number
  total: number
  amountPaid: number
  notes?: string | null
  saleDate: string
  createdAt: string
  updatedAt: string
  customer?: { id: string; name: string; phone?: string | null } | null
  items?: SaleItem[]
}

export interface SaleItem {
  id: string
  saleId: string
  productId: string
  quantity: number
  unitPrice: number
  costPrice: number
  total: number
  product?: { id: string; name: string; sku?: string | null }
}

export interface Debt {
  id: string
  organizationId: string
  customerId?: string | null
  supplierId?: string | null
  type: string
  amount: number
  paidAmount: number
  dueDate?: string | null
  status: string
  description?: string | null
  shopId?: string | null
  createdAt: string
  updatedAt: string
  customer?: { id: string; name: string; phone?: string | null } | null
  supplier?: { id: string; name: string; phone?: string | null } | null
  payments?: DebtPayment[]
}

export interface DebtPayment {
  id: string
  debtId: string
  amount: number
  paymentMethod: string
  notes?: string | null
  paidAt: string
}

export interface DashboardData {
  stats: {
    totalProducts: number
    outOfStockCount: number
    lowStockCount: number
    totalStockCostValue: number
    totalStockRetailValue: number
    todayRevenue: number
    todaySalesCount: number
    monthRevenue: number
    totalCustomerDebt: number
  }
  recentSales: Sale[]
  topProducts: Array<{
    id: string
    name: string
    sku?: string | null
    imageUrl?: string | null
    totalRevenue: number
    totalQuantity: number
  }>
}

export interface InventoryStats {
  overview: {
    totalProducts: number
    outOfStock: number
    lowStock: number
    totalCostValue: number
    totalRetailValue: number
  }
  lowStockProducts: Array<{
    id: string
    name: string
    quantity: number
    costPrice: number
    sellingPrice: number
    lowStockThreshold: number
    productType: { id: string; name: string }
  }>
  recentMovements: StockMovement[]
}

export interface Subscription {
  id: string
  organizationId: string
  subscriptionPlan: string
  subscriptionStatus: string
  subscriptionExpiresAt?: string | null
}

export interface ServiceType {
  id: string
  organizationId: string
  name: string
  description?: string | null
  duration: number
  price: number
  imageUrl?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ServiceBooking {
  id: string
  organizationId: string
  serviceTypeId: string
  customerId?: string | null
  customerName: string
  customerPhone?: string | null
  status: string
  bookingDate: string
  startTime: string
  endTime: string
  notes?: string | null
  createdAt: string
  updatedAt: string
  serviceType?: { id: string; name: string; duration: number; price: number }
  customer?: { id: string; name: string; phone?: string | null } | null
}

export interface Shop {
  id: string
  organizationId: string
  name: string
  address?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  phone?: string | null
  isActive: boolean
  memberCount?: number
}

export interface ShopMemberData {
  id: string
  userId: string
  shopId: string
  role: string
  user: { id: string; name: string; email: string }
}

export interface ModuleData {
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
  isActive: boolean  // Whether the org has it active
  order: number
  orgStatus?: {
    isActive: boolean
    status: string  // trial, active, expired, cancelled
    activatedAt: string | null
    expiresAt: string | null
    priceAtActivation: number
    autoRenew: boolean
  } | null
}

export interface AdminDashboardData {
  totalOrganizations: number
  totalUsers: number
  totalShops: number
  totalRevenue: number
  totalProducts: number
  newShopsThisMonth: number
  activeSubscriptions: Record<string, number>
  organizationsByBusinessType: Record<string, number>
  revenueByMonth: Array<{ month: string; revenue: number }>
  topShopsByRevenue: Array<{ id: string; name: string; businessType: string; city: string | null; totalRevenue: number }>
  salesTeam?: {
    activeReps: number
    totalRegistrationsByReps: number
    registrationsThisMonth: number
  }
  regionInfo?: { id: string; name: string; slug: string } | null
  regionsBreakdown: Array<{ regionId: string; regionName: string; orgCount: number; revenue: number }>
}

export interface ShopData {
  id: string
  name: string
  businessType: string
  city: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  subscriptionPlan: string
  createdAt: string
  memberCount: number
  shopCount: number
  productTypeCount: number
  totalRevenue: number
}

export interface MarketInsightsData {
  lowStockProducts: Array<{ orgName: string; productName: string; quantity: number; category: string }>
  fastMovingProducts: Array<{ name: string; orgName: string; category: string; quantitySold: number; revenue: number }>
  demandByCategory: Array<{ category: string; quantitySold: number; revenue: number }>
  supplyOpportunities: Array<{ productType: string; lowStockCount: number; orgNames: string[] }>
  topCities: Array<{ city: string | null; shopCount: number }>
  businessTypeDistribution: Array<{ businessType: string; count: number }>
  averageRevenueByType: Array<{ businessType: string; averageRevenue: number; totalRevenue: number; organizationCount: number }>
}

export interface ShopMemberInfo {
  shopRole: string | null
  currentShopId: string | null
  shops: Array<{
    shopId: string
    shopName: string
    role: string
  }>
}

export interface RegionData {
  id: string
  name: string
  slug: string
  country: string
  latitude: number | null
  longitude: number | null
  population: number | null
  description: string | null
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
  // Stats (when includeStats=true)
  orgCount?: number
  userCount?: number
  shopCount?: number
  revenue?: number
  recentOrgs?: Array<{ id: string; name: string; businessType: string; city: string | null }>
}

export interface RegionDetailData extends RegionData {
  organizations: Array<{
    id: string
    name: string
    businessType: string
    city: string | null
    subscriptionPlan: string
    memberCount: number
    shopCount: number
    revenue: number
  }>
  salesReps: Array<{
    id: string
    name: string
    email: string
    commissionRate: number
    registrations: number
  }>
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ============================================
// Sales Team Types
// ============================================

export interface SalesRep {
  id: string
  userId: string
  phone: string | null
  targetCity: string | null
  commissionRate: number
  commissionPerReg: number
  isActive: boolean
  joinedAt: string
  createdAt: string
  updatedAt: string
  user: { id: string; name: string; email: string; role: string }
  totalRegistrations: number
  currentGoal: SalesRepGoal | null
  commissions: {
    total: number
    pending: number
    paid: number
  }
}

export interface SalesRepGoal {
  id: string
  period: string
  targetCount: number
  achievedCount: number
  progressPercentage: number
  bonusAmount: number
  isAchieved: boolean
}

export interface Commission {
  id: string
  salesRepId: string
  organizationId: string
  amount: number
  status: string
  paidAt: string | null
  createdAt: string
  updatedAt: string
  organization: {
    id: string
    name: string
    city: string | null
    businessType: string
  }
}

export interface TeamOverview {
  overview: {
    totalActiveReps: number
    totalInactiveReps: number
    totalReps: number
    currentMonthRegistrations: number
    totalCommissionsPaidThisMonth: number
  }
  teamGoal: {
    totalTarget: number
    totalAchieved: number
    progressPercentage: number
    totalBonusPool: number
    goalsAchieved: number
    totalGoals: number
  }
  topPerformingReps: Array<{
    id: string
    userId: string
    name: string
    email: string
    totalRegistrations: number
    currentMonthRegistrations: number
  }>
  goalsByRep: Array<{
    salesRepId: string
    repName: string
    repEmail: string
    targetCount: number
    achievedCount: number
    progressPercentage: number
    bonusAmount: number
    isAchieved: boolean
  }>
}

// ============================================
// System Health (Traffic Optimization Patterns)
// ============================================

export interface SystemHealthData {
  status: 'healthy' | 'degraded' | 'error'
  timestamp: string
  uptime: {
    seconds: number
    formatted: string
  }
  database: {
    status: 'connected' | 'error'
    latencyMs: number
  }
  cache: {
    namespaces: number
    totalEntries: number
    hitRate: string
    details: Record<string, number>
  }
  rateLimit: {
    activeBuckets: number
    details: Record<string, number>
  }
  resilience: {
    circuits: Record<string, { state: 'closed' | 'open' | 'half-open'; failureCount: number }>
    bulkheads: Record<string, { active: number; queued: number }>
  }
  memory: {
    heapUsedMB: number
    heapTotalMB: number
    rssMB: number
    externalMB: number
  }
  patterns: {
    applied: string[]
    cacheNamespaces: string[]
  }
  error?: string
}

class ApiClient {
  // Supabase Auth uses httpOnly cookies for session management.
  // The token is no longer stored in localStorage for security.
  // We keep a reference for backward compat but auth is primarily cookie-based.
  private _token: string | null = null
  // Guard flag: when true, 401 auto-logout is suppressed to prevent
  // stale background requests from interfering with an active login attempt.
  private _isLoggingIn: boolean = false

  // Request deduplication: prevent concurrent identical GET requests
  // If 3 components request the same endpoint simultaneously, only 1 fetch is made.
  private _inflightRequests = new Map<string, Promise<unknown>>()

  // Short-lived client-side response cache for GET requests (5s TTL)
  // Prevents rapid re-fetches when multiple components mount simultaneously
  private _responseCache = new Map<string, { data: unknown; expiresAt: number }>()
  private static RESPONSE_CACHE_TTL = 5_000 // 5 seconds

  /**
   * Invalidate client-side response cache entries matching a prefix.
   * Called after mutating operations to ensure stale data is not served.
   */
  invalidateCache(prefix: string): void {
    // Invalidate our internal response cache
    this._responseCache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        this._responseCache.delete(key)
      }
    })
    // Also invalidate the shared client-cache (used by swrFetch)
    try {
      import('@/lib/client-cache').then(({ invalidateKeysByPrefix }) => {
        invalidateKeysByPrefix(prefix)
      }).catch(() => {
        // client-cache may not be available during SSR
      })
    } catch {
      // client-cache may not be available during SSR
    }
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null
    // Check memory first, then fallback to localStorage (for migration)
    return this._token || localStorage.getItem('sb_token')
  }

  setToken(token: string): void {
    if (typeof window === 'undefined') return
    this._token = token
    // Also keep in localStorage for migration period
    localStorage.setItem('sb_token', token)
  }

  clearToken(): void {
    if (typeof window === 'undefined') return
    this._token = null
    localStorage.removeItem('sb_token')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    // Add JWT token to Authorization header if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Offline interceptor: queue mutating requests, reject GET requests
    const method = (options.method || 'GET').toUpperCase()
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    const isGet = method === 'GET'

    // ---- Request deduplication for GET requests ----
    // If an identical GET request is already in-flight, return the same promise
    // instead of firing a duplicate network request.
    if (isGet) {
      const cacheKey = `${method}:${endpoint}`

      // Check short-lived response cache first
      const cached = this._responseCache.get(cacheKey)
      if (cached && Date.now() < cached.expiresAt) {
        return cached.data as T
      }

      // Check for in-flight deduplication
      const inflight = this._inflightRequests.get(cacheKey)
      if (inflight) {
        return inflight as Promise<T>
      }
    }

    if (typeof window !== 'undefined' && !navigator.onLine) {
      if (isMutating) {
        // Queue the operation for later sync
        try {
          const { queueOperation } = await import('@/lib/offline-queue')
          await queueOperation(
            endpoint,
            method,
            headers,
            options.body ? String(options.body) : null
          )
          // Return a mock "offline queued" response so callers don't break
          return { offline: true, queued: true } as unknown as T
        } catch {
          // If queuing fails, fall through to normal error
        }
      }
      throw new Error('You are offline. Please check your internet connection and try again.')
    }

    // Add timeout (30s) to prevent hanging requests
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    const signal = options.signal || controller.signal

    // For GET requests, register the inflight promise for deduplication
    const cacheKey = `${method}:${endpoint}`
    let isInflightRegistered = false

    if (isGet) {
      isInflightRegistered = true
    }

    // Create the fetch promise (may be shared across callers)
    const fetchPromise = (async () => {
      let response: Response
      try {
        response = await fetch(endpoint, {
          ...options,
          headers,
          signal,
        })
      } catch (err) {
        clearTimeout(timeoutId)
        // Clean up inflight registration
        if (isInflightRegistered) {
          this._inflightRequests.delete(cacheKey)
        }
        // If we got a network error during a mutating request, try to queue it
        if (err instanceof TypeError && err.message === 'Failed to fetch' && isMutating) {
          try {
            const { queueOperation } = await import('@/lib/offline-queue')
            await queueOperation(
              endpoint,
              method,
              headers,
              options.body ? String(options.body) : null
            )
            return { offline: true, queued: true } as unknown as T
          } catch {
            // Fall through to original error handling
          }
        }
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new Error('Request timed out — the server took too long to respond. Please try again.')
        }
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          throw new Error('Network error — please check your internet connection and try again.')
        }
        throw new Error(err instanceof Error ? err.message : 'An unexpected network error occurred')
      }

      clearTimeout(timeoutId)

      // Handle non-JSON responses gracefully
      let data: Record<string, unknown>
      try {
        data = await response.json() as Record<string, unknown>
      } catch {
        // Clean up inflight registration on parse error
        if (isInflightRegistered) {
          this._inflightRequests.delete(cacheKey)
        }
        if (!response.ok) {
          // Map common HTTP error codes to user-friendly messages — never expose raw status codes
          if (response.status === 401) throw new Error('Your session has expired. Please log in again.')
          if (response.status === 403) throw new Error('You do not have permission to perform this action')
          if (response.status === 404) throw new Error('The requested resource was not found')
          if (response.status === 429) throw new Error('Too many requests — please wait a moment and try again')
          if (response.status >= 500) throw new Error('Server error — please try again later')
          throw new Error('An unexpected error occurred. Please try again.')
        }
        throw new Error('Server returned an invalid response')
      }

      // Clean up inflight registration after response is parsed
      if (isInflightRegistered) {
        this._inflightRequests.delete(cacheKey)
      }

      if (!response.ok) {
        const errorMessage = (data.error as string) || (data.message as string) || 'An unexpected error occurred. Please try again.'
        const errorCode = data.code as string | undefined

        // Handle database unreachable errors
        if (response.status === 503 && errorCode === 'DB_UNREACHABLE') {
          const dbError = new Error('Database is unreachable') as Error & { code: string }
          dbError.code = 'DB_UNREACHABLE'
          throw dbError
        }

        // Handle auth errors — clear token and trigger logout if 401 from a non-auth endpoint
        // Auth endpoints (login, register, me) legitimately return 401 for wrong credentials
        // Also suppress auto-logout during active login to prevent race conditions
        const isAuthEndpoint = endpoint.startsWith('/api/auth/login') || endpoint.startsWith('/api/auth/register') || endpoint.startsWith('/api/auth/me')
        if (response.status === 401 && token && !isAuthEndpoint && !this._isLoggingIn) {
          // Only clear token and trigger logout if the token we sent is STILL the current token.
          // This prevents a stale background request from clearing a freshly-set token
          // after the user logged out and logged back in.
          const currentToken = this.getToken()
          if (token === currentToken) {
            this.clearToken()
            // Trigger logout via auth store to update UI state
            try {
              const { useAuthStore } = await import('@/lib/stores/auth-store')
              const store = useAuthStore.getState()
              if (store.isAuthenticated) {
                // Use setTimeout to avoid race conditions with concurrent requests.
                // If multiple 401s come in at the same time, only the first one will
                // trigger logout (subsequent ones will see isAuthenticated = false).
                setTimeout(() => {
                  const currentStore = useAuthStore.getState()
                  if (currentStore.isAuthenticated) {
                    currentStore.logout()
                  }
                }, 100)
              }
            } catch {
              // If import fails (e.g. during SSR), just clear the token
            }
          }
          throw new Error('Your session has expired. Please log in again.')
        }

        throw new Error(errorMessage)
      }

      // Cache successful GET responses for short TTL
      if (isGet) {
        this._responseCache.set(cacheKey, {
          data: data as T,
          expiresAt: Date.now() + ApiClient.RESPONSE_CACHE_TTL,
        })
      }

      return data as T
    })()

    // Register the inflight promise for GET deduplication
    if (isGet) {
      this._inflightRequests.set(cacheKey, fetchPromise)
    }

    return fetchPromise
  }

  // ============================================
  // Auth
  // ============================================

  async login(email: string, password: string): Promise<{
    token: string
    user: User
    organizations: Organization[]
  }> {
    // Clear any stale token before login to prevent sending old Authorization header
    this.clearToken()
    // Set guard flag to prevent stale 401 responses from triggering auto-logout
    // during the login process
    this._isLoggingIn = true
    try {
      const data = await this.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      if (data.token) {
        this.setToken(data.token)
      }
      return data
    } finally {
      // Always reset the guard flag, even if login fails
      this._isLoggingIn = false
    }
  }

  async register(name: string, email: string, password: string, orgName: string, extra?: {
    businessType?: string
    description?: string
    address?: string
    city?: string
    latitude?: number
    longitude?: number
    phone?: string
    referralCode?: string
  }): Promise<{
    token: string
    user: User
    organization: Organization
  }> {
    // Clear any stale token before register to prevent sending old Authorization header
    this.clearToken()
    this._isLoggingIn = true
    try {
      const data = await this.request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, organizationName: orgName, ...extra }),
      })
      if (data.token) {
        this.setToken(data.token)
      }
      return data
    } finally {
      this._isLoggingIn = false
    }
  }

  async getMe(): Promise<{
    user: User
    organizations: Organization[]
  }> {
    return this.request('/api/auth/me')
  }

  async resetPassword(email: string, currentPassword: string, newPassword: string): Promise<{
    message: string
  }> {
    return this.request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, currentPassword, newPassword }),
    })
  }

  // ============================================
  // Two-Factor Authentication (2FA)
  // ============================================

  async setup2fa(userId: string): Promise<{
    qrCodeUrl: string
    backupCodes: string[]
    secret: string
  }> {
    return this.request('/api/auth/2fa/setup', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  }

  async verify2faSetup(userId: string, code: string): Promise<{
    success: boolean
    message: string
  }> {
    return this.request('/api/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ userId, code }),
    })
  }

  async disable2fa(userId: string, code: string): Promise<{
    success: boolean
    message: string
  }> {
    return this.request('/api/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ userId, code }),
    })
  }

  async verify2faLogin(tempToken: string, code: string): Promise<{
    token: string
    user: User
    organizations: Organization[]
  }> {
    // Clear any stale token before 2FA verification
    this.clearToken()
    this._isLoggingIn = true
    try {
      const data = await this.request('/api/auth/login/2fa', {
        method: 'POST',
        body: JSON.stringify({ tempToken, code }),
      })
      if (data.token) {
        this.setToken(data.token)
      }
      return data
    } finally {
      this._isLoggingIn = false
    }
  }

  // ============================================
  // Session Management
  // ============================================

  async getSessions(): Promise<{
    sessions: Array<{
      id: string
      deviceName: string | null
      deviceType: string | null
      browser: string | null
      os: string | null
      ipAddress: string | null
      lastActiveAt: string
      isActive: boolean
      isCurrent: boolean
      createdAt: string
    }>
  }> {
    return this.request('/api/auth/sessions')
  }

  async revokeSession(sessionId: string): Promise<{ success: boolean }> {
    return this.request(`/api/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    })
  }

  async revokeAllSessions(): Promise<{ success: boolean; message: string }> {
    return this.request('/api/auth/sessions/revoke-all', {
      method: 'POST',
    })
  }

  // ============================================
  // Organizations
  // ============================================

  async getOrganizations(): Promise<{ organizations: Organization[] }> {
    return this.request('/api/organizations')
  }

  async getOrganization(id: string): Promise<{
    organization: Organization & {
      members: Array<{
        id: string
        userId: string
        role: string
        user: { id: string; name: string; email: string }
      }>
    }
  }> {
    return this.request(`/api/organizations/${id}`)
  }

  // ============================================
  // Shop Members
  // ============================================

  async getShopMemberInfo(orgId: string): Promise<ShopMemberInfo> {
    return this.request(`/api/shop-members?orgId=${orgId}`)
  }

  // ============================================
  // Product Types
  // ============================================

  async getProductTypes(orgId: string, shopId?: string): Promise<{ productTypes: ProductType[] }> {
    const params = new URLSearchParams({ orgId })
    if (shopId) params.set('shopId', shopId)
    return this.request(`/api/product-types?${params.toString()}`)
  }

  async createProductType(orgId: string, data: {
    name: string
    icon?: string
    attributes?: Array<{ name: string; fieldType: string; options?: string; required?: boolean }>
  }): Promise<{ productType: ProductType }> {
    return this.request('/api/product-types', {
      method: 'POST',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  async updateProductType(id: string, orgId: string, data: {
    name?: string
    icon?: string
    attributes?: Array<{ name: string; fieldType: string; options?: string; required?: boolean }>
  }): Promise<{ productType: ProductType }> {
    return this.request(`/api/product-types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  async deleteProductType(id: string, orgId: string): Promise<void> {
    await this.request(`/api/product-types/${id}?orgId=${orgId}`, {
      method: 'DELETE',
    })
  }

  // ============================================
  // Products
  // ============================================

  async getProducts(orgId: string, params?: {
    productTypeId?: string
    search?: string
    page?: number
    limit?: number
    shopId?: string
  }): Promise<{ products: Product[]; pagination: Pagination }> {
    const searchParams = new URLSearchParams({ orgId })
    if (params?.productTypeId) searchParams.set('productTypeId', params.productTypeId)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.shopId) searchParams.set('shopId', params.shopId)
    return this.request(`/api/products?${searchParams.toString()}`)
  }

  async createProduct(orgId: string, data: {
    productTypeId: string
    name: string
    sku?: string
    description?: string
    imageUrl?: string
    quantity?: number
    costPrice?: number
    sellingPrice?: number
    lowStockThreshold?: number
    attributeValues?: Array<{ attributeDefinitionId: string; value: string }>
    shopId?: string
  }): Promise<{ product: Product }> {
    const result = await this.request('/api/products', {
      method: 'POST',
      body: JSON.stringify({ orgId, ...data }),
    })
    this.invalidateCache('GET:/api/products')
    this.invalidateCache('GET:/api/inventory')
    this.invalidateCache('GET:/api/dashboard')
    return result
  }

  async updateProduct(id: string, orgId: string, data: {
    name?: string
    sku?: string
    description?: string
    imageUrl?: string
    costPrice?: number
    sellingPrice?: number
    lowStockThreshold?: number
    attributeValues?: Array<{ attributeDefinitionId: string; value: string }>
  }): Promise<{ product: Product }> {
    const result = await this.request(`/api/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ orgId, ...data }),
    })
    this.invalidateCache('GET:/api/products')
    this.invalidateCache('GET:/api/inventory')
    this.invalidateCache('GET:/api/dashboard')
    return result
  }

  async deleteProduct(id: string, orgId: string): Promise<void> {
    await this.request(`/api/products/${id}?orgId=${orgId}`, {
      method: 'DELETE',
    })
    this.invalidateCache('GET:/api/products')
    this.invalidateCache('GET:/api/inventory')
    this.invalidateCache('GET:/api/dashboard')
  }

  // ============================================
  // Inventory
  // ============================================

  async getInventory(orgId: string, shopId?: string): Promise<InventoryStats> {
    const params = new URLSearchParams({ orgId })
    if (shopId) params.set('shopId', shopId)
    return this.request(`/api/inventory?${params.toString()}`)
  }

  async addStockMovement(orgId: string, data: {
    productId: string
    type: string
    quantity: number
    reason?: string
    reference?: string
    shopId?: string
  }): Promise<{ movement: StockMovement }> {
    return this.request('/api/inventory', {
      method: 'POST',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  async getProductStockHistory(productId: string, orgId: string): Promise<{ movements: StockMovement[] }> {
    return this.request(`/api/inventory/${productId}?orgId=${orgId}`)
  }

  // ============================================
  // Customers
  // ============================================

  async getCustomers(orgId: string, params?: {
    search?: string
    page?: number
    limit?: number
    shopId?: string
  }): Promise<{ customers: Customer[]; pagination: Pagination }> {
    const searchParams = new URLSearchParams({ orgId })
    if (params?.search) searchParams.set('search', params.search)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.shopId) searchParams.set('shopId', params.shopId)
    return this.request(`/api/customers?${searchParams.toString()}`)
  }

  async createCustomer(orgId: string, data: {
    name: string
    email?: string
    phone?: string
    address?: string
    shopId?: string
  }): Promise<{ customer: Customer }> {
    const result = await this.request('/api/customers', {
      method: 'POST',
      body: JSON.stringify({ orgId, ...data }),
    })
    this.invalidateCache('GET:/api/customers')
    return result
  }

  async updateCustomer(id: string, orgId: string, data: {
    name?: string
    email?: string
    phone?: string
    address?: string
  }): Promise<{ customer: Customer }> {
    const result = await this.request(`/api/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ orgId, ...data }),
    })
    this.invalidateCache('GET:/api/customers')
    return result
  }

  async deleteCustomer(id: string, orgId: string): Promise<void> {
    await this.request(`/api/customers/${id}?orgId=${orgId}`, {
      method: 'DELETE',
    })
    this.invalidateCache('GET:/api/customers')
  }

  // ============================================
  // Suppliers
  // ============================================

  async getSuppliers(orgId: string, params?: {
    search?: string
    page?: number
    limit?: number
    shopId?: string
  }): Promise<{ suppliers: Supplier[]; pagination: Pagination }> {
    const searchParams = new URLSearchParams({ orgId })
    if (params?.search) searchParams.set('search', params.search)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.shopId) searchParams.set('shopId', params.shopId)
    return this.request(`/api/suppliers?${searchParams.toString()}`)
  }

  async createSupplier(orgId: string, data: {
    name: string
    email?: string
    phone?: string
    address?: string
    shopId?: string
  }): Promise<{ supplier: Supplier }> {
    return this.request('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  async updateSupplier(id: string, orgId: string, data: {
    name?: string
    email?: string
    phone?: string
    address?: string
  }): Promise<{ supplier: Supplier }> {
    return this.request(`/api/suppliers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  async deleteSupplier(id: string, orgId: string): Promise<void> {
    await this.request(`/api/suppliers/${id}?orgId=${orgId}`, {
      method: 'DELETE',
    })
  }

  // ============================================
  // Sales
  // ============================================

  async getSales(orgId: string, params?: {
    startDate?: string
    endDate?: string
    status?: string
    page?: number
    limit?: number
    shopId?: string
  }): Promise<{ sales: Sale[]; pagination: Pagination }> {
    const searchParams = new URLSearchParams({ orgId })
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.shopId) searchParams.set('shopId', params.shopId)
    return this.request(`/api/sales?${searchParams.toString()}`)
  }

  async createSale(orgId: string, data: {
    customerId?: string
    items: Array<{ productId: string; quantity: number; unitPrice?: number }>
    paymentMethod?: string
    discount?: number
    tax?: number
    amountPaid?: number
    notes?: string
    shopId?: string
  }): Promise<{ sale: Sale }> {
    const result = await this.request('/api/sales', {
      method: 'POST',
      body: JSON.stringify({ orgId, ...data }),
    })
    // Invalidate all related caches after sale creation
    this.invalidateCache('GET:/api/sales')
    this.invalidateCache('GET:/api/dashboard')
    this.invalidateCache('GET:/api/inventory')
    this.invalidateCache('GET:/api/products')
    this.invalidateCache('GET:/api/debts')
    return result
  }

  async getSale(id: string, orgId: string): Promise<{ sale: Sale }> {
    return this.request(`/api/sales/${id}?orgId=${orgId}`)
  }

  // ============================================
  // Debts
  // ============================================

  async getDebts(orgId: string, params?: {
    status?: string
    type?: string
    page?: number
    limit?: number
    shopId?: string
  }): Promise<{
    debts: Debt[]
    summary: {
      totalCustomerDebt: number
      totalSupplierDebt: number
      totalOutstanding: number
    }
    pagination: Pagination
  }> {
    const searchParams = new URLSearchParams({ orgId })
    if (params?.status) searchParams.set('status', params.status)
    if (params?.type) searchParams.set('type', params.type)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.shopId) searchParams.set('shopId', params.shopId)
    return this.request(`/api/debts?${searchParams.toString()}`)
  }

  async createDebt(orgId: string, data: {
    customerId?: string
    supplierId?: string
    type: string
    amount: number
    dueDate?: string
    description?: string
    shopId?: string
  }): Promise<{ debt: Debt }> {
    return this.request('/api/debts', {
      method: 'POST',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  async addDebtPayment(id: string, orgId: string, data: {
    amount: number
    paymentMethod?: string
    notes?: string
  }): Promise<{ debt: Debt }> {
    return this.request(`/api/debts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  // ============================================
  // Dashboard
  // ============================================

  async getDashboard(orgId: string, shopId?: string, from?: string, to?: string): Promise<DashboardData> {
    const params = new URLSearchParams({ orgId })
    if (shopId) params.set('shopId', shopId)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return this.request(`/api/dashboard?${params.toString()}`)
  }

  async getProductBarcode(productId: string, orgId: string): Promise<{
    product: { id: string; name: string; sku: string | null; costPrice: number; sellingPrice: number; quantity: number; productType: { id: string; name: string } }
    barcode: string
    qr: string
  }> {
    return this.request(`/api/products/${productId}/barcode?orgId=${orgId}`)
  }

  async importProducts(orgId: string, data: {
    shopId?: string
    products: Array<{
      name: string
      sku?: string
      productType?: string
      costPrice: number
      sellingPrice: number
      quantity: number
      lowStockThreshold: number
    }>
  }): Promise<{
    successCount: number
    failureCount: number
    errors: Array<{ row: number; field: string; message: string }>
    totalAttempted: number
  }> {
    return this.request('/api/products/import', {
      method: 'POST',
      body: JSON.stringify({ organizationId: orgId, ...data }),
    })
  }

  // ============================================
  // Reports
  // ============================================

  async getReports(orgId: string, params: {
    startDate: string
    endDate: string
    period?: string
    shopId?: string
  }): Promise<{
    salesByPeriod: Array<{ period: string; revenue: number; cost: number; profit: number; count: number }>
    bestSellingProducts: Array<{ productId: string; productName: string; totalQuantity: number; totalRevenue: number }>
    inventoryValuation: { totalCostValue: number; totalRetailValue: number; totalProducts: number }
  }> {
    const filteredParams = Object.fromEntries(
      Object.entries({ orgId, ...params }).filter(([, v]) => v !== undefined && v !== null && v !== '')
    )
    const searchParams = new URLSearchParams(filteredParams)
    return this.request(`/api/reports?${searchParams.toString()}`)
  }

  // ============================================
  // AI
  // ============================================

  async analyzeProductImage(orgId: string, imageFile: File): Promise<{
    analysis: {
      productName: string
      category: string
      estimatedPrice: string
      attributes: Array<{ key: string; value: string }>
      description: string
    }
  }> {
    const token = this.getToken()
    const formData = new FormData()
    formData.append('image', imageFile)
    formData.append('orgId', orgId)

    const headers: Record<string, string> = {}
    // Add JWT token to Authorization header if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch('/api/ai/inventory-assistant', {
      method: 'POST',
      headers,
      body: formData,
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'An error occurred')
    }
    return data
  }

  async askBusinessQuestion(orgId: string, question: string): Promise<{
    answer: string
  }> {
    return this.request('/api/ai/business-assistant', {
      method: 'POST',
      body: JSON.stringify({ orgId, question }),
    })
  }

  // ============================================
  // Subscriptions
  // ============================================

  async getSubscription(orgId: string): Promise<{
    subscription: Subscription & { planLimits: Record<string, unknown> }
  }> {
    return this.request(`/api/subscriptions?orgId=${orgId}`)
  }

  async updateSubscription(orgId: string, plan: string): Promise<{
    subscription: Subscription
  }> {
    return this.request('/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ orgId, plan }),
    })
  }

  // ============================================
  // Service Types
  // ============================================

  async getServiceTypes(orgId: string): Promise<{ serviceTypes: ServiceType[] }> {
    return this.request(`/api/service-types?orgId=${orgId}`)
  }

  async createServiceType(orgId: string, data: {
    name: string
    description?: string
    duration: number
    price: number
    imageUrl?: string
  }): Promise<{ serviceType: ServiceType }> {
    return this.request('/api/service-types', {
      method: 'POST',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  async updateServiceType(id: string, orgId: string, data: {
    name?: string
    description?: string
    duration?: number
    price?: number
    imageUrl?: string
    isActive?: boolean
  }): Promise<{ serviceType: ServiceType }> {
    return this.request(`/api/service-types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  async deleteServiceType(id: string, orgId: string): Promise<void> {
    await this.request(`/api/service-types/${id}?orgId=${orgId}`, {
      method: 'DELETE',
    })
  }

  // ============================================
  // Service Bookings
  // ============================================

  async getServiceBookings(orgId: string, params?: {
    date?: string
    status?: string
    page?: number
    limit?: number
    shopId?: string
  }): Promise<{ bookings: ServiceBooking[]; pagination: Pagination }> {
    const searchParams = new URLSearchParams({ orgId })
    if (params?.date) searchParams.set('date', params.date)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.shopId) searchParams.set('shopId', params.shopId)
    return this.request(`/api/service-bookings?${searchParams.toString()}`)
  }

  async createServiceBooking(orgId: string, data: {
    serviceTypeId: string
    customerName: string
    customerPhone?: string
    bookingDate: string
    startTime: string
    endTime: string
    notes?: string
    customerId?: string
    shopId?: string
  }): Promise<{ booking: ServiceBooking }> {
    return this.request('/api/service-bookings', {
      method: 'POST',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  async updateServiceBooking(id: string, orgId: string, data: {
    status?: string
    notes?: string
  }): Promise<{ booking: ServiceBooking }> {
    return this.request(`/api/service-bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  // ============================================
  // Admin
  // ============================================

  async getAdminDashboard(regionId?: string): Promise<AdminDashboardData> {
    if (regionId) {
      return this.request(`/api/admin/dashboard?regionId=${regionId}`)
    }
    return this.request('/api/admin/dashboard')
  }

  async getAdminShops(params?: {
    search?: string
    businessType?: string
    city?: string
    subscriptionPlan?: string
    regionId?: string
    page?: number
    limit?: number
  }): Promise<{ shops: ShopData[]; pagination: Pagination }> {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.set('search', params.search)
    if (params?.businessType) searchParams.set('businessType', params.businessType)
    if (params?.city) searchParams.set('city', params.city)
    if (params?.subscriptionPlan) searchParams.set('subscriptionPlan', params.subscriptionPlan)
    if (params?.regionId) searchParams.set('regionId', params.regionId)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    return this.request(`/api/admin/shops?${searchParams.toString()}`)
  }

  async getAdminMarketInsights(regionId?: string): Promise<MarketInsightsData> {
    if (regionId) {
      return this.request(`/api/admin/market-insights?regionId=${regionId}`)
    }
    return this.request('/api/admin/market-insights')
  }

  async getSystemHealth(): Promise<SystemHealthData> {
    return this.request('/api/admin/system/health')
  }

  // ============================================
  // Shops
  // ============================================

  async getShops(orgId: string): Promise<{ shops: Shop[] }> {
    return this.request(`/api/shops?orgId=${orgId}`)
  }

  async createShop(orgId: string, data: {
    name: string
    address?: string
    city?: string
    latitude?: number
    longitude?: number
    phone?: string
  }): Promise<{ shop: Shop }> {
    return this.request('/api/shops', {
      method: 'POST',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  async updateShop(id: string, orgId: string, data: {
    name?: string
    address?: string
    city?: string
    latitude?: number
    longitude?: number
    phone?: string
    isActive?: boolean
  }): Promise<{ shop: Shop }> {
    return this.request(`/api/shops/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  // ============================================
  // Shop Members
  // ============================================

  async getShopMembers(shopId: string, orgId: string): Promise<{ members: ShopMemberData[] }> {
    return this.request(`/api/shops/${shopId}/members?orgId=${orgId}`)
  }

  async addShopMember(shopId: string, orgId: string, data: {
    userId: string
    role: string
  }): Promise<{ member: ShopMemberData }> {
    return this.request(`/api/shops/${shopId}/members`, {
      method: 'POST',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  async updateShopMember(shopId: string, memberId: string, orgId: string, data: {
    role: string
  }): Promise<{ member: ShopMemberData }> {
    return this.request(`/api/shops/${shopId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  async removeShopMember(shopId: string, memberId: string, orgId: string): Promise<void> {
    await this.request(`/api/shops/${shopId}/members/${memberId}?orgId=${orgId}`, {
      method: 'DELETE',
    })
  }

  // ============================================
  // Modules
  // ============================================

  async getModules(orgId: string): Promise<{ modules: ModuleData[] }> {
    interface ModuleApiResponse {
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
      order: number
      isActive: boolean // Platform-level active flag
      orgStatus?: {
        isActive: boolean
        status: string
        activatedAt: string | null
        expiresAt: string | null
        priceAtActivation: number
        autoRenew: boolean
      } | null
    }
    const data = await this.request<{ modules: ModuleApiResponse[] }>(`/api/modules?orgId=${orgId}`)
    // Transform: isActive in ModuleData means "org has this module activated"
    const modules: ModuleData[] = data.modules.map(m => ({
      id: m.id,
      key: m.key,
      name: m.name,
      description: m.description,
      icon: m.icon,
      category: m.category,
      priceETB: m.priceETB,
      isFree: m.isFree,
      freeTrialDays: m.freeTrialDays,
      billingCycle: m.billingCycle,
      isActive: m.orgStatus?.isActive ?? false,
      order: m.order,
      orgStatus: m.orgStatus ?? null,
    }))
    return { modules }
  }

  async activateModule(orgId: string, moduleKey: string): Promise<{
    orgModule: { id: string; moduleId: string; isActive: boolean; status: string }
    module: { id: string; key: string; name: string }
  }> {
    return this.request('/api/modules/activate', {
      method: 'POST',
      body: JSON.stringify({ orgId, moduleKey }),
    })
  }

  async deactivateModule(orgId: string, moduleKey: string): Promise<{
    orgModule: { id: string; moduleId: string; isActive: boolean; status: string }
    module: { id: string; key: string; name: string }
  }> {
    return this.request('/api/modules/deactivate', {
      method: 'POST',
      body: JSON.stringify({ orgId, moduleKey }),
    })
  }

  async requestModule(orgId: string, moduleKey: string): Promise<{ success: boolean }> {
    return this.request('/api/modules/request', {
      method: 'POST',
      body: JSON.stringify({ orgId, moduleKey }),
    })
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  async getNotifications(orgId: string, params?: { unreadOnly?: boolean; limit?: number; shopId?: string }): Promise<{
    notifications: Array<{
      id: string
      type: string
      title: string
      message: string
      isRead: boolean
      actionUrl: string | null
      metadata: string | null
      createdAt: string
    }>
    unreadCount: number
  }> {
    const searchParams = new URLSearchParams({ orgId })
    if (params?.unreadOnly) searchParams.set('unreadOnly', 'true')
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.shopId) searchParams.set('shopId', params.shopId)
    return this.request(`/api/notifications?${searchParams.toString()}`)
  }

  async markNotificationRead(notificationId: string): Promise<{ success: boolean }> {
    return this.request(`/api/notifications/${notificationId}/read`, { method: 'POST' })
  }

  async markAllNotificationsRead(orgId: string): Promise<{ success: boolean }> {
    return this.request('/api/notifications/mark-all-read', {
      method: 'POST',
      body: JSON.stringify({ orgId }),
    })
  }

  // ============================================
  // MODULE SUBSCRIPTIONS
  // ============================================

  async subscribeModule(orgId: string, moduleKey: string, billingCycle: string = 'monthly'): Promise<{
    orgModule: { id: string; status: string; isActive: boolean; expiresAt: string | null }
  }> {
    return this.request('/api/modules/subscribe', {
      method: 'POST',
      body: JSON.stringify({ orgId, moduleKey, billingCycle }),
    })
  }

  async renewModule(orgId: string, moduleKey: string): Promise<{
    orgModule: { id: string; status: string; isActive: boolean; expiresAt: string | null }
  }> {
    return this.request('/api/modules/renew', {
      method: 'POST',
      body: JSON.stringify({ orgId, moduleKey }),
    })
  }

  // ============================================
  // Admin Module Management
  // ============================================

  async getAdminModules(): Promise<{ modules: Array<{
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
  }> }> {
    return this.request('/api/admin/modules')
  }

  async createAdminModule(data: {
    key: string
    name: string
    description: string
    icon?: string
    category?: string
    priceETB?: number
    isFree?: boolean
    freeTrialDays?: number
    billingCycle?: string
    order?: number
  }): Promise<{ module: ModuleData }> {
    return this.request('/api/admin/modules', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateAdminModule(id: string, data: {
    name?: string
    description?: string
    icon?: string
    category?: string
    priceETB?: number
    isFree?: boolean
    freeTrialDays?: number
    billingCycle?: string
    isActive?: boolean
    order?: number
  }): Promise<{ module: ModuleData }> {
    return this.request(`/api/admin/modules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteAdminModule(id: string): Promise<{ module: ModuleData }> {
    return this.request(`/api/admin/modules/${id}`, {
      method: 'DELETE',
    })
  }

  async getAdminOrganizations(params?: {
    search?: string
    regionId?: string
    page?: number
    limit?: number
  }): Promise<{
    organizations: Array<{
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
      members: Array<{ id: string; role: string; name: string; email: string }>
      shops: Array<{ id: string; name: string; city: string | null; isActive: boolean }>
      modules: Array<{
        id: string
        key: string
        name: string
        status: string
        isActive: boolean
        expiresAt: string | null
        priceAtActivation: number
        autoRenew: boolean
      }>
    }>
    pagination: Pagination
  }> {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.set('search', params.search)
    if (params?.regionId) searchParams.set('regionId', params.regionId)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    return this.request(`/api/admin/organizations?${searchParams.toString()}`)
  }

  async assignModuleToOrg(orgId: string, data: {
    moduleKey: string
    status?: string
    durationDays?: number
    autoRenew?: boolean
  }): Promise<{
    orgModule: { id: string; status: string; isActive: boolean; expiresAt: string | null }
    module: { id: string; key: string; name: string }
  }> {
    return this.request(`/api/admin/organizations/${orgId}/modules`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateOrgModule(orgId: string, data: {
    moduleKey: string
    status?: string
    isActive?: boolean
    autoRenew?: boolean
    durationDays?: number
  }): Promise<{
    orgModule: { id: string; status: string; isActive: boolean; expiresAt: string | null }
    module: { id: string; key: string; name: string }
  }> {
    return this.request(`/api/admin/organizations/${orgId}/modules`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async revokeModuleFromOrg(orgId: string, moduleKey: string): Promise<{
    orgModule: { id: string; status: string; isActive: boolean }
    module: { id: string; key: string; name: string }
  }> {
    return this.request(`/api/admin/organizations/${orgId}/modules?moduleKey=${moduleKey}`, {
      method: 'DELETE',
    })
  }

  async getOrgModules(orgId: string): Promise<{
    modules: Array<{
      id: string
      moduleId: string
      key: string
      name: string
      description: string
      icon: string
      category: string
      priceETB: number
      isFree: boolean
      status: string
      isActive: boolean
      activatedAt: string
      expiresAt: string | null
      priceAtActivation: number
      autoRenew: boolean
    }>
  }> {
    return this.request(`/api/admin/organizations/${orgId}/modules`)
  }

  // ============================================
  // Sales Team (Admin)
  // ============================================

  async getAdminSalesReps(params?: { limit?: number; search?: string }): Promise<{ salesReps: SalesRep[] }> {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.search) searchParams.set('search', params.search)
    return this.request(`/api/admin/sales-reps?${searchParams.toString()}`)
  }

  async createAdminSalesRep(data: { name: string; email: string; phone?: string; targetCity?: string; commissionPerReg: number }): Promise<{ salesRep: SalesRep }> {
    return this.request('/api/admin/sales-reps', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateAdminSalesRep(repId: string, data: { phone?: string | null; targetCity?: string | null; commissionPerReg?: number }): Promise<{ salesRep: SalesRep }> {
    return this.request(`/api/admin/sales-reps/${repId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deactivateAdminSalesRep(repId: string): Promise<{ salesRep: SalesRep }> {
    return this.request(`/api/admin/sales-reps/${repId}`, { method: 'DELETE' })
  }

  async getAdminSalesRepCommissions(repId: string, params?: { limit?: number }): Promise<{
    commissions: Commission[]
    summary: { total: number; pending: number; paid: number; cancelled: number }
  }> {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    return this.request(`/api/admin/sales-reps/${repId}/commissions?${searchParams.toString()}`)
  }

  async updateAdminSalesRepCommissions(repId: string, data: { commissionIds: string[] }): Promise<{ updated: number }> {
    return this.request(`/api/admin/sales-reps/${repId}/commissions`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async setAdminSalesRepGoal(repId: string, data: { period: string; targetCount: number; bonusAmount: number }): Promise<{ goal: SalesRepGoal }> {
    return this.request(`/api/admin/sales-reps/${repId}/goals`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getAdminSalesTeamOverview(): Promise<TeamOverview> {
    return this.request('/api/admin/sales-team/overview')
  }

  // ============================================
  // Sales Rep Dashboard
  // ============================================

  async getSalesRepDashboard(): Promise<{
    stats: {
      totalRegistrations: number
      thisMonthRegistrations: number
      pendingCommissions: number
      totalEarned: number
    }
    currentGoal: {
      id: string
      period: string
      targetCount: number
      achievedCount: number
      bonusAmount: number
      isAchieved: boolean
    } | null
    recentRegistrations: Array<{
      id: string
      name: string
      city: string | null
      businessType: string
      createdAt: string
      subscriptionPlan: string
      subscriptionStatus: string
    }>
    recentCommissions: Array<{
      id: string
      amount: number
      status: string
      createdAt: string
      organization: { name: string }
    }>
  }> {
    return this.request('/api/sales-rep/dashboard')
  }

  // ============================================
  // Admin Users Management
  // ============================================

  async getAdminUsers(params?: {
    search?: string
    role?: string
    page?: number
    limit?: number
  }): Promise<{
    users: Array<{
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
    }>
    stats: {
      totalUsers: number
      adminCount: number
      salesRepCount: number
      businessUserCount: number
    }
    pagination: Pagination
  }> {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.set('search', params.search)
    if (params?.role) searchParams.set('role', params.role)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    return this.request(`/api/admin/users?${searchParams.toString()}`)
  }

  async getAdminUser(id: string): Promise<{
    user: {
      id: string
      name: string
      email: string
      role: string
      avatarUrl: string | null
      createdAt: string
      updatedAt: string
      supabaseUid: string | null
      memberships: Array<{
        id: string
        role: string
        joinedAt: string
        organization: {
          id: string
          name: string
          slug: string
          businessType: string
          city: string | null
          subscriptionPlan: string
          subscriptionStatus: string
        }
      }>
      shopMemberships: Array<{
        id: string
        role: string
        joinedAt: string
        shop: {
          id: string
          name: string
          city: string | null
          isActive: boolean
          organization: { id: string; name: string }
        }
      }>
      salesRep: {
        id: string
        phone: string | null
        targetCity: string | null
        commissionRate: number
        commissionPerReg: number
        isActive: boolean
      } | null
    }
  }> {
    return this.request(`/api/admin/users/${id}`)
  }

  async updateAdminUser(id: string, data: {
    name?: string
    role?: string
    password?: string
  }): Promise<{
    user: {
      id: string
      name: string
      email: string
      role: string
      avatarUrl: string | null
      createdAt: string
      updatedAt: string
      organizations: Array<{
        id: string
        name: string
        role: string
        businessType: string
      }>
    }
  }> {
    return this.request(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteAdminUser(id: string): Promise<{
    success: boolean
    deletedOrgIds: string[]
    message: string
  }> {
    return this.request(`/api/admin/users/${id}`, {
      method: 'DELETE',
    })
  }

  // ============================================
  // Admin Organization Management
  // ============================================

  async updateAdminOrgSubscription(orgId: string, data: {
    subscriptionPlan: string
  }): Promise<{
    organization: {
      id: string
      subscriptionPlan: string
      subscriptionStatus: string
    }
  }> {
    return this.request(`/api/admin/organizations/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async updateAdminOrgStatus(orgId: string, data: {
    subscriptionStatus: string
  }): Promise<{
    organization: {
      id: string
      subscriptionStatus: string
    }
  }> {
    return this.request(`/api/admin/organizations/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async updateAdminOrg(orgId: string, data: {
    name?: string
    businessType?: string
    description?: string
    address?: string
    city?: string
    phone?: string
    subscriptionPlan?: string
    subscriptionStatus?: string
    isActive?: boolean
  }): Promise<{
    organization: {
      id: string
      name: string
      slug: string
      businessType: string
      description: string | null
      address: string | null
      city: string | null
      phone: string | null
      subscriptionPlan: string
      subscriptionStatus: string
      subscriptionExpiresAt: string | null
      isActive: boolean
      createdAt: string
      updatedAt: string
    }
  }> {
    return this.request(`/api/admin/organizations/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteAdminOrg(orgId: string): Promise<{
    success: boolean
    message: string
  }> {
    return this.request(`/api/admin/organizations/${orgId}`, {
      method: 'DELETE',
    })
  }

  // ============================================
  // Admin Announcements
  // ============================================

  async sendAdminAnnouncement(data: {
    title: string
    message: string
    targetOrgId?: string
    type: string
  }): Promise<{
    announcement: {
      id: string
      title: string
      message: string
      type: string
      targetOrgId: string | null
      recipientCount: number
      createdAt: string
    }
  }> {
    return this.request('/api/admin/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ============================================
  // Region Management
  // ============================================

  async getAdminRegions(params?: {
    search?: string
    includeStats?: boolean
  }): Promise<{ regions: RegionData[] }> {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.set('search', params.search)
    if (params?.includeStats !== undefined) searchParams.set('includeStats', String(params.includeStats))
    return this.request(`/api/admin/regions?${searchParams.toString()}`)
  }

  async getAdminRegion(id: string): Promise<RegionDetailData> {
    return this.request(`/api/admin/regions/${id}`)
  }

  async createAdminRegion(data: {
    name: string
    slug: string
    country?: string
    latitude?: number
    longitude?: number
    population?: number
    description?: string
    order?: number
  }): Promise<{ region: RegionData }> {
    return this.request('/api/admin/regions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateAdminRegion(id: string, data: {
    name?: string
    slug?: string
    country?: string
    latitude?: number
    longitude?: number
    population?: number
    description?: string
    isActive?: boolean
    order?: number
  }): Promise<{ region: RegionData }> {
    return this.request(`/api/admin/regions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteAdminRegion(id: string): Promise<{ region: RegionData }> {
    return this.request(`/api/admin/regions/${id}`, {
      method: 'DELETE',
    })
  }

  async getAdminRegionOrganizations(regionId: string, params?: {
    search?: string
    businessType?: string
    subscriptionPlan?: string
    page?: number
    limit?: number
  }): Promise<{
    organizations: Array<{
      id: string
      name: string
      businessType: string
      city: string | null
      subscriptionPlan: string
      memberCount: number
      shopCount: number
      salesCount: number
      revenue: number
    }>
    pagination: Pagination
  }> {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.set('search', params.search)
    if (params?.businessType) searchParams.set('businessType', params.businessType)
    if (params?.subscriptionPlan) searchParams.set('subscriptionPlan', params.subscriptionPlan)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    return this.request(`/api/admin/regions/${regionId}/organizations?${searchParams.toString()}`)
  }

  // ============================================
  // Admin Announcements
  // ============================================

  async getAdminAnnouncements(params?: {
    type?: string
    page?: number
    limit?: number
  }): Promise<{
    announcements: Array<{
      id: string
      title: string
      message: string
      type: string
      targetOrgId: string | null
      targetOrgName: string | null
      recipientCount: number
      createdAt: string
    }>
    pagination: Pagination
  }> {
    const searchParams = new URLSearchParams()
    if (params?.type) searchParams.set('type', params.type)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    return this.request(`/api/admin/notifications?${searchParams.toString()}`)
  }

  // ============================================
  // Admin Audit Logs
  // ============================================

  async getAdminAuditLogs(params?: {
    page?: number
    limit?: number
    action?: string
    entity?: string
    userId?: string
    from?: string
    to?: string
    search?: string
  }): Promise<{
    logs: Array<{
      id: string
      action: string
      entity: string
      entityId: string | null
      details: string | null
      ipAddress: string | null
      userAgent: string | null
      createdAt: string
      organizationId: string | null
      user: { id: string; name: string; email: string; role: string } | null
    }>
    summary: {
      totalActionsToday: number
      mostActiveUser: { name: string; count: number } | null
      mostChangedEntity: { entity: string; count: number } | null
    }
    filters: {
      actions: string[]
      entities: string[]
    }
    pagination: Pagination
  }> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.action) searchParams.set('action', params.action)
    if (params?.entity) searchParams.set('entity', params.entity)
    if (params?.userId) searchParams.set('userId', params.userId)
    if (params?.from) searchParams.set('from', params.from)
    if (params?.to) searchParams.set('to', params.to)
    if (params?.search) searchParams.set('search', params.search)
    return this.request(`/api/admin/audit-logs?${searchParams.toString()}`)
  }

  // ============================================
  // Organization Audit Logs
  // ============================================

  async getOrgAuditLogs(params: {
    organizationId: string
    page?: number
    limit?: number
    action?: string
    entity?: string
    from?: string
    to?: string
  }): Promise<{
    logs: Array<{
      id: string
      action: string
      entity: string
      entityId: string | null
      details: string | null
      ipAddress: string | null
      createdAt: string
      user: { id: string; name: string; email: string } | null
    }>
    filters: {
      actions: string[]
      entities: string[]
    }
    pagination: Pagination
  }> {
    const searchParams = new URLSearchParams()
    searchParams.set('organizationId', params.organizationId)
    if (params.page) searchParams.set('page', params.page.toString())
    if (params.limit) searchParams.set('limit', params.limit.toString())
    if (params.action) searchParams.set('action', params.action)
    if (params.entity) searchParams.set('entity', params.entity)
    if (params.from) searchParams.set('from', params.from)
    if (params.to) searchParams.set('to', params.to)
    return this.request(`/api/audit-logs?${searchParams.toString()}`)
  }

  // ============================================
  // Smart Search
  // ============================================

  async smartSearch(organizationId: string, query: string): Promise<{
    query: string
    results: Record<string, Array<Record<string, unknown>>>
  }> {
    return this.request('/api/smart-search', {
      method: 'POST',
      body: JSON.stringify({ query, organizationId }),
    })
  }

  // ============================================
  // AI Anomaly Detection
  // ============================================

  async detectAnomalies(organizationId: string): Promise<Record<string, unknown>> {
    return this.request('/api/ai/anomaly-detection', {
      method: 'POST',
      body: JSON.stringify({ organizationId }),
    })
  }

  // ============================================
  // AI Price Optimization
  // ============================================

  async optimizePrices(organizationId: string, productId?: string): Promise<Record<string, unknown>> {
    return this.request('/api/ai/price-optimization', {
      method: 'POST',
      body: JSON.stringify({ organizationId, productId }),
    })
  }

  // ============================================
  // AI Sales Forecast
  // ============================================

  async getSalesForecast(organizationId: string, period: 'week' | 'month' | 'quarter'): Promise<Record<string, unknown>> {
    return this.request('/api/ai/sales-forecast', {
      method: 'POST',
      body: JSON.stringify({ organizationId, period }),
    })
  }

  // ============================================
  // INTEGRATIONS — Telegram & WhatsApp
  // ============================================

  async getTelegramConfig(organizationId: string): Promise<{
    config: {
      id: string
      type: string
      isActive: boolean
      chatId: string
      botTokenMasked: string
      notificationTypes: {
        low_stock: boolean
        debt_reminder: boolean
        daily_summary: boolean
        new_sale: boolean
      }
      createdAt: string
      updatedAt: string
    } | null
  }> {
    return this.request(`/api/integrations/telegram?organizationId=${encodeURIComponent(organizationId)}`)
  }

  async saveTelegramConfig(organizationId: string, data: {
    botToken?: string
    chatId: string
    notificationTypes?: {
      low_stock: boolean
      debt_reminder: boolean
      daily_summary: boolean
      new_sale: boolean
    }
  }): Promise<{ success: boolean; config: Record<string, unknown> }> {
    return this.request('/api/integrations/telegram', {
      method: 'POST',
      body: JSON.stringify({ organizationId, ...data }),
    })
  }

  async deleteTelegramConfig(organizationId: string): Promise<{ success: boolean }> {
    return this.request(`/api/integrations/telegram?organizationId=${encodeURIComponent(organizationId)}`, {
      method: 'DELETE',
    })
  }

  async getWhatsappConfig(organizationId: string): Promise<{
    config: {
      id: string
      type: string
      isActive: boolean
      phoneNumber: string
      apiKeyMasked: string
      notificationTypes: {
        low_stock: boolean
        debt_reminder: boolean
        daily_summary: boolean
        new_sale: boolean
      }
      createdAt: string
      updatedAt: string
    } | null
  }> {
    return this.request(`/api/integrations/whatsapp?organizationId=${encodeURIComponent(organizationId)}`)
  }

  async saveWhatsappConfig(organizationId: string, data: {
    phoneNumber: string
    apiKey?: string
    notificationTypes?: {
      low_stock: boolean
      debt_reminder: boolean
      daily_summary: boolean
      new_sale: boolean
    }
  }): Promise<{ success: boolean; config: Record<string, unknown> }> {
    return this.request('/api/integrations/whatsapp', {
      method: 'POST',
      body: JSON.stringify({ organizationId, ...data }),
    })
  }

  async deleteWhatsappConfig(organizationId: string): Promise<{ success: boolean }> {
    return this.request(`/api/integrations/whatsapp?organizationId=${encodeURIComponent(organizationId)}`, {
      method: 'DELETE',
    })
  }

  async testIntegration(organizationId: string, type: 'telegram' | 'whatsapp'): Promise<{
    success: boolean
    message?: string
    error?: string
  }> {
    return this.request('/api/integrations/test', {
      method: 'POST',
      body: JSON.stringify({ organizationId, type }),
    })
  }

  // ============================================
  // Stock Transfers
  // ============================================

  async getStockTransfers(orgId: string, params?: {
    status?: string
  }): Promise<{
    transfers: Array<{
      id: string
      organizationId: string
      fromShopId: string
      toShopId: string
      productId: string
      quantity: number
      status: string
      notes: string | null
      createdAt: string
      updatedAt: string
      completedAt: string | null
      product: { id: string; name: string; sku: string | null }
      fromShop: { id: string; name: string }
      toShop: { id: string; name: string }
    }>
  }> {
    const searchParams = new URLSearchParams({ orgId })
    if (params?.status) searchParams.set('status', params.status)
    return this.request(`/api/stock-transfers?${searchParams.toString()}`)
  }

  async createStockTransfer(orgId: string, data: {
    productId: string
    fromShopId: string
    toShopId: string
    quantity: number
    notes?: string
  }): Promise<{
    transfer: Record<string, unknown>
  }> {
    return this.request('/api/stock-transfers', {
      method: 'POST',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  async updateStockTransfer(transferId: string, orgId: string, data: {
    action: string
    receivedItems?: Array<{ itemId: string; receivedQty: number }>
  }): Promise<{
    transfer: Record<string, unknown>
  }> {
    return this.request(`/api/stock-transfers/${transferId}`, {
      method: 'PUT',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  // ============================================
  // Purchase Orders
  // ============================================

  async getPurchaseOrders(orgId: string, params?: {
    status?: string
    lowStockOnly?: string
  }): Promise<{
    purchaseOrders: Array<Record<string, unknown>>
    lowStockProducts?: Array<Record<string, unknown>>
  }> {
    const searchParams = new URLSearchParams({ orgId })
    if (params?.status) searchParams.set('status', params.status)
    if (params?.lowStockOnly) searchParams.set('lowStockOnly', params.lowStockOnly)
    return this.request(`/api/purchase-orders?${searchParams.toString()}`)
  }

  async getPurchaseOrder(poId: string, orgId: string): Promise<{
    purchaseOrder: Record<string, unknown>
  }> {
    return this.request(`/api/purchase-orders/${poId}?orgId=${orgId}`)
  }

  async createPurchaseOrder(orgId: string, data: {
    supplierId?: string | null
    shopId?: string | null
    notes?: string
    expectedDate?: string | null
    items: Array<{ productId: string; quantity: number; unitCost: number }>
  }): Promise<{
    purchaseOrder: Record<string, unknown>
  }> {
    return this.request('/api/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({ orgId, ...data }),
    })
  }

  async updatePurchaseOrder(poId: string, orgId: string, data: {
    action: string
    receivedItems?: Array<{ itemId: string; receivedQty: number }>
  }): Promise<{
    purchaseOrder: Record<string, unknown>
  }> {
    return this.request(`/api/purchase-orders/${poId}`, {
      method: 'PUT',
      body: JSON.stringify({ orgId, ...data }),
    })
  }
}

export const api = new ApiClient()

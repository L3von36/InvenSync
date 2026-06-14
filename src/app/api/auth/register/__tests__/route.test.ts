import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to ensure mock functions are available when vi.mock factories run
const {
  mockApplyRateLimit,
  mockHashPassword,
  mockGenerateToken,
  mockUserFindUnique,
  mockUserCreate,
  mockUserUpdate,
  mockOrgCreate,
  mockOrgFindUnique,
  mockMemberCreate,
  mockMemberFindFirst,
  mockMemberFindMany,
  mockShopCreate,
  mockShopMemberCreate,
  mockModuleFindMany,
  mockOrgModuleCreate,
  mockSalesRepFindUnique,
  mockCommissionCreate,
  mockGoalUpsert,
  mockProductTypeCreate,
  mockProductTypeCount,
  mockAttributeDefinitionCreate,
} = vi.hoisted(() => ({
  mockApplyRateLimit: vi.fn(),
  mockHashPassword: vi.fn(),
  mockGenerateToken: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockOrgCreate: vi.fn(),
  mockOrgFindUnique: vi.fn(),
  mockMemberCreate: vi.fn(),
  mockMemberFindFirst: vi.fn(),
  mockMemberFindMany: vi.fn(),
  mockShopCreate: vi.fn(),
  mockShopMemberCreate: vi.fn(),
  mockModuleFindMany: vi.fn(),
  mockOrgModuleCreate: vi.fn(),
  mockSalesRepFindUnique: vi.fn(),
  mockCommissionCreate: vi.fn(),
  mockGoalUpsert: vi.fn(),
  mockProductTypeCreate: vi.fn(),
  mockProductTypeCount: vi.fn(),
  mockAttributeDefinitionCreate: vi.fn(),
}))

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  applyRateLimit: (...args: any[]) => mockApplyRateLimit(...args),
  RateLimitTiers: {
    AUTH: { maxRequests: 5, windowMs: 60000, keyPrefix: 'auth' },
  },
}))

// Mock api-error
vi.mock('@/lib/api-error', () => ({
  isDatabaseError: (err: unknown) => {
    if (err instanceof Error) {
      return err.message.includes('connect') || err.message.includes('ECONNREFUSED') || err.name === 'DatabaseUnavailableError'
    }
    return false
  },
}))

// Mock sanitize - use real implementation
vi.mock('@/lib/sanitize', async (importOriginal) => {
  const actual = await importOriginal() as any
  return { ...actual }
})

// Mock auth
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    hashPassword: (...args: any[]) => mockHashPassword(...args),
    generateToken: (...args: any[]) => mockGenerateToken(...args),
  }
})

// Mock db with $transaction support
vi.mock('@/lib/db', () => {
  const mockFns = {
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
      create: (...args: any[]) => mockUserCreate(...args),
      update: (...args: any[]) => mockUserUpdate(...args),
    },
    organization: {
      create: (...args: any[]) => mockOrgCreate(...args),
      findUnique: (...args: any[]) => mockOrgFindUnique(...args),
    },
    organizationMember: {
      create: (...args: any[]) => mockMemberCreate(...args),
      findFirst: (...args: any[]) => mockMemberFindFirst(...args),
      findMany: (...args: any[]) => mockMemberFindMany(...args),
    },
    shop: {
      create: (...args: any[]) => mockShopCreate(...args),
    },
    shopMember: {
      create: (...args: any[]) => mockShopMemberCreate(...args),
    },
    module: {
      findMany: (...args: any[]) => mockModuleFindMany(...args),
    },
    organizationModule: {
      create: (...args: any[]) => mockOrgModuleCreate(...args),
    },
    salesRep: {
      findUnique: (...args: any[]) => mockSalesRepFindUnique(...args),
    },
    salesCommission: {
      create: (...args: any[]) => mockCommissionCreate(...args),
    },
    salesGoal: {
      upsert: (...args: any[]) => mockGoalUpsert(...args),
    },
    productType: {
      create: (...args: any[]) => mockProductTypeCreate(...args),
      count: (...args: any[]) => mockProductTypeCount(...args),
    },
    attributeDefinition: {
      create: (...args: any[]) => mockAttributeDefinitionCreate(...args),
    },
  }
  return {
    db: {
      ...mockFns,
      $transaction: async (fn: (tx: typeof mockFns) => Promise<unknown>) => {
        return fn(mockFns)
      },
    },
  }
})

import { POST } from '@/app/api/auth/register/route'

// Helper: strong password that passes validatePasswordStrength
const STRONG_PASSWORD = 'Str0ng!Pass123'

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue({ allowed: true, remaining: 4 })
    // Business-template seeding runs inside the registration transaction.
    mockProductTypeCreate.mockResolvedValue({ id: 'pt-1' })
    mockProductTypeCount.mockResolvedValue(0)
    mockAttributeDefinitionCreate.mockResolvedValue({ id: 'ad-1' })
  })

  it('should return 400 when required fields are missing', async () => {
    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('required')
  })

  it('should return 400 when password is too weak', async () => {
    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', name: 'Test', password: 'weak', organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('8 characters')
  })

  it('should return 400 when password has no uppercase', async () => {
    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', name: 'Test', password: 'lowercase1!', organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('uppercase')
  })

  it('should return 400 when password has no special character', async () => {
    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', name: 'Test', password: 'NoSpecial1', organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('special')
  })

  it('should return 409 when email is already registered', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      passwordHash: 'existinghash',
    })

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', name: 'Test', password: STRONG_PASSWORD, organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toContain('already exists')
  })

  it('should register a new user and return 201', async () => {
    mockUserFindUnique.mockResolvedValue(null)
    mockOrgFindUnique.mockResolvedValue(null)
    mockHashPassword.mockResolvedValue('hashedpassword')
    mockUserCreate.mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test', role: 'owner' })
    mockOrgCreate.mockResolvedValue({ id: 'org-1', name: 'Test Org', slug: 'test-org-abc', businessType: 'retail', city: null })
    mockMemberCreate.mockResolvedValue({ id: 'mem-1' })
    mockShopCreate.mockResolvedValue({ id: 'shop-1' })
    mockShopMemberCreate.mockResolvedValue({ id: 'sm-1' })
    mockModuleFindMany.mockResolvedValue([])
    mockGenerateToken.mockReturnValue('jwt-token-123')

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', name: 'New User', password: STRONG_PASSWORD, organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.token).toBe('jwt-token-123')
    expect(body.user).toBeDefined()
    expect(body.organization).toBeDefined()
    expect(mockHashPassword).toHaveBeenCalledWith(STRONG_PASSWORD)
  })

  it('should default business type to general_retail when invalid type provided', async () => {
    mockUserFindUnique.mockResolvedValue(null)
    mockOrgFindUnique.mockResolvedValue(null)
    mockHashPassword.mockResolvedValue('hashedpassword')
    mockUserCreate.mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test', role: 'owner' })
    mockOrgCreate.mockResolvedValue({ id: 'org-1', name: 'Test Org', slug: 'test-org-abc', businessType: 'general_retail', city: null })
    mockMemberCreate.mockResolvedValue({ id: 'mem-1' })
    mockShopCreate.mockResolvedValue({ id: 'shop-1' })
    mockShopMemberCreate.mockResolvedValue({ id: 'sm-1' })
    mockModuleFindMany.mockResolvedValue([])
    mockGenerateToken.mockReturnValue('jwt-token-123')

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', name: 'New User', password: STRONG_PASSWORD, organizationName: 'Test Org', businessType: 'invalid' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    expect(mockOrgCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessType: 'general_retail' }),
      })
    )
  })

  it('should return 409 for existing user without passwordHash', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      passwordHash: '',
      name: 'Existing',
    })

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', name: 'Updated Name', password: STRONG_PASSWORD, organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toContain('already exists')
  })

  it('should return 500 on internal server error', async () => {
    mockUserFindUnique.mockRejectedValue(new Error('Unexpected error'))

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', name: 'Test', password: STRONG_PASSWORD, organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Internal server error')
  })

  it('should return 429 when rate limit is exceeded', async () => {
    mockApplyRateLimit.mockReturnValue({ allowed: false, remaining: 0 })

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', name: 'Test', password: STRONG_PASSWORD, organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.error).toContain('Too many requests')
  })

  it('should return 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid request body')
  })
})

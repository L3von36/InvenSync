import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth
const mockHashPassword = vi.fn()
const mockGenerateToken = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    hashPassword: (...args: any[]) => mockHashPassword(...args),
    generateToken: (...args: any[]) => mockGenerateToken(...args),
  }
})

// Mock db
const mockUserFindUnique = vi.fn()
const mockUserCreate = vi.fn()
const mockUserUpdate = vi.fn()
const mockOrgCreate = vi.fn()
const mockOrgFindUnique = vi.fn()
const mockMemberCreate = vi.fn()
const mockMemberFindFirst = vi.fn()
const mockMemberFindMany = vi.fn()
const mockShopCreate = vi.fn()
const mockShopMemberCreate = vi.fn()
const mockModuleFindMany = vi.fn()
const mockOrgModuleCreate = vi.fn()
const mockSalesRepFindUnique = vi.fn()
const mockCommissionCreate = vi.fn()
const mockGoalUpsert = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
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
  },
}))

import { POST } from '@/app/api/auth/register/route'

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('should return 409 when email is already registered with password', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      passwordHash: 'existinghash',
    })

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', name: 'Test', password: 'pass123', organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toContain('already registered')
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
      body: JSON.stringify({ email: 'new@test.com', name: 'New User', password: 'password123', organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.token).toBe('jwt-token-123')
    expect(body.user).toBeDefined()
    expect(body.organization).toBeDefined()
    expect(mockHashPassword).toHaveBeenCalledWith('password123')
  })

  it('should default business type to retail when invalid type provided', async () => {
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
      body: JSON.stringify({ email: 'new@test.com', name: 'New User', password: 'password123', organizationName: 'Test Org', businessType: 'invalid' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    expect(mockOrgCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessType: 'retail' }),
      })
    )
  })

  it('should handle existing user without passwordHash (Supabase migration)', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      passwordHash: '',
      name: 'Existing',
    })
    mockHashPassword.mockResolvedValue('newhash')
    mockUserUpdate.mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Updated' })
    mockMemberFindFirst.mockResolvedValue(null)
    mockOrgFindUnique.mockResolvedValue(null)
    mockOrgCreate.mockResolvedValue({ id: 'org-1', name: 'Test Org', slug: 'test-org-abc', businessType: 'retail', city: null })
    mockMemberCreate.mockResolvedValue({ id: 'mem-1' })
    mockShopCreate.mockResolvedValue({ id: 'shop-1' })
    mockShopMemberCreate.mockResolvedValue({ id: 'sm-1' })
    mockModuleFindMany.mockResolvedValue([])
    mockGenerateToken.mockReturnValue('jwt-token-123')

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', name: 'Updated Name', password: 'password123', organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    expect(mockHashPassword).toHaveBeenCalledWith('password123')
    expect(mockUserUpdate).toHaveBeenCalled()
  })

  it('should return 500 on internal server error', async () => {
    mockUserFindUnique.mockRejectedValue(new Error('Unexpected error'))

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', name: 'Test', password: 'pass123', organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Internal server error')
  })
})

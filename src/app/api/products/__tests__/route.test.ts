import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth
const mockGetUserFromRequest = vi.fn()
const mockVerifyOrgAccess = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    getUserFromRequest: (...args: any[]) => mockGetUserFromRequest(...args),
    verifyOrgAccess: (...args: any[]) => mockVerifyOrgAccess(...args),
  }
})

// Mock api-error
vi.mock('@/lib/api-error', () => ({
  isDatabaseError: (err: unknown) => {
    if (err instanceof Error) {
      return err.message.includes('connect') || err.message.includes('ECONNREFUSED')
    }
    return false
  },
}))

// Mock module-guard
const mockRequireModule = vi.fn()
vi.mock('@/lib/module-guard', () => ({
  requireModule: (...args: any[]) => mockRequireModule(...args),
}))

// Mock sanitize
vi.mock('@/lib/sanitize', async (importOriginal) => {
  const actual = await importOriginal() as any
  return { ...actual }
})

// Mock db
const mockProductFindMany = vi.fn()
const mockProductCount = vi.fn()
const mockProductCreate = vi.fn()
const mockProductTypeFindFirst = vi.fn()
const mockTransaction = vi.fn()

vi.mock('@/lib/prisma', () => ({
  db: {
    product: {
      findMany: (...args: any[]) => mockProductFindMany(...args),
      count: (...args: any[]) => mockProductCount(...args),
      create: (...args: any[]) => mockProductCreate(...args),
    },
    productType: {
      findFirst: (...args: any[]) => mockProductTypeFindFirst(...args),
    },
    $transaction: (...args: any[]) => mockTransaction(...args),
  },
}))

import { GET, POST } from '@/app/api/products/route'

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  role: 'owner',
  memberships: [{ organizationId: 'org-1' }],
}

describe('GET /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireModule.mockResolvedValue(null) // No module error for owner/admin
  })

  it('should return 401 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/products')
    const response = await GET(request)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('should return 400 when orgId is missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/products')
    const response = await GET(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('orgId')
  })

  it('should return 403 when user does not have org access', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(false)
    const request = new Request('http://localhost/api/products?orgId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
  })

  it('should return products with pagination on success', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockProductFindMany.mockResolvedValue([
      { id: 'prod-1', name: 'Test Product', productType: { id: 'pt-1', name: 'Type 1', icon: null }, attributeValues: [] },
    ])
    mockProductCount.mockResolvedValue(1)

    const request = new Request('http://localhost/api/products?orgId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.products).toHaveLength(1)
    expect(body.pagination).toBeDefined()
    expect(body.pagination.total).toBe(1)
  })

  it('should return 503 when database is unreachable', async () => {
    mockGetUserFromRequest.mockRejectedValue(new Error('ECONNREFUSED'))
    const request = new Request('http://localhost/api/products?orgId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe('DB_UNREACHABLE')
  })
})

describe('POST /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireModule.mockResolvedValue(null)
  })

  it('should return 401 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', productTypeId: 'pt-1', name: 'Test', costPrice: 10, sellingPrice: 20 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 when required fields are missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('required')
  })

  it('should return 400 when cost price is zero or negative', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', productTypeId: 'pt-1', name: 'Test', costPrice: 0, sellingPrice: 20 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Cost price')
  })

  it('should return 400 when selling price is zero or negative', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', productTypeId: 'pt-1', name: 'Test', costPrice: 10, sellingPrice: -5 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Selling price')
  })

  it('should return 403 when user lacks org access', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(false)
    const request = new Request('http://localhost/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', productTypeId: 'pt-1', name: 'Test', costPrice: 10, sellingPrice: 20 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('should return 404 when product type is not found', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockProductTypeFindFirst.mockResolvedValue(null)

    const request = new Request('http://localhost/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', productTypeId: 'pt-missing', name: 'Test', costPrice: 10, sellingPrice: 20 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toContain('Product type not found')
  })

  it('should create a product and return 201', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockProductTypeFindFirst.mockResolvedValue({ id: 'pt-1', attributes: [] })
    mockTransaction.mockResolvedValue({
      id: 'prod-1',
      name: 'Test Product',
      productType: { id: 'pt-1', name: 'Type 1', icon: null },
      attributeValues: [],
    })

    const request = new Request('http://localhost/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', productTypeId: 'pt-1', name: 'Test Product', costPrice: 10, sellingPrice: 20 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.product).toBeDefined()
  })

  it('should return 400 for invalid JSON body', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid request body')
  })

  it('should return 400 when name contains only HTML tags after sanitization', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    // Send a name that becomes empty after HTML tag stripping
    const request = new Request('http://localhost/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', productTypeId: 'pt-1', name: '<b></b>', costPrice: 10, sellingPrice: 20 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    // After sanitization, the name is empty, so it should fail required validation
    expect(body.error).toMatch(/invalid characters|required/)
  })
})

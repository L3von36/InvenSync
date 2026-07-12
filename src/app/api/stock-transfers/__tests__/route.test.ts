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

// Mock db
const mockTransferFindMany = vi.fn()
const mockTransferCreate = vi.fn()
const mockProductFindFirst = vi.fn()
const mockShopFindMany = vi.fn()
vi.mock('@/lib/prisma', () => ({
  db: {
    stockTransfer: {
      findMany: (...args: any[]) => mockTransferFindMany(...args),
      create: (...args: any[]) => mockTransferCreate(...args),
    },
    product: {
      findFirst: (...args: any[]) => mockProductFindFirst(...args),
    },
    shop: {
      findMany: (...args: any[]) => mockShopFindMany(...args),
    },
  },
}))

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  role: 'owner',
  memberships: [{ organizationId: 'org-1' }],
}

import { GET, POST } from '@/app/api/stock-transfers/route'

describe('GET /api/stock-transfers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/stock-transfers')
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 when orgId is missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/stock-transfers')
    const response = await GET(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('orgId')
  })

  it('should return 403 when user does not have org access', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(false)
    const request = new Request('http://localhost/api/stock-transfers?orgId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(403)
  })

  it('should return transfers on success', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockTransferFindMany.mockResolvedValue([{ id: 'st-1', quantity: 10, status: 'pending' }])

    const request = new Request('http://localhost/api/stock-transfers?orgId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('transfers')
  })
})

describe('POST /api/stock-transfers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/stock-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', productId: 'p-1', fromShopId: 's-1', toShopId: 's-2', quantity: 5 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 when required fields are missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/stock-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when source and destination shops are the same', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/stock-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', productId: 'p-1', fromShopId: 's-1', toShopId: 's-1', quantity: 5 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('different')
  })

  it('should return 400 for non-positive quantity', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/stock-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', productId: 'p-1', fromShopId: 's-1', toShopId: 's-2', quantity: -1 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('positive')
  })

  it('should return 403 when user lacks org access', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(false)
    const request = new Request('http://localhost/api/stock-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', productId: 'p-1', fromShopId: 's-1', toShopId: 's-2', quantity: 5 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('should return 404 when product not found', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockProductFindFirst.mockResolvedValue(null)

    const request = new Request('http://localhost/api/stock-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', productId: 'p-1', fromShopId: 's-1', toShopId: 's-2', quantity: 5 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(404)
  })

  it('should return 400 when shops are invalid', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockProductFindFirst.mockResolvedValue({ id: 'p-1' })
    mockShopFindMany.mockResolvedValue([{ id: 's-1' }]) // Only one shop found

    const request = new Request('http://localhost/api/stock-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', productId: 'p-1', fromShopId: 's-1', toShopId: 's-2', quantity: 5 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should create a stock transfer and return 201', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockProductFindFirst.mockResolvedValue({ id: 'p-1' })
    mockShopFindMany.mockResolvedValue([{ id: 's-1' }, { id: 's-2' }])
    mockTransferCreate.mockResolvedValue({ id: 'st-1', quantity: 5, status: 'pending' })

    const request = new Request('http://localhost/api/stock-transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', productId: 'p-1', fromShopId: 's-1', toShopId: 's-2', quantity: 5 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body).toHaveProperty('transfer')
  })
})

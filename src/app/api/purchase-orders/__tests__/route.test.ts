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
const mockPOFindMany = vi.fn()
const mockPOCount = vi.fn()
const mockPOCreate = vi.fn()
const mockProductFindMany = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    purchaseOrder: {
      findMany: (...args: any[]) => mockPOFindMany(...args),
      count: (...args: any[]) => mockPOCount(...args),
      create: (...args: any[]) => mockPOCreate(...args),
    },
    product: {
      findMany: (...args: any[]) => mockProductFindMany(...args),
      fields: { lowStockThreshold: 'lowStockThreshold' },
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

import { GET, POST } from '@/app/api/purchase-orders/route'

describe('GET /api/purchase-orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/purchase-orders')
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 when orgId is missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/purchase-orders')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('should return 403 when user does not have org access', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(false)
    const request = new Request('http://localhost/api/purchase-orders?orgId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(403)
  })

  it('should return purchase orders on success', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockPOFindMany.mockResolvedValue([{ id: 'po-1', status: 'draft' }])
    mockPOCount.mockResolvedValue(1)

    const request = new Request('http://localhost/api/purchase-orders?orgId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('purchaseOrders')
    expect(body).toHaveProperty('total')
  })
})

describe('POST /api/purchase-orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', items: [{ productId: 'p-1', quantity: 10, unitCost: 5 }] }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 when orgId and items are missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when items is empty array', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', items: [] }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 403 when user lacks org access', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(false)
    const request = new Request('http://localhost/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', items: [{ productId: 'p-1', quantity: 10, unitCost: 5 }] }),
    })
    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('should return 400 when product not found', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockProductFindMany.mockResolvedValue([])

    const request = new Request('http://localhost/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', items: [{ productId: 'p-1', quantity: 10, unitCost: 5 }] }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('product')
  })

  it('should create a purchase order and return 201', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockProductFindMany.mockResolvedValue([{ id: 'p-1' }])
    mockPOCreate.mockResolvedValue({ id: 'po-1', status: 'draft', totalAmount: 50 })

    const request = new Request('http://localhost/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-1', items: [{ productId: 'p-1', quantity: 10, unitCost: 5 }] }),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body).toHaveProperty('purchaseOrder')
  })
})

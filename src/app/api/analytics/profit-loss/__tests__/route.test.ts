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
const mockSaleFindMany = vi.fn()
const mockExpenseFindMany = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    sale: {
      findMany: (...args: any[]) => mockSaleFindMany(...args),
    },
    expense: {
      findMany: (...args: any[]) => mockExpenseFindMany(...args),
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

import { GET } from '@/app/api/analytics/profit-loss/route'

describe('GET /api/analytics/profit-loss', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/analytics/profit-loss')
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 when organizationId is missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/analytics/profit-loss')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('should return 403 when user does not have org access', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(false)
    const request = new Request('http://localhost/api/analytics/profit-loss?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(403)
  })

  it('should return profit & loss data on success', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockSaleFindMany.mockResolvedValue([
      {
        total: 1000,
        discount: 50,
        tax: 100,
        saleDate: new Date('2024-01-15'),
        items: [
          { costPrice: 300, quantity: 2, total: 600, productId: 'p-1', product: { id: 'p-1', name: 'Product A', sku: 'SKU-A' } },
        ],
      },
    ])
    mockExpenseFindMany.mockResolvedValue([
      { amount: 200, category: 'rent', expenseDate: new Date('2024-01-15') },
    ])

    const request = new Request('http://localhost/api/analytics/profit-loss?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('revenue')
    expect(body).toHaveProperty('costOfGoods')
    expect(body).toHaveProperty('grossProfit')
    expect(body).toHaveProperty('grossMargin')
    expect(body).toHaveProperty('totalDiscount')
    expect(body).toHaveProperty('totalTax')
    expect(body).toHaveProperty('expenses')
    expect(body).toHaveProperty('netProfit')
    expect(body).toHaveProperty('monthlyBreakdown')
    expect(body).toHaveProperty('expenseBreakdown')
    expect(body).toHaveProperty('profitTrend')
    expect(body).toHaveProperty('topProducts')
  })

  it('should handle empty sales and expenses', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockSaleFindMany.mockResolvedValue([])
    mockExpenseFindMany.mockResolvedValue([])

    const request = new Request('http://localhost/api/analytics/profit-loss?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.revenue).toBe(0)
    expect(body.costOfGoods).toBe(0)
    expect(body.expenses).toBe(0)
    expect(body.netProfit).toBe(0)
    expect(body.grossMargin).toBe(0)
  })

  it('should use date range when provided', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockSaleFindMany.mockResolvedValue([])
    mockExpenseFindMany.mockResolvedValue([])

    const request = new Request('http://localhost/api/analytics/profit-loss?organizationId=org-1&from=2024-01-01&to=2024-12-31')
    const response = await GET(request)
    expect(response.status).toBe(200)
    // Verify that findMany was called with date filters
    expect(mockSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          saleDate: expect.any(Object),
        }),
      })
    )
  })

  it('should return 500 on database error', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockSaleFindMany.mockRejectedValue(new Error('DB error'))

    const request = new Request('http://localhost/api/analytics/profit-loss?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Internal server error')
  })
})

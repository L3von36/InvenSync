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

// Mock sanitize
vi.mock('@/lib/sanitize', async (importOriginal) => {
  const actual = await importOriginal() as any
  return { ...actual }
})

// Mock db
const mockFindMany = vi.fn()
const mockCount = vi.fn()
const mockAggregate = vi.fn()
const mockCreate = vi.fn()
vi.mock('@/lib/prisma', () => ({
  db: {
    expense: {
      findMany: (...args: any[]) => mockFindMany(...args),
      count: (...args: any[]) => mockCount(...args),
      aggregate: (...args: any[]) => mockAggregate(...args),
      create: (...args: any[]) => mockCreate(...args),
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

import { GET, POST } from '@/app/api/expenses/route'

describe('GET /api/expenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/expenses')
    const response = await GET(request)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('should return 400 when organizationId is missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/expenses')
    const response = await GET(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('organizationId')
  })

  it('should return 403 when user does not have org access', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(false)
    const request = new Request('http://localhost/api/expenses?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
  })

  it('should return expenses with pagination on success', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockFindMany.mockResolvedValueOnce([{ id: 'exp-1', amount: 100 }]) // expenses
    mockCount.mockResolvedValue(1)
    mockAggregate.mockResolvedValue({ _sum: { amount: 100 } })
    mockFindMany.mockResolvedValueOnce([]) // monthlyExpenses

    const request = new Request('http://localhost/api/expenses?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('expenses')
    expect(body).toHaveProperty('pagination')
    expect(body).toHaveProperty('summary')
    expect(body).toHaveProperty('monthlySummary')
  })

  it('should return 503 when database is unreachable', async () => {
    mockGetUserFromRequest.mockRejectedValue(new Error('ECONNREFUSED'))
    const request = new Request('http://localhost/api/expenses?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe('DB_UNREACHABLE')
  })
})

describe('POST /api/expenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', category: 'rent', amount: 1000 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 when required fields are missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('required')
  })

  it('should return 400 for invalid category', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', category: 'invalid', amount: 1000 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid category')
  })

  it('should accept all valid expense categories', async () => {
    const validCategories = ['rent', 'salary', 'utilities', 'marketing', 'supplies', 'transport', 'other']
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockCreate.mockResolvedValue({ id: 'exp-1', amount: 1000 })

    for (const category of validCategories) {
      vi.clearAllMocks()
      mockGetUserFromRequest.mockResolvedValue(mockUser)
      mockVerifyOrgAccess.mockResolvedValue(true)
      mockCreate.mockResolvedValue({ id: `exp-${category}`, amount: 1000, category })

      const request = new Request('http://localhost/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: 'org-1', category, amount: 1000 }),
      })
      const response = await POST(request)
      expect(response.status).toBe(201)
    }
  })

  it('should return 400 for non-positive amount', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', category: 'rent', amount: -100 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('positive number')
  })

  it('should return 400 for zero amount', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', category: 'rent', amount: 0 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 403 when user lacks org access', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(false)
    const request = new Request('http://localhost/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', category: 'rent', amount: 1000 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('should create an expense and return 201', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockCreate.mockResolvedValue({ id: 'exp-1', amount: 1000, category: 'rent' })

    const request = new Request('http://localhost/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', category: 'rent', amount: 1000 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body).toHaveProperty('expense')
  })

  it('should accept amount as a string and parse it', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockCreate.mockResolvedValue({ id: 'exp-1', amount: 500, category: 'supplies' })

    const request = new Request('http://localhost/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', category: 'supplies', amount: '500' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 500 }),
      })
    )
  })

  it('should return 400 for invalid JSON body', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/expenses', {
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

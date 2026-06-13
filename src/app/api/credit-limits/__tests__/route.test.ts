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
const mockFindMany = vi.fn()
const mockCount = vi.fn()
const mockAggregate = vi.fn()
const mockFindFirst = vi.fn()
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    creditLimit: {
      findMany: (...args: any[]) => mockFindMany(...args),
      count: (...args: any[]) => mockCount(...args),
      aggregate: (...args: any[]) => mockAggregate(...args),
      findUnique: (...args: any[]) => mockFindUnique(...args),
      create: (...args: any[]) => mockCreate(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
    customer: {
      findFirst: (...args: any[]) => mockFindFirst(...args),
    },
  },
}))

// Mock module-guard
const mockRequireModule = vi.fn()
vi.mock('@/lib/module-guard', () => ({
  requireModule: (...args: any[]) => mockRequireModule(...args),
}))

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  role: 'owner',
  memberships: [{ organizationId: 'org-1' }],
}

const mockAdminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  name: 'Admin',
  role: 'admin',
  memberships: [{ organizationId: 'org-1' }],
}

import { GET, POST } from '@/app/api/credit-limits/route'

describe('GET /api/credit-limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/credit-limits')
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 when organizationId is missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/credit-limits')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('should return 403 when user does not have org access', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(false)
    const request = new Request('http://localhost/api/credit-limits?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(403)
  })

  it('should return credit limits with summary on success', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockAdminUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([{ id: 'cl-1', creditLimit: 5000 }])
    mockCount.mockResolvedValue(1)
    mockAggregate.mockResolvedValue({ _sum: { creditLimit: 5000, usedCredit: 1000, availableCredit: 4000 }, _count: { isBlocked: 0 } })

    const request = new Request('http://localhost/api/credit-limits?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('creditLimits')
    expect(body).toHaveProperty('pagination')
    expect(body).toHaveProperty('summary')
    expect(body.summary).toHaveProperty('totalCreditExtended')
    expect(body.summary).toHaveProperty('totalUsed')
    expect(body.summary).toHaveProperty('totalAvailable')
  })
})

describe('POST /api/credit-limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/credit-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', customerId: 'cust-1', creditLimit: 5000 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 when organizationId is missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/credit-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: 'cust-1', creditLimit: 5000 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 when customerId is missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/credit-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', creditLimit: 5000 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 for negative creditLimit', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/credit-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', customerId: 'cust-1', creditLimit: -100 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 400 for invalid alertThreshold', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/credit-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', customerId: 'cust-1', creditLimit: 5000, alertThreshold: 2 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 403 when user lacks org access', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(false)
    const request = new Request('http://localhost/api/credit-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', customerId: 'cust-1', creditLimit: 5000 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('should return 404 when customer not found in org', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockAdminUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockFindFirst.mockResolvedValue(null)

    const request = new Request('http://localhost/api/credit-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', customerId: 'cust-1', creditLimit: 5000 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(404)
  })

  it('should create a new credit limit and return 201', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockAdminUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockFindFirst.mockResolvedValue({ id: 'cust-1', name: 'Test Customer' })
    mockFindUnique.mockResolvedValue(null) // No existing credit limit
    mockCreate.mockResolvedValue({ id: 'cl-1', creditLimit: 5000, usedCredit: 0 })

    const request = new Request('http://localhost/api/credit-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', customerId: 'cust-1', creditLimit: 5000 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body).toHaveProperty('creditLimit')
  })

  it('should update existing credit limit', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockAdminUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockFindFirst.mockResolvedValue({ id: 'cust-1', name: 'Test Customer' })
    mockFindUnique.mockResolvedValue({ id: 'cl-1', creditLimit: 3000, usedCredit: 500 })
    mockUpdate.mockResolvedValue({ id: 'cl-1', creditLimit: 5000, usedCredit: 500 })

    const request = new Request('http://localhost/api/credit-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', customerId: 'cust-1', creditLimit: 5000 }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('creditLimit')
  })
})

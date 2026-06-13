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
const mockCreate = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    scheduledReport: {
      findMany: (...args: any[]) => mockFindMany(...args),
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

import { GET, POST } from '@/app/api/scheduled-reports/route'

describe('GET /api/scheduled-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/scheduled-reports')
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 when organizationId is missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/scheduled-reports')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('should return 403 when user does not have org access', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(false)
    const request = new Request('http://localhost/api/scheduled-reports?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(403)
  })

  it('should return reports on success', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([{ id: 'r-1', name: 'Daily Sales Report' }])

    const request = new Request('http://localhost/api/scheduled-reports?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('reports')
    expect(body.reports).toHaveLength(1)
  })
})

describe('POST /api/scheduled-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/scheduled-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', name: 'Report', reportType: 'daily_sales', frequency: 'daily', deliveryMethod: 'email' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return 400 when required fields are missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/scheduled-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', name: 'Report' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('required')
  })

  it('should return 400 for invalid report type', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/scheduled-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', name: 'Report', reportType: 'invalid_type', frequency: 'daily', deliveryMethod: 'email' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid report type')
  })

  it('should return 400 for invalid frequency', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/scheduled-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', name: 'Report', reportType: 'daily_sales', frequency: 'yearly', deliveryMethod: 'email' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid frequency')
  })

  it('should return 400 for invalid delivery method', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/scheduled-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', name: 'Report', reportType: 'daily_sales', frequency: 'daily', deliveryMethod: 'sms' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid delivery method')
  })

  it('should return 403 when user lacks org access', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(false)
    const request = new Request('http://localhost/api/scheduled-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', name: 'Report', reportType: 'daily_sales', frequency: 'daily', deliveryMethod: 'email' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('should create a scheduled report and return 201', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockCreate.mockResolvedValue({ id: 'r-1', name: 'Daily Sales Report', frequency: 'daily' })

    const request = new Request('http://localhost/api/scheduled-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', name: 'Daily Sales Report', reportType: 'daily_sales', frequency: 'daily', deliveryMethod: 'email' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body).toHaveProperty('report')
  })
})

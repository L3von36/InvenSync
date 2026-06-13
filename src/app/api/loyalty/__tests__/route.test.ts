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
vi.mock('@/lib/db', () => ({
  db: {
    loyaltyAccount: {
      findMany: (...args: any[]) => mockFindMany(...args),
      count: (...args: any[]) => mockCount(...args),
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

import { GET } from '@/app/api/loyalty/route'

describe('GET /api/loyalty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/loyalty')
    const response = await GET(request)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('should return 400 when organizationId is missing', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    const request = new Request('http://localhost/api/loyalty')
    const response = await GET(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('organizationId')
  })

  it('should return 403 when user does not have org access', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(false)
    const request = new Request('http://localhost/api/loyalty?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
  })

  it('should return 403 when module is not active for non-admin user', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockRequireModule.mockResolvedValue({ status: 403, json: async () => ({ error: 'Module not active' }) })

    const request = new Request('http://localhost/api/loyalty?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(403)
  })

  it('should skip module check for admin users', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockAdminUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const request = new Request('http://localhost/api/loyalty?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(200)
    expect(mockRequireModule).not.toHaveBeenCalled()
  })

  it('should return loyalty accounts with pagination on success', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockUser)
    mockVerifyOrgAccess.mockResolvedValue(true)
    mockRequireModule.mockResolvedValue(null)
    mockFindMany.mockResolvedValue([{ id: 'la-1', points: 100 }])
    mockCount.mockResolvedValue(1)

    const request = new Request('http://localhost/api/loyalty?organizationId=org-1')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('accounts')
    expect(body).toHaveProperty('pagination')
  })
})

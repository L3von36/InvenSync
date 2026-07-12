import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth
const mockGetUserFromRequest = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    getUserFromRequest: (...args: any[]) => mockGetUserFromRequest(...args),
  }
})

// Mock db
const mockLogFindMany = vi.fn()
const mockLogCount = vi.fn()
const mockLogGroupBy = vi.fn()
const mockUserFindUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({
  db: {
    auditLog: {
      findMany: (...args: any[]) => mockLogFindMany(...args),
      count: (...args: any[]) => mockLogCount(...args),
      groupBy: (...args: any[]) => mockLogGroupBy(...args),
    },
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
    },
  },
}))

const mockAdminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  name: 'Admin',
  role: 'admin',
  memberships: [{ organizationId: 'org-1' }],
}

const mockRegularUser = {
  id: 'user-1',
  email: 'user@test.com',
  name: 'Regular',
  role: 'owner',
  memberships: [{ organizationId: 'org-1' }],
}

import { GET } from '@/app/api/admin/audit-logs/route'

describe('GET /api/admin/audit-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 403 when not authenticated', async () => {
    mockGetUserFromRequest.mockResolvedValue(null)
    const request = new Request('http://localhost/api/admin/audit-logs')
    const response = await GET(request)
    expect(response.status).toBe(403)
  })

  it('should return 403 for non-admin users', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockRegularUser)
    const request = new Request('http://localhost/api/admin/audit-logs')
    const response = await GET(request)
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toContain('Admin')
  })

  it('should return audit logs with pagination for admin users', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockAdminUser)
    mockLogFindMultiple()

    const request = new Request('http://localhost/api/admin/audit-logs')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('logs')
    expect(body).toHaveProperty('pagination')
    expect(body).toHaveProperty('summary')
    expect(body).toHaveProperty('filters')
  })

  it('should filter by action', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockAdminUser)
    mockLogFindMultiple()

    const request = new Request('http://localhost/api/admin/audit-logs?action=create')
    const response = await GET(request)
    expect(response.status).toBe(200)
  })

  it('should filter by entity', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockAdminUser)
    mockLogFindMultiple()

    const request = new Request('http://localhost/api/admin/audit-logs?entity=product')
    const response = await GET(request)
    expect(response.status).toBe(200)
  })

  it('should filter by userId', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockAdminUser)
    mockLogFindMultiple()

    const request = new Request('http://localhost/api/admin/audit-logs?userId=user-1')
    const response = await GET(request)
    expect(response.status).toBe(200)
  })

  it('should filter by date range', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockAdminUser)
    mockLogFindMultiple()

    const request = new Request('http://localhost/api/admin/audit-logs?from=2024-01-01&to=2024-12-31')
    const response = await GET(request)
    expect(response.status).toBe(200)
  })

  it('should filter by search term', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockAdminUser)
    mockLogFindMultiple()

    const request = new Request('http://localhost/api/admin/audit-logs?search=product')
    const response = await GET(request)
    expect(response.status).toBe(200)
  })

  it('should return 500 on database error', async () => {
    mockGetUserFromRequest.mockResolvedValue(mockAdminUser)
    mockLogFindMany.mockRejectedValue(new Error('DB error'))

    const request = new Request('http://localhost/api/admin/audit-logs')
    const response = await GET(request)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Internal server error')
  })
})

// Helper to set up mock return values for the multiple findMany calls
function mockLogFindMultiple() {
  mockLogFindMany
    // First call: main logs query
    .mockResolvedValueOnce([
      {
        id: 'log-1',
        action: 'create',
        entity: 'product',
        entityId: 'p-1',
        details: 'Created product',
        ipAddress: '127.0.0.1',
        userAgent: 'Chrome',
        createdAt: new Date('2024-01-15'),
        organizationId: 'org-1',
        userId: 'user-1',
        user: { id: 'user-1', name: 'User', email: 'user@test.com', role: 'owner' },
      },
    ])
    // Second call: unique actions
    .mockResolvedValueOnce([{ action: 'create' }, { action: 'update' }])
    // Third call: unique entities
    .mockResolvedValueOnce([{ entity: 'product' }, { entity: 'sale' }])

  mockLogCount
    .mockResolvedValueOnce(1)      // total logs
    .mockResolvedValueOnce(1)      // today count

  mockLogGroupBy
    .mockResolvedValueOnce([{ userId: 'user-1', _count: { userId: 5 } }]) // most active user
    .mockResolvedValueOnce([{ entity: 'product', _count: { entity: 10 } }]) // most changed entity

  mockUserFindUnique.mockResolvedValue({ name: 'Active User' })
}

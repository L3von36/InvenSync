import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth
const mockComparePassword = vi.fn()
const mockGenerateToken = vi.fn()
const mockHashPassword = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    comparePassword: (...args: any[]) => mockComparePassword(...args),
    generateToken: (...args: any[]) => mockGenerateToken(...args),
    hashPassword: (...args: any[]) => mockHashPassword(...args),
  }
})

// Mock two-factor
const mockGenerateTempToken = vi.fn()
const mockParseUserAgent = vi.fn()
vi.mock('@/lib/two-factor', () => ({
  generateTempToken: (...args: any[]) => mockGenerateTempToken(...args),
  parseUserAgent: (...args: any[]) => mockParseUserAgent(...args),
}))

// Mock db
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockDeviceFindFirst = vi.fn()
const mockDeviceCreate = vi.fn()
const mockDeviceUpdate = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
    userDevice: {
      findFirst: (...args: any[]) => mockDeviceFindFirst(...args),
      create: (...args: any[]) => mockDeviceCreate(...args),
      update: (...args: any[]) => mockDeviceUpdate(...args),
    },
  },
}))

import { POST } from '@/app/api/auth/login/route'

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockParseUserAgent.mockReturnValue({ browser: 'Chrome', os: 'Windows', deviceType: 'desktop', deviceName: 'Chrome on Windows' })
  })

  it('should return 400 when email is missing', async () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test123' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Email and password')
  })

  it('should return 400 when password is missing', async () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('should return 401 when user not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@test.com', password: 'test123' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toContain('Invalid email or password')
  })

  it('should return 401 for incorrect password', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      passwordHash: 'hashedpassword',
      twoFactorEnabled: false,
      memberships: [],
    })
    mockComparePassword.mockResolvedValue(false)

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'wrongpassword' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('should return token on successful login', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test User',
      avatarUrl: null,
      role: 'owner',
      passwordHash: 'hashedpassword',
      twoFactorEnabled: false,
      memberships: [{
        organization: { id: 'org-1', name: 'Test Org', slug: 'test-org', currency: 'ETB', country: 'ET', businessType: 'retail', city: null },
        role: 'owner',
      }],
    }
    mockFindUnique.mockResolvedValue(mockUser)
    mockComparePassword.mockResolvedValue(true)
    mockGenerateToken.mockReturnValue('jwt-token-123')
    mockDeviceFindFirst.mockResolvedValue(null)
    mockDeviceCreate.mockResolvedValue({ id: 'device-1' })

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'correctpassword' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.token).toBe('jwt-token-123')
    expect(body.user).toBeDefined()
    expect(body.organizations).toBeDefined()
  })

  it('should return requires2FA when 2FA is enabled', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test User',
      avatarUrl: null,
      role: 'owner',
      passwordHash: 'hashedpassword',
      twoFactorEnabled: true,
      memberships: [],
    }
    mockFindUnique.mockResolvedValue(mockUser)
    mockComparePassword.mockResolvedValue(true)
    mockGenerateTempToken.mockReturnValue('temp-token-123')

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'correctpassword' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.requires2FA).toBe(true)
    expect(body.tempToken).toBe('temp-token-123')
  })

  it('should auto-set password for Supabase-only user (no passwordHash)', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test User',
      avatarUrl: null,
      role: 'owner',
      passwordHash: '',
      twoFactorEnabled: false,
      memberships: [{
        organization: { id: 'org-1', name: 'Test Org', slug: 'test-org', currency: 'ETB', country: 'ET', businessType: 'retail', city: null },
        role: 'owner',
      }],
    }
    mockFindUnique.mockResolvedValue(mockUser)
    mockHashPassword.mockResolvedValue('newhashedpassword')
    mockUpdate.mockResolvedValue({ ...mockUser, passwordHash: 'newhashedpassword' })
    mockGenerateToken.mockReturnValue('jwt-token-123')
    mockDeviceFindFirst.mockResolvedValue(null)
    mockDeviceCreate.mockResolvedValue({ id: 'device-1' })

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'newpassword' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(mockHashPassword).toHaveBeenCalledWith('newpassword')
  })

  it('should return 503 when database is unreachable', async () => {
    const { DatabaseUnavailableError } = await import('@/lib/auth')
    mockFindUnique.mockRejectedValue(new DatabaseUnavailableError())

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'test123' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe('DB_UNREACHABLE')
  })
})

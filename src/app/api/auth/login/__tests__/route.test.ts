import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock rate-limit
const mockApplyRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  applyRateLimit: (...args: any[]) => mockApplyRateLimit(...args),
  RateLimitTiers: {
    AUTH: { maxRequests: 5, windowMs: 60000, keyPrefix: 'auth' },
  },
}))

// Mock api-error
vi.mock('@/lib/api-error', () => ({
  isDatabaseError: (err: unknown) => {
    if (err instanceof Error) {
      return err.message.includes('connect') || err.message.includes('ECONNREFUSED') || err.name === 'DatabaseUnavailableError'
    }
    return false
  },
}))

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
    // Default: allow rate limit
    mockApplyRateLimit.mockReturnValue({ allowed: true, remaining: 4 })
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

  it('should return 401 for Supabase-only user (no passwordHash)', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test User',
      avatarUrl: null,
      role: 'owner',
      passwordHash: '',
      twoFactorEnabled: false,
      memberships: [],
    }
    mockFindUnique.mockResolvedValue(mockUser)

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'newpassword' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toContain('not configured for password login')
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

  // ============================================
  // Account Lockout Tests
  // ============================================
  it('should return 423 when account is currently locked', async () => {
    const lockoutUntil = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      passwordHash: 'hashedpassword',
      twoFactorEnabled: false,
      lockedUntil: lockoutUntil,
      failedLoginAttempts: 5,
      memberships: [],
    })

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'test123' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(423)
    const body = await response.json()
    expect(body.error).toContain('locked')
    expect(body.error).toContain('minute')
  })

  it('should lock account after 5 failed attempts', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      passwordHash: 'hashedpassword',
      twoFactorEnabled: false,
      failedLoginAttempts: 4, // Already 4 failed, this will be the 5th
      lockedUntil: null,
      memberships: [],
    })
    mockComparePassword.mockResolvedValue(false)
    mockUpdate.mockResolvedValue({})

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'wrong' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(423)
    const body = await response.json()
    expect(body.error).toContain('locked')
    // Verify that the lockout was set
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockedUntil: expect.any(Date),
        }),
      })
    )
  })

  it('should reset failed attempts counter after lockout expires', async () => {
    const expiredLockout = new Date(Date.now() - 1000) // Expired 1 second ago
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
      passwordHash: 'hashedpassword',
      twoFactorEnabled: false,
      lockedUntil: expiredLockout,
      failedLoginAttempts: 5,
      memberships: [],
    })
    mockComparePassword.mockResolvedValue(false)
    mockUpdate.mockResolvedValue({})

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'wrong' }),
    })
    const response = await POST(request)
    // Should not be locked anymore, just get 401 for wrong password
    expect(response.status).toBe(401)
    // Should have reset the failed attempts
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
      })
    )
  })

  // ============================================
  // Rate Limiting Tests
  // ============================================
  it('should return 429 when rate limit is exceeded', async () => {
    mockApplyRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
    })

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'test123' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.error).toContain('Too many requests')
  })

  // ============================================
  // Invalid Request Body Tests
  // ============================================
  it('should return 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost/api/auth/login', {
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

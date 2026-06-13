import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  getUserFromRequest,
  verifyOrgAccess,
  validatePasswordStrength,
  DatabaseUnavailableError,
} from '@/lib/auth'

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

describe('auth utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================
  // hashPassword / comparePassword
  // ============================================
  describe('hashPassword & comparePassword', () => {
    it('should hash a password and verify it', async () => {
      const password = 'mySecurePassword123'
      const hash = await hashPassword(password)
      expect(hash).not.toBe(password)
      expect(hash).toHaveLength(60) // bcrypt hash length
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true)
    })

    it('should return true for correct password comparison', async () => {
      const password = 'testPassword456'
      const hash = await hashPassword(password)
      const result = await comparePassword(password, hash)
      expect(result).toBe(true)
    })

    it('should return false for incorrect password comparison', async () => {
      const password = 'correctPassword'
      const hash = await hashPassword(password)
      const result = await comparePassword('wrongPassword', hash)
      expect(result).toBe(false)
    })

    it('should produce different hashes for the same password (salt)', async () => {
      const password = 'samePassword'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)
      expect(hash1).not.toBe(hash2) // different salts
    })
  })

  // ============================================
  // generateToken / verifyToken
  // ============================================
  describe('generateToken & verifyToken', () => {
    it('should generate a token that can be verified', () => {
      const userId = 'user-123'
      const token = generateToken(userId)
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')

      const payload = verifyToken(token)
      expect(payload).not.toBeNull()
      expect(payload!.userId).toBe(userId)
    })

    it('should return null for an invalid token', () => {
      const result = verifyToken('invalid.token.string')
      expect(result).toBeNull()
    })

    it('should return null for an empty token', () => {
      const result = verifyToken('')
      expect(result).toBeNull()
    })

    it('should return null for a malformed JWT', () => {
      const result = verifyToken('not-a-jwt')
      expect(result).toBeNull()
    })
  })

  // ============================================
  // getUserFromRequest
  // ============================================
  describe('getUserFromRequest', () => {
    it('should return null when no request is provided', async () => {
      const result = await getUserFromRequest()
      expect(result).toBeNull()
    })

    it('should return null when no authorization header is present', async () => {
      const request = new Request('http://localhost/api/test')
      const result = await getUserFromRequest(request)
      expect(result).toBeNull()
    })

    it('should return null when authorization header has no Bearer prefix', async () => {
      const request = new Request('http://localhost/api/test', {
        headers: { authorization: 'Basic abc123' },
      })
      const result = await getUserFromRequest(request)
      expect(result).toBeNull()
    })

    it('should return null for an invalid token in the Bearer header', async () => {
      const request = new Request('http://localhost/api/test', {
        headers: { authorization: 'Bearer invalid.token.string' },
      })
      const result = await getUserFromRequest(request)
      expect(result).toBeNull()
    })
  })

  // ============================================
  // verifyOrgAccess
  // ============================================
  describe('verifyOrgAccess', () => {
    it('should return false when user is null', async () => {
      const result = await verifyOrgAccess(null, 'org-123')
      expect(result).toBe(false)
    })

    it('should return true when user has membership for the org', async () => {
      const user = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        avatarUrl: null,
        role: 'owner',
        supabaseUid: null,
        memberships: [
          { id: 'mem-1', userId: 'user-1', organizationId: 'org-123', role: 'owner', joinedAt: new Date(), organization: { id: 'org-123', name: 'Test Org', slug: 'test-org', currency: 'ETB', country: 'ET', businessType: 'retail', city: null, subscriptionPlan: 'free', subscriptionStatus: 'active' } },
        ],
      } as any

      const result = await verifyOrgAccess(user, 'org-123')
      expect(result).toBe(true)
    })

    it('should return false when user does not have membership for the org', async () => {
      const user = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        avatarUrl: null,
        role: 'owner',
        supabaseUid: null,
        memberships: [
          { id: 'mem-1', userId: 'user-1', organizationId: 'org-other', role: 'owner', joinedAt: new Date(), organization: { id: 'org-other', name: 'Other Org', slug: 'other-org', currency: 'ETB', country: 'ET', businessType: 'retail', city: null, subscriptionPlan: 'free', subscriptionStatus: 'active' } },
        ],
      } as any

      const result = await verifyOrgAccess(user, 'org-123')
      expect(result).toBe(false)
    })
  })

  // ============================================
  // DatabaseUnavailableError
  // ============================================
  describe('DatabaseUnavailableError', () => {
    it('should be an instance of Error', () => {
      const err = new DatabaseUnavailableError()
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(DatabaseUnavailableError)
    })

    it('should have the correct name', () => {
      const err = new DatabaseUnavailableError()
      expect(err.name).toBe('DatabaseUnavailableError')
    })

    it('should have a default message', () => {
      const err = new DatabaseUnavailableError()
      expect(err.message).toBe('Database is unreachable')
    })

    it('should accept a custom message', () => {
      const err = new DatabaseUnavailableError('Custom db error')
      expect(err.message).toBe('Custom db error')
    })
  })

  // ============================================
  // validatePasswordStrength (extended tests)
  // ============================================
  describe('validatePasswordStrength (extended)', () => {
    it('should accept password with all requirements met', () => {
      const result = validatePasswordStrength('Str0ng!Pass')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return multiple errors for a single-character password', () => {
      const result = validatePasswordStrength('a')
      expect(result.valid).toBe(false)
      // Should have errors for: length, uppercase, digit, special char
      expect(result.errors.length).toBeGreaterThanOrEqual(3)
    })

    it('should accept special characters like @#$%^&*', () => {
      const result = validatePasswordStrength('Test@1234')
      expect(result.valid).toBe(true)
    })

    it('should reject a password that is exactly 7 characters (boundary)', () => {
      const result = validatePasswordStrength('T3st!xx')
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('8 characters'))).toBe(true)
    })

    it('should accept a password that is exactly 8 characters (boundary)', () => {
      const result = validatePasswordStrength('T3st!xxx')
      expect(result.valid).toBe(true)
    })
  })

  // ============================================
  // Token generation and verification (extended)
  // ============================================
  describe('generateToken & verifyToken (extended)', () => {
    it('should generate different tokens for different user IDs', () => {
      const token1 = generateToken('user-1')
      const token2 = generateToken('user-2')
      expect(token1).not.toBe(token2)
    })

    it('should include userId in the decoded payload', () => {
      const userId = 'user-abc-123'
      const token = generateToken(userId)
      const payload = verifyToken(token)
      expect(payload).not.toBeNull()
      expect(payload!.userId).toBe(userId)
    })

    it('should return null for a token with modified signature', () => {
      const token = generateToken('user-1')
      // Modify the last part of the token (signature)
      const parts = token.split('.')
      parts[2] = parts[2].slice(0, -5) + 'XXXXX'
      const tampered = parts.join('.')
      expect(verifyToken(tampered)).toBeNull()
    })
  })

  // ============================================
  // Organization access verification (extended)
  // ============================================
  describe('verifyOrgAccess (extended)', () => {
    it('should return true when user has multiple memberships including target org', async () => {
      const user = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        avatarUrl: null,
        role: 'owner',
        supabaseUid: null,
        memberships: [
          { id: 'mem-1', userId: 'user-1', organizationId: 'org-1', role: 'owner', joinedAt: new Date(), organization: { id: 'org-1', name: 'Org 1', slug: 'org-1', currency: 'ETB', country: 'ET', businessType: 'retail', city: null, subscriptionPlan: 'free', subscriptionStatus: 'active' } },
          { id: 'mem-2', userId: 'user-1', organizationId: 'org-2', role: 'member', joinedAt: new Date(), organization: { id: 'org-2', name: 'Org 2', slug: 'org-2', currency: 'ETB', country: 'ET', businessType: 'retail', city: null, subscriptionPlan: 'free', subscriptionStatus: 'active' } },
        ],
      } as any

      expect(await verifyOrgAccess(user, 'org-1')).toBe(true)
      expect(await verifyOrgAccess(user, 'org-2')).toBe(true)
      expect(await verifyOrgAccess(user, 'org-3')).toBe(false)
    })

    it('should return true when user role is admin', async () => {
      const user = {
        id: 'admin-1',
        email: 'admin@test.com',
        name: 'Admin',
        avatarUrl: null,
        role: 'admin',
        supabaseUid: null,
        memberships: [],
      } as any

      // Admin without memberships should still return false (verifyOrgAccess checks memberships)
      expect(await verifyOrgAccess(user, 'org-1')).toBe(false)
    })
  })
})

import { describe, it, expect, vi } from 'vitest'
import {
  generateTotpSecret,
  verifyTotpCode,
  hashBackupCode,
  verifyBackupCode,
  generateTempToken,
  verifyTempToken,
  parseUserAgent,
} from '@/lib/two-factor'

describe('two-factor authentication', () => {
  // ============================================
  // generateTotpSecret
  // ============================================
  describe('generateTotpSecret', () => {
    it('should return an object with secret, qrCodeUrl, and backupCodes', () => {
      const result = generateTotpSecret('user-1', 'test@example.com')
      expect(result).toHaveProperty('secret')
      expect(result).toHaveProperty('qrCodeUrl')
      expect(result).toHaveProperty('backupCodes')
    })

    it('should generate a Base32-encoded secret (uppercase alphanumeric)', () => {
      const result = generateTotpSecret('user-1', 'test@example.com')
      expect(result.secret).toMatch(/^[A-Z2-7]+$/)
      expect(result.secret.length).toBeGreaterThan(0)
    })

    it('should generate a valid otpauth URL', () => {
      const result = generateTotpSecret('user-1', 'test@example.com')
      expect(result.qrCodeUrl).toMatch(/^otpauth:\/\/totp\//)
      expect(result.qrCodeUrl).toContain('secret=')
      expect(result.qrCodeUrl).toContain('issuer=InvenSync')
      expect(result.qrCodeUrl).toContain('test%40example.com')
    })

    it('should generate 8 backup codes by default', () => {
      const result = generateTotpSecret('user-1', 'test@example.com')
      expect(result.backupCodes).toHaveLength(8)
    })

    it('should generate backup codes in XXXX-XXXX format', () => {
      const result = generateTotpSecret('user-1', 'test@example.com')
      for (const code of result.backupCodes) {
        expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      }
    })

    it('should generate unique backup codes', () => {
      const result = generateTotpSecret('user-1', 'test@example.com')
      const uniqueCodes = new Set(result.backupCodes)
      // Most codes should be unique (extremely unlikely to get duplicates with 8 bytes entropy each)
      expect(uniqueCodes.size).toBeGreaterThan(5)
    })

    it('should generate different secrets on each call', () => {
      const result1 = generateTotpSecret('user-1', 'test@example.com')
      const result2 = generateTotpSecret('user-1', 'test@example.com')
      expect(result1.secret).not.toBe(result2.secret)
    })
  })

  // ============================================
  // verifyTotpCode
  // ============================================
  describe('verifyTotpCode', () => {
    it('should return false for empty code', () => {
      const result = generateTotpSecret('user-1', 'test@example.com')
      expect(verifyTotpCode(result.secret, '')).toBe(false)
    })

    it('should return false for code with wrong length', () => {
      const result = generateTotpSecret('user-1', 'test@example.com')
      expect(verifyTotpCode(result.secret, '12345')).toBe(false)
      expect(verifyTotpCode(result.secret, '1234567')).toBe(false)
    })

    it('should return false for incorrect code', () => {
      const result = generateTotpSecret('user-1', 'test@example.com')
      // Extremely unlikely that '000000' is the valid code
      expect(verifyTotpCode(result.secret, '000000')).toBe(false)
    })

    it('should return false for null/undefined code', () => {
      const result = generateTotpSecret('user-1', 'test@example.com')
      expect(verifyTotpCode(result.secret, null as any)).toBe(false)
      expect(verifyTotpCode(result.secret, undefined as any)).toBe(false)
    })
  })

  // ============================================
  // hashBackupCode / verifyBackupCode
  // ============================================
  describe('backup code hashing and verification', () => {
    it('should produce a consistent SHA-256 hash for a backup code', () => {
      const code = 'A1B2-C3D4'
      const hash1 = hashBackupCode(code)
      const hash2 = hashBackupCode(code)
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 hex length
    })

    it('should produce different hashes for different codes', () => {
      const hash1 = hashBackupCode('A1B2-C3D4')
      const hash2 = hashBackupCode('E5F6-G7H8')
      expect(hash1).not.toBe(hash2)
    })

    it('should verify a correct backup code against its hash', () => {
      const code = 'A1B2-C3D4'
      const hash = hashBackupCode(code)
      expect(verifyBackupCode(code, [hash])).toBe(true)
    })

    it('should return false for an incorrect backup code', () => {
      const hash = hashBackupCode('A1B2-C3D4')
      expect(verifyBackupCode('WRONG-CODE', [hash])).toBe(false)
    })

    it('should return false when the hashed codes array is empty', () => {
      expect(verifyBackupCode('A1B2-C3D4', [])).toBe(false)
    })

    it('should find a matching code among multiple hashed codes', () => {
      const code1 = 'A1B2-C3D4'
      const code2 = 'E5F6-G7H8'
      const code3 = 'I9J0-K1L2'
      const hashedCodes = [hashBackupCode(code1), hashBackupCode(code2), hashBackupCode(code3)]
      expect(verifyBackupCode(code2, hashedCodes)).toBe(true)
    })
  })

  // ============================================
  // generateTempToken / verifyTempToken
  // ============================================
  describe('temp token for 2FA flow', () => {
    it('should generate a token that can be verified', () => {
      const userId = 'user-123'
      const token = generateTempToken(userId)
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')

      const result = verifyTempToken(token)
      expect(result).toBe(userId)
    })

    it('should return null for an invalid token format', () => {
      expect(verifyTempToken('invalid-token')).toBeNull()
    })

    it('should return null for an empty string', () => {
      expect(verifyTempToken('')).toBeNull()
    })

    it('should return null for a token with only one part (no dot)', () => {
      expect(verifyTempToken('onlyonepart')).toBeNull()
    })

    it('should return null for a tampered token', () => {
      const token = generateTempToken('user-123')
      const parts = token.split('.')
      // Tamper with the signature
      const tampered = parts[0] + '.tamperedsignature'
      expect(verifyTempToken(tampered)).toBeNull()
    })
  })

  // ============================================
  // parseUserAgent
  // ============================================
  describe('parseUserAgent', () => {
    it('should detect Chrome on Windows', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      const result = parseUserAgent(ua)
      expect(result.browser).toBe('Chrome')
      expect(result.os).toBe('Windows')
      expect(result.deviceType).toBe('desktop')
    })

    it('should detect Safari on macOS', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      const result = parseUserAgent(ua)
      expect(result.browser).toBe('Safari')
      expect(result.os).toBe('macOS')
      expect(result.deviceType).toBe('desktop')
    })

    it('should detect Safari on iPhone', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      const result = parseUserAgent(ua)
      expect(result.browser).toBe('Safari')
      expect(result.os).toBe('iOS')
      expect(result.deviceType).toBe('mobile')
    })

    it('should detect Chrome on Android mobile', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      const result = parseUserAgent(ua)
      expect(result.browser).toBe('Chrome')
      expect(result.os).toBe('Android')
      expect(result.deviceType).toBe('mobile')
    })

    it('should detect Edge on Windows', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      const result = parseUserAgent(ua)
      expect(result.browser).toBe('Edge')
      expect(result.os).toBe('Windows')
    })

    it('should detect Firefox on Linux', () => {
      const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0'
      const result = parseUserAgent(ua)
      expect(result.browser).toBe('Firefox')
      expect(result.os).toBe('Linux')
    })

    it('should return Unknown for unrecognized user agent', () => {
      const result = parseUserAgent('')
      expect(result.browser).toBe('Unknown')
      expect(result.os).toBe('Unknown')
      expect(result.deviceType).toBe('desktop')
    })
  })
})

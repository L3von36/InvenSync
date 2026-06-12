import { describe, it, expect } from 'vitest'
import {
  validateRequired,
  validateEmail,
  validatePhone,
  validateMinLength,
  validateNumber,
  validatePositiveNumber,
  validateUrl,
  validatePassword,
  validateForm,
  getNetworkErrorMessage,
  getErrorMessage,
} from '@/lib/validation'

describe('validation utilities', () => {
  // ============================================
  // validateRequired
  // ============================================
  describe('validateRequired', () => {
    it('should return null for a non-empty string', () => {
      expect(validateRequired('hello', 'Name')).toBeNull()
    })

    it('should return an error for an empty string', () => {
      const result = validateRequired('', 'Name')
      expect(result).not.toBeNull()
      expect(result!.field).toBe('Name')
      expect(result!.message).toContain('Name')
    })

    it('should return an error for whitespace-only string', () => {
      const result = validateRequired('   ', 'Name')
      expect(result).not.toBeNull()
    })

    it('should include field name in the error message', () => {
      const result = validateRequired('', 'Email')
      expect(result!.message).toContain('Email')
    })
  })

  // ============================================
  // validateEmail
  // ============================================
  describe('validateEmail', () => {
    it('should return null for a valid email', () => {
      expect(validateEmail('user@example.com')).toBeNull()
      expect(validateEmail('test+tag@domain.co')).toBeNull()
    })

    it('should return null for empty value (use validateRequired for required check)', () => {
      expect(validateEmail('')).toBeNull()
    })

    it('should return an error for invalid email formats', () => {
      expect(validateEmail('notanemail')).not.toBeNull()
      expect(validateEmail('@domain.com')).not.toBeNull()
      expect(validateEmail('user@')).not.toBeNull()
      expect(validateEmail('user@domain')).not.toBeNull()
    })

    it('should use custom field name', () => {
      const result = validateEmail('invalid', 'Work Email')
      expect(result!.field).toBe('Work Email')
    })
  })

  // ============================================
  // validatePhone
  // ============================================
  describe('validatePhone', () => {
    it('should return null for valid Ethiopian phone numbers', () => {
      expect(validatePhone('+251912345678')).toBeNull()
      expect(validatePhone('0912345678')).toBeNull()
      expect(validatePhone('251912345678')).toBeNull()
    })

    it('should return null for empty value', () => {
      expect(validatePhone('')).toBeNull()
    })

    it('should return an error for invalid phone numbers', () => {
      expect(validatePhone('12345678')).not.toBeNull()
      expect(validatePhone('+1234567890')).not.toBeNull()
    })

    it('should handle phone numbers with spaces and dashes', () => {
      expect(validatePhone('+251 912 345 678')).toBeNull()
      expect(validatePhone('0912-345-678')).toBeNull()
    })

    it('should use custom field name', () => {
      const result = validatePhone('invalid', 'Mobile')
      expect(result!.field).toBe('Mobile')
    })
  })

  // ============================================
  // validateMinLength
  // ============================================
  describe('validateMinLength', () => {
    it('should return null when value meets the minimum length', () => {
      expect(validateMinLength('hello', 3, 'Name')).toBeNull()
      expect(validateMinLength('hello', 5, 'Name')).toBeNull()
    })

    it('should return an error when value is too short', () => {
      const result = validateMinLength('hi', 5, 'Name')
      expect(result).not.toBeNull()
      expect(result!.message).toContain('5')
    })

    it('should return null for empty value (use validateRequired for required check)', () => {
      expect(validateMinLength('', 5, 'Name')).toBeNull()
    })
  })

  // ============================================
  // validateNumber
  // ============================================
  describe('validateNumber', () => {
    it('should return null for valid numbers', () => {
      expect(validateNumber(42, 'Amount')).toBeNull()
      expect(validateNumber('42', 'Amount')).toBeNull()
      expect(validateNumber(3.14, 'Price')).toBeNull()
    })

    it('should return an error for NaN values', () => {
      expect(validateNumber('abc', 'Amount')).not.toBeNull()
      expect(validateNumber(NaN, 'Amount')).not.toBeNull()
    })

    it('should validate min constraint', () => {
      expect(validateNumber(5, 'Amount', { min: 10 })).not.toBeNull()
      expect(validateNumber(15, 'Amount', { min: 10 })).toBeNull()
    })

    it('should validate max constraint', () => {
      expect(validateNumber(100, 'Amount', { max: 50 })).not.toBeNull()
      expect(validateNumber(30, 'Amount', { max: 50 })).toBeNull()
    })

    it('should validate integer constraint', () => {
      expect(validateNumber(3.14, 'Quantity', { integer: true })).not.toBeNull()
      expect(validateNumber(5, 'Quantity', { integer: true })).toBeNull()
    })

    it('should combine multiple constraints', () => {
      expect(validateNumber(3.5, 'Value', { min: 1, max: 10, integer: true })).not.toBeNull()
      expect(validateNumber(5, 'Value', { min: 1, max: 10, integer: true })).toBeNull()
    })
  })

  // ============================================
  // validatePositiveNumber
  // ============================================
  describe('validatePositiveNumber', () => {
    it('should return null for zero and positive numbers', () => {
      expect(validatePositiveNumber(0, 'Amount')).toBeNull()
      expect(validatePositiveNumber(100, 'Amount')).toBeNull()
    })

    it('should return an error for negative numbers', () => {
      expect(validatePositiveNumber(-1, 'Amount')).not.toBeNull()
    })
  })

  // ============================================
  // validateUrl
  // ============================================
  describe('validateUrl', () => {
    it('should return null for valid URLs', () => {
      expect(validateUrl('https://example.com')).toBeNull()
      expect(validateUrl('http://localhost:3000')).toBeNull()
    })

    it('should return null for empty value', () => {
      expect(validateUrl('')).toBeNull()
    })

    it('should return an error for invalid URLs', () => {
      expect(validateUrl('not-a-url')).not.toBeNull()
      expect(validateUrl('just text')).not.toBeNull()
    })
  })

  // ============================================
  // validatePassword
  // ============================================
  describe('validatePassword', () => {
    it('should return null for a valid password (6+ characters)', () => {
      expect(validatePassword('password123')).toBeNull()
      expect(validatePassword('123456')).toBeNull()
    })

    it('should return an error for empty password', () => {
      const result = validatePassword('')
      expect(result).not.toBeNull()
      expect(result!.message).toContain('required')
    })

    it('should return an error for passwords shorter than 6 characters', () => {
      const result = validatePassword('12345')
      expect(result).not.toBeNull()
      expect(result!.message).toContain('6')
    })
  })

  // ============================================
  // validateForm
  // ============================================
  describe('validateForm', () => {
    it('should return valid: true when all validations pass', () => {
      const result = validateForm([
        validateRequired('John', 'Name'),
        validateEmail('john@example.com', 'Email'),
      ])
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return valid: false when any validation fails', () => {
      const result = validateForm([
        validateRequired('', 'Name'),
        validateEmail('john@example.com', 'Email'),
      ])
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
    })

    it('should collect all errors', () => {
      const result = validateForm([
        validateRequired('', 'Name'),
        validateEmail('invalid', 'Email'),
      ])
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)
    })
  })

  // ============================================
  // getNetworkErrorMessage
  // ============================================
  describe('getNetworkErrorMessage', () => {
    it('should handle Failed to fetch TypeError', () => {
      const err = new TypeError('Failed to fetch')
      const msg = getNetworkErrorMessage(err)
      expect(msg).toContain('Network error')
      expect(msg).toContain('internet connection')
    })

    it('should handle 500 server error', () => {
      const err = new Error('Request failed with status 500')
      const msg = getNetworkErrorMessage(err)
      expect(msg).toContain('Server error')
    })

    it('should handle 401 unauthorized', () => {
      const err = new Error('Request failed with status 401')
      const msg = getNetworkErrorMessage(err)
      expect(msg).toContain('session has expired')
    })

    it('should handle 403 forbidden', () => {
      const err = new Error('Request failed with status 403')
      const msg = getNetworkErrorMessage(err)
      expect(msg).toContain('permission')
    })

    it('should handle 404 not found', () => {
      const err = new Error('Request failed with status 404')
      const msg = getNetworkErrorMessage(err)
      expect(msg).toContain('not found')
    })

    it('should handle 429 rate limit', () => {
      const err = new Error('Request failed with status 429')
      const msg = getNetworkErrorMessage(err)
      expect(msg).toContain('Too many requests')
    })

    it('should pass through known user-friendly messages', () => {
      const err = new Error('Invalid email or password')
      const msg = getNetworkErrorMessage(err)
      expect(msg).toBe('Invalid email or password')
    })

    it('should sanitize technical error messages', () => {
      const err = new Error('PrismaClient known request error P2002')
      const msg = getNetworkErrorMessage(err)
      expect(msg).toBe('An unexpected error occurred. Please try again.')
    })

    it('should handle non-Error values', () => {
      const msg = getNetworkErrorMessage('string error')
      expect(msg).toBe('An unexpected error occurred. Please try again.')
    })
  })

  // ============================================
  // getErrorMessage
  // ============================================
  describe('getErrorMessage', () => {
    it('should return error message from Error instances', () => {
      const err = new Error('Something went wrong')
      expect(getErrorMessage(err)).toBe('Something went wrong')
    })

    it('should return string errors as-is', () => {
      expect(getErrorMessage('Custom error')).toBe('Custom error')
    })

    it('should return fallback for non-Error, non-string values', () => {
      expect(getErrorMessage(42)).toBe('An unexpected error occurred')
      expect(getErrorMessage(null)).toBe('An unexpected error occurred')
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred')
    })

    it('should sanitize technical error messages', () => {
      const err = new Error('PrismaClient P2002: Unique constraint failed')
      const msg = getErrorMessage(err)
      expect(msg).toBe('An unexpected error occurred')
    })

    it('should use custom fallback message', () => {
      expect(getErrorMessage(null, 'Custom fallback')).toBe('Custom fallback')
    })

    it('should pass through non-technical error messages', () => {
      const err = new Error('Invalid email or password')
      expect(getErrorMessage(err)).toBe('Invalid email or password')
    })
  })
})

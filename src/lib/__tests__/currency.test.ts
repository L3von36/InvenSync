import { describe, it, expect } from 'vitest'
import {
  convertCurrency,
  formatCurrency,
  getCurrencySymbol,
  getExchangeRate,
  SUPPORTED_CURRENCIES,
} from '@/lib/currency'

describe('currency utilities', () => {
  // ============================================
  // convertCurrency
  // ============================================
  describe('convertCurrency', () => {
    it('should return the same amount when converting between the same currency', () => {
      expect(convertCurrency(1000, 'ETB', 'ETB')).toBe(1000)
      expect(convertCurrency(500, 'USD', 'USD')).toBe(500)
    })

    it('should convert ETB to USD', () => {
      const result = convertCurrency(570, 'ETB', 'USD')
      // 570 ETB / 57 = 10 USD
      expect(result).toBeCloseTo(10, 1)
    })

    it('should convert USD to ETB', () => {
      const result = convertCurrency(10, 'USD', 'ETB')
      // 10 * 57 = 570 ETB
      expect(result).toBeCloseTo(570, 0)
    })

    it('should convert EUR to GBP through ETB base', () => {
      const result = convertCurrency(100, 'EUR', 'GBP')
      // 100 * 62 = 6200 ETB, then 6200 / 72 ≈ 86.11 GBP
      expect(result).toBeGreaterThan(0)
      expect(typeof result).toBe('number')
    })

    it('should use a custom rate when provided', () => {
      const result = convertCurrency(100, 'ETB', 'USD', 0.02)
      // 100 * 0.02 = 2
      expect(result).toBe(2)
    })

    it('should return the original amount for unknown currency codes', () => {
      const result = convertCurrency(100, 'XYZ', 'ABC')
      expect(result).toBe(100)
    })
  })

  // ============================================
  // formatCurrency
  // ============================================
  describe('formatCurrency', () => {
    it('should format ETB with Br suffix', () => {
      const result = formatCurrency(1234.56, 'ETB')
      expect(result).toContain('Br')
      expect(result).toContain('1,234.56')
    })

    it('should format USD with $ prefix', () => {
      const result = formatCurrency(1234.56, 'USD')
      expect(result).toContain('$')
      expect(result).toContain('1,234.56')
    })

    it('should format EUR with € prefix', () => {
      const result = formatCurrency(1000, 'EUR')
      expect(result).toContain('€')
    })

    it('should format GBP with £ prefix', () => {
      const result = formatCurrency(500, 'GBP')
      expect(result).toContain('£')
    })

    it('should default to ETB when no currency is specified', () => {
      const result = formatCurrency(500)
      expect(result).toContain('Br')
    })

    it('should add thousand separators', () => {
      const result = formatCurrency(1000000, 'USD')
      expect(result).toContain('1,000,000')
    })

    it('should handle zero amount', () => {
      const result = formatCurrency(0, 'ETB')
      expect(result).toContain('0.00')
    })
  })

  // ============================================
  // getCurrencySymbol
  // ============================================
  describe('getCurrencySymbol', () => {
    it('should return Br for ETB', () => {
      expect(getCurrencySymbol('ETB')).toBe('Br')
    })

    it('should return $ for USD', () => {
      expect(getCurrencySymbol('USD')).toBe('$')
    })

    it('should return € for EUR', () => {
      expect(getCurrencySymbol('EUR')).toBe('€')
    })

    it('should return £ for GBP', () => {
      expect(getCurrencySymbol('GBP')).toBe('£')
    })

    it('should return the currency code itself for unknown currencies', () => {
      expect(getCurrencySymbol('JPY')).toBe('JPY')
    })
  })

  // ============================================
  // getExchangeRate
  // ============================================
  describe('getExchangeRate', () => {
    it('should return 1 for same currency', () => {
      expect(getExchangeRate('ETB', 'ETB')).toBe(1)
      expect(getExchangeRate('USD', 'USD')).toBe(1)
    })

    it('should return the correct rate for USD to ETB', () => {
      // USD rate to ETB = 57, ETB rate to ETB = 1, so USD/ETB = 57/1 = 57
      expect(getExchangeRate('USD', 'ETB')).toBe(57)
    })

    it('should return 1 for unknown currency pairs', () => {
      expect(getExchangeRate('XYZ', 'ABC')).toBe(1)
    })

    it('should return a positive rate for all supported currency pairs', () => {
      for (const from of SUPPORTED_CURRENCIES) {
        for (const to of SUPPORTED_CURRENCIES) {
          const rate = getExchangeRate(from.code, to.code)
          expect(rate).toBeGreaterThan(0)
        }
      }
    })
  })

  // ============================================
  // SUPPORTED_CURRENCIES
  // ============================================
  describe('SUPPORTED_CURRENCIES', () => {
    it('should contain 4 currencies', () => {
      expect(SUPPORTED_CURRENCIES).toHaveLength(4)
    })

    it('should include ETB, USD, EUR, GBP', () => {
      const codes = SUPPORTED_CURRENCIES.map((c) => c.code)
      expect(codes).toContain('ETB')
      expect(codes).toContain('USD')
      expect(codes).toContain('EUR')
      expect(codes).toContain('GBP')
    })

    it('should have required properties for each currency', () => {
      for (const currency of SUPPORTED_CURRENCIES) {
        expect(currency).toHaveProperty('code')
        expect(currency).toHaveProperty('name')
        expect(currency).toHaveProperty('symbol')
        expect(currency).toHaveProperty('flag')
        expect(currency).toHaveProperty('decimalPlaces')
      }
    })
  })
})

import { describe, it, expect } from 'vitest'
import { t, en, am } from '@/lib/i18n'

describe('i18n system', () => {
  // ============================================
  // t() function with English
  // ============================================
  describe('t() with English', () => {
    it('should return English translation for nav keys', () => {
      expect(t('nav.dashboard', 'en')).toBe('Dashboard')
      expect(t('nav.products', 'en')).toBe('Products')
      expect(t('nav.sales', 'en')).toBe('Sales')
      expect(t('nav.inventory', 'en')).toBe('Inventory')
    })

    it('should return English translation for action keys', () => {
      expect(t('actions.add', 'en')).toBe('Add')
      expect(t('actions.edit', 'en')).toBe('Edit')
      expect(t('actions.delete', 'en')).toBe('Delete')
      expect(t('actions.save', 'en')).toBe('Save')
    })

    it('should return English translation for label keys', () => {
      expect(t('labels.name', 'en')).toBe('Name')
      expect(t('labels.email', 'en')).toBe('Email')
      expect(t('labels.price', 'en')).toBe('Price')
    })

    it('should return English translation for status keys', () => {
      expect(t('status.active', 'en')).toBe('Active')
      expect(t('status.pending', 'en')).toBe('Pending')
      expect(t('status.completed', 'en')).toBe('Completed')
    })

    it('should return English translation for error keys', () => {
      expect(t('errors.somethingWentWrong', 'en')).toBe('Something went wrong')
      expect(t('errors.unauthorized', 'en')).toBe('You are not authorized')
    })

    it('should return English translation for currency keys', () => {
      expect(t('currency.etb', 'en')).toBe('ETB')
      expect(t('currency.ethiopianBirr', 'en')).toBe('Ethiopian Birr')
    })

    it('should return English translation for misc keys', () => {
      expect(t('misc.welcome', 'en')).toBe('Welcome')
      expect(t('misc.noData', 'en')).toBe('No data available')
    })
  })

  // ============================================
  // t() function with Amharic
  // ============================================
  describe('t() with Amharic', () => {
    it('should return Amharic translation for nav keys', () => {
      expect(t('nav.dashboard', 'am')).toBe('ዳሽቦርድ')
      expect(t('nav.products', 'am')).toBe('ምርቶች')
      expect(t('nav.sales', 'am')).toBe('ሽያጭ')
    })

    it('should return Amharic translation for action keys', () => {
      expect(t('actions.add', 'am')).toBe('መጨመር')
      expect(t('actions.edit', 'am')).toBe('ማስተካከል')
      expect(t('actions.delete', 'am')).toBe('መሰረዝ')
    })

    it('should return Amharic translation for label keys', () => {
      expect(t('labels.name', 'am')).toBe('ስም')
      expect(t('labels.email', 'am')).toBe('ኢሜል')
    })

    it('should return Amharic translation for status keys', () => {
      expect(t('status.active', 'am')).toBe('ንቁ')
      expect(t('status.pending', 'am')).toBe('በመጠባበቅ ላይ')
    })

    it('should return Amharic translation for misc keys', () => {
      expect(t('misc.welcome', 'am')).toBe('እንኳን ደህና መጡ')
    })
  })

  // ============================================
  // Missing key fallback
  // ============================================
  describe('missing key fallback', () => {
    it('should return the key path when key does not exist', () => {
      const result = t('nav.nonExistentKey', 'en')
      expect(result).toBe('nav.nonExistentKey')
    })

    it('should return the key path for deeply nested non-existent keys', () => {
      const result = t('some.deep.nonexistent.path', 'en')
      expect(result).toBe('some.deep.nonexistent.path')
    })
  })

  // ============================================
  // Dictionary key parity
  // ============================================
  describe('dictionary key parity', () => {
    function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
      const keys: string[] = []
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          keys.push(...getKeys(value as Record<string, unknown>, fullKey))
        } else {
          keys.push(fullKey)
        }
      }
      return keys
    }

    it('should have the same keys in English and Amharic dictionaries', () => {
      const enKeys = getKeys(en as unknown as Record<string, unknown>).sort()
      const amKeys = getKeys(am as unknown as Record<string, unknown>).sort()
      expect(enKeys).toEqual(amKeys)
    })

    it('should have all top-level sections in both dictionaries', () => {
      const enSections = Object.keys(en)
      const amSections = Object.keys(am)
      expect(enSections.sort()).toEqual(amSections.sort())
    })

    it('should have matching nav keys', () => {
      const enNavKeys = Object.keys(en.nav).sort()
      const amNavKeys = Object.keys(am.nav).sort()
      expect(enNavKeys).toEqual(amNavKeys)
    })

    it('should have matching action keys', () => {
      const enActionKeys = Object.keys(en.actions).sort()
      const amActionKeys = Object.keys(am.actions).sort()
      expect(enActionKeys).toEqual(amActionKeys)
    })

    it('should have matching label keys', () => {
      const enLabelKeys = Object.keys(en.labels).sort()
      const amLabelKeys = Object.keys(am.labels).sort()
      expect(enLabelKeys).toEqual(amLabelKeys)
    })

    it('should have matching status keys', () => {
      const enStatusKeys = Object.keys(en.status).sort()
      const amStatusKeys = Object.keys(am.status).sort()
      expect(enStatusKeys).toEqual(amStatusKeys)
    })

    it('should have matching error keys', () => {
      const enErrorKeys = Object.keys(en.errors).sort()
      const amErrorKeys = Object.keys(am.errors).sort()
      expect(enErrorKeys).toEqual(amErrorKeys)
    })

    it('should have matching currency keys', () => {
      const enCurrencyKeys = Object.keys(en.currency).sort()
      const amCurrencyKeys = Object.keys(am.currency).sort()
      expect(enCurrencyKeys).toEqual(amCurrencyKeys)
    })

    it('should have matching misc keys', () => {
      const enMiscKeys = Object.keys(en.misc).sort()
      const amMiscKeys = Object.keys(am.misc).sort()
      expect(enMiscKeys).toEqual(amMiscKeys)
    })
  })
})

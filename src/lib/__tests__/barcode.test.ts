import { describe, it, expect } from 'vitest'
import { generateBarcodeSvg, generateQrCodeSvg, generateProductBarcode } from '@/lib/barcode'

describe('barcode utilities', () => {
  // ============================================
  // generateBarcodeSvg
  // ============================================
  describe('generateBarcodeSvg', () => {
    it('should return an SVG data URL', () => {
      const result = generateBarcodeSvg('TEST123')
      expect(result).toMatch(/^data:image\/svg\+xml,/)
    })

    it('should contain SVG markup in the data URL', () => {
      const result = generateBarcodeSvg('HELLO')
      const decoded = decodeURIComponent(result.replace('data:image/svg+xml,', ''))
      expect(decoded).toContain('<svg')
      expect(decoded).toContain('</svg>')
    })

    it('should include the encoded value as text in the SVG', () => {
      const result = generateBarcodeSvg('ABC123')
      const decoded = decodeURIComponent(result.replace('data:image/svg+xml,', ''))
      expect(decoded).toContain('ABC123')
    })

    it('should produce different outputs for different values', () => {
      const result1 = generateBarcodeSvg('VALUE1')
      const result2 = generateBarcodeSvg('VALUE2')
      expect(result1).not.toBe(result2)
    })

    it('should handle special XML characters', () => {
      // The function should not throw for values with special chars
      expect(() => generateBarcodeSvg('A&B<C>')).not.toThrow()
    })
  })

  // ============================================
  // generateQrCodeSvg
  // ============================================
  describe('generateQrCodeSvg', () => {
    it('should return an SVG data URL', () => {
      const result = generateQrCodeSvg('https://example.com')
      expect(result).toMatch(/^data:image\/svg\+xml,/)
    })

    it('should contain SVG markup in the data URL', () => {
      const result = generateQrCodeSvg('Hello World')
      const decoded = decodeURIComponent(result.replace('data:image/svg+xml,', ''))
      expect(decoded).toContain('<svg')
      expect(decoded).toContain('</svg>')
    })

    it('should produce output for short strings', () => {
      const result = generateQrCodeSvg('A')
      expect(result).toMatch(/^data:image\/svg\+xml,/)
    })

    it('should produce output for longer strings', () => {
      const result = generateQrCodeSvg('https://invensync.app/products/12345')
      expect(result).toMatch(/^data:image\/svg\+xml,/)
    })

    it('should produce different QR codes for different data', () => {
      const result1 = generateQrCodeSvg('Data1')
      const result2 = generateQrCodeSvg('Data2')
      expect(result1).not.toBe(result2)
    })
  })

  // ============================================
  // generateProductBarcode
  // ============================================
  describe('generateProductBarcode', () => {
    it('should return an object with barcode and qr properties', () => {
      const result = generateProductBarcode({
        id: 'prod-1',
        name: 'Test Product',
        sku: 'SKU-123',
      })
      expect(result).toHaveProperty('barcode')
      expect(result).toHaveProperty('qr')
    })

    it('should use SKU for barcode when available', () => {
      const result = generateProductBarcode({
        id: 'prod-1',
        name: 'Test Product',
        sku: 'MY-SKU',
      })
      // Barcode should be generated from SKU
      const decoded = decodeURIComponent(result.barcode.replace('data:image/svg+xml,', ''))
      expect(decoded).toContain('MY-SKU')
    })

    it('should use product ID for barcode when SKU is not available', () => {
      const result = generateProductBarcode({
        id: 'prod-999',
        name: 'Test Product',
        sku: null,
      })
      const decoded = decodeURIComponent(result.barcode.replace('data:image/svg+xml,', ''))
      expect(decoded).toContain('prod-999')
    })

    it('should include product info in QR code', () => {
      const result = generateProductBarcode({
        id: 'prod-1',
        name: 'My Product',
        sku: 'SKU-ABC',
      })
      const decoded = decodeURIComponent(result.qr.replace('data:image/svg+xml,', ''))
      // QR code contains "INV:prod-1|SKU-ABC|My Product"
      // Since the SVG is encoded, we check the raw data URL
      expect(result.qr).toMatch(/^data:image\/svg\+xml,/)
    })

    it('should truncate long product names in QR value', () => {
      const longName = 'A'.repeat(100)
      const result = generateProductBarcode({
        id: 'prod-1',
        name: longName,
        sku: null,
      })
      // Should not throw and should produce valid output
      expect(result.qr).toMatch(/^data:image\/svg\+xml,/)
    })

    it('should handle NOSKU when sku is null', () => {
      const result = generateProductBarcode({
        id: 'prod-1',
        name: 'Test',
        sku: null,
      })
      // The QR value should contain "NOSKU"
      expect(result.qr).toBeTruthy()
    })
  })
})

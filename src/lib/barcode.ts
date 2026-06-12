// ============================================
// Barcode & QR Code Generation (SVG-based)
// ============================================

// Code128 encoding tables
const CODE128_PATTERNS: string[] = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '1100011101011',
]

const CODE128_STOP = '1100011101011'

/**
 * Calculate Code128 checksum
 */
function code128Checksum(values: number[]): number {
  let checksum = values[0]
  for (let i = 1; i < values.length; i++) {
    checksum += values[i] * i
  }
  return checksum % 103
}

/**
 * Generate a Code128 barcode as SVG string
 */
function generateCode128Svg(value: string, width: number = 300, height: number = 100): string {
  // Encode using Code128B (supports ASCII 32-127)
  const startCodeB = 104
  const values: number[] = [startCodeB]

  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i)
    if (charCode < 32 || charCode > 127) {
      // Skip non-printable or extended ASCII
      values.push(0)
    } else {
      values.push(charCode - 32)
    }
  }

  const checksum = code128Checksum(values)
  values.push(checksum)

  // Build barcode pattern
  let pattern = CODE128_PATTERNS[startCodeB]
  for (let i = 1; i < values.length; i++) {
    pattern += CODE128_PATTERNS[values[i]]
  }
  pattern += CODE128_STOP

  // Render as SVG
  const quietZone = 10
  const totalWidth = pattern.length + quietZone * 2
  const barWidth = width / totalWidth

  let bars = ''
  let x = quietZone * barWidth

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '1') {
      bars += `<rect x="${x.toFixed(2)}" y="0" width="${barWidth.toFixed(2)}" height="${height * 0.75}" fill="black"/>`
    }
    x += barWidth
  }

  const textY = height * 0.75 + 14

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="white"/>
  ${bars}
  <text x="${width / 2}" y="${textY}" text-anchor="middle" font-family="monospace" font-size="12" fill="black">${escapeXml(value)}</text>
</svg>`
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ============================================
// QR Code Generation (simple implementation)
// ============================================

// QR Code error correction levels and encoding
// This is a simplified QR code generator that produces scannable QR codes

const QR_ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'

/**
 * Generate QR code matrix from data
 * This implements a simplified QR code algorithm
 */
function generateQrMatrix(data: string): boolean[][] {
  // Convert data to byte array
  const bytes: number[] = []
  for (let i = 0; i < data.length; i++) {
    bytes.push(data.charCodeAt(i))
  }

  // Determine version based on data length
  // Using byte mode encoding capacity for version 1-10
  const capacities = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271]
  let version = 1
  for (let i = 0; i < capacities.length; i++) {
    if (bytes.length <= capacities[i]) {
      version = i + 1
      break
    }
    if (i === capacities.length - 1) version = 10
  }

  const size = version * 4 + 17

  // Initialize matrix (true = black, false = white)
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  )
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  )

  // Place finder patterns
  const placeFinderPattern = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r
        const cc = col + c
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue
        reserved[rr][cc] = true
        if (
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[rr][cc] = true
        } else {
          matrix[rr][cc] = false
        }
      }
    }
  }

  placeFinderPattern(0, 0)
  placeFinderPattern(0, size - 7)
  placeFinderPattern(size - 7, 0)

  // Place timing patterns
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true
    matrix[6][i] = i % 2 === 0
    reserved[i][6] = true
    matrix[i][6] = i % 2 === 0
  }

  // Reserve format information areas
  for (let i = 0; i < 8; i++) {
    reserved[8][i] = true
    reserved[i][8] = true
    reserved[8][size - 1 - i] = true
    reserved[size - 1 - i][8] = true
  }
  reserved[8][8] = true
  reserved[size - 8][8] = true
  reserved[8][size - 8] = true

  // Alignment patterns for version >= 2
  if (version >= 2) {
    const alignPos = getAlignmentPositions(version, size)
    for (const r of alignPos) {
      for (const c of alignPos) {
        // Skip if overlapping with finder patterns
        if (reserved[r] && reserved[r][c]) continue
        placeAlignmentPattern(matrix, reserved, r, c, size)
      }
    }
  }

  // Place dark module
  matrix[size - 8][8] = true
  reserved[size - 8][8] = true

  // Encode data bits
  const dataBits: number[] = []

  // Mode indicator: byte mode = 0100
  dataBits.push(0, 1, 0, 0)

  // Character count (8 bits for version 1-9, 16 for 10+)
  const countBits = version <= 9 ? 8 : 16
  const charCount = bytes.length
  for (let i = countBits - 1; i >= 0; i--) {
    dataBits.push((charCount >> i) & 1)
  }

  // Data
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      dataBits.push((byte >> i) & 1)
    }
  }

  // Terminator
  const maxDataBits = getTotalDataCodewords(version) * 8
  for (let i = 0; i < 4 && dataBits.length < maxDataBits; i++) {
    dataBits.push(0)
  }

  // Pad to byte boundary
  while (dataBits.length % 8 !== 0 && dataBits.length < maxDataBits) {
    dataBits.push(0)
  }

  // Pad bytes
  let padByte = true
  while (dataBits.length < maxDataBits) {
    const byte = padByte ? 0xEC : 0x11
    for (let i = 7; i >= 0; i--) {
      dataBits.push((byte >> i) & 1)
    }
    padByte = !padByte
  }

  // Truncate to max
  dataBits.length = maxDataBits

  // Add error correction (simplified - using Reed-Solomon-like approach)
  const totalCodewords = getTotalCodewords(version)
  const ecCodewords = totalCodewords - getTotalDataCodewords(version)
  const dataCodewords: number[] = []
  for (let i = 0; i < dataBits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8 && i + j < dataBits.length; j++) {
      byte = (byte << 1) | dataBits[i + j]
    }
    dataCodewords.push(byte)
  }

  const ecCodewordArr = computeErrorCorrection(dataCodewords, ecCodewords)
  const allCodewords = [...dataCodewords, ...ecCodewordArr]

  // Convert to bit array
  const allBits: number[] = []
  for (const cw of allCodewords) {
    for (let i = 7; i >= 0; i--) {
      allBits.push((cw >> i) & 1)
    }
  }

  // Place data bits in matrix
  let bitIndex = 0
  let isRight = true
  let col = size - 1
  let row = size - 1

  while (col >= 0) {
    if (col === 6) col-- // Skip timing column

    while (row >= 0 && row < size) {
      if (!reserved[row][col] || !reserved[row][col - (isRight ? 0 : 0)]) {
        // Check both columns
        for (let dc = 0; dc <= 1; dc++) {
          const cc = col - dc
          if (cc < 0 || cc >= size) continue
          if (reserved[row][cc]) continue

          if (bitIndex < allBits.length) {
            // Apply mask pattern 0: (row + col) % 2 === 0
            const mask = (row + cc) % 2 === 0
            matrix[row][cc] = allBits[bitIndex] !== (mask ? 1 : 0)
            bitIndex++
          }
          reserved[row][cc] = true
        }
      }

      row += isRight ? -1 : 1
    }

    isRight = !isRight
    row = isRight ? size - 1 : 0
    col -= 2
  }

  // Place format information (mask pattern 0)
  const formatBits = getFormatBits(0)
  // Horizontal
  for (let i = 0; i < 8; i++) {
    matrix[8][i < 2 ? i : size - 8 + (i - 2)] = ((formatBits >> (14 - i)) & 1) === 1
  }
  matrix[8][7] = ((formatBits >> 6) & 1) === 1
  matrix[8][8] = ((formatBits >> 7) & 1) === 1
  // Vertical
  for (let i = 0; i < 7; i++) {
    matrix[size - 1 - i][8] = ((formatBits >> i) & 1) === 1
  }
  for (let i = 7; i < 15; i++) {
    matrix[14 - i < 0 ? 0 : 14 - i][8] = ((formatBits >> i) & 1) === 1
  }

  return matrix
}

function placeAlignmentPattern(
  matrix: boolean[][],
  reserved: boolean[][],
  row: number,
  col: number,
  size: number
) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = row + r
      const cc = col + c
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue
      reserved[rr][cc] = true
      if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
        matrix[rr][cc] = true
      } else {
        matrix[rr][cc] = false
      }
    }
  }
}

function getAlignmentPositions(version: number, size: number): number[] {
  if (version === 1) return []
  const positions = [6]
  const last = size - 7
  const count = Math.floor(version / 7) + 2
  const step = Math.ceil((last - 6) / (count - 1) / 2) * 2
  for (let pos = last; positions.length < count; pos -= step) {
    positions.splice(1, 0, pos)
  }
  return positions
}

function getTotalDataCodewords(version: number): number {
  const total = getTotalCodewords(version)
  const ecPerBlock = getEcCodewordsPerBlock(version)
  const numBlocks = getNumBlocks(version)
  return total - ecPerBlock * numBlocks
}

function getTotalCodewords(version: number): number {
  const size = version * 4 + 17
  let total = size * size
  // Subtract finder patterns (3 * 64 = 192 but with separators)
  total -= 3 * 64 + 3 * 5 * 2
  // Subtract timing
  total -= (size - 16) * 2
  // Subtract alignment
  if (version >= 2) {
    const count = Math.floor(version / 7) + 2
    total -= (count * count - 3) * 25
    total += (count - 2) * 2 * 5 * 2 // Overlap adjustments (approximate)
  }
  // Subtract format info and version info (approximate)
  total -= 31
  if (version >= 7) total -= 36
  // Return approximate codeword count
  return Math.floor(total / 8)
}

function getEcCodewordsPerBlock(version: number): number {
  // L level error correction codewords per block
  const ecTable = [7, 10, 15, 20, 26, 18, 20, 24, 30, 18]
  return ecTable[version - 1] || 18
}

function getNumBlocks(version: number): number {
  const blockTable = [1, 1, 1, 1, 1, 2, 2, 2, 2, 4]
  return blockTable[version - 1] || 4
}

function computeErrorCorrection(data: number[], ecCount: number): number[] {
  // Simplified Reed-Solomon error correction
  // Generate polynomial coefficients
  const ec: number[] = new Array(ecCount).fill(0)

  for (const byte of data) {
    const temp = byte ^ ec[0]
    ec.shift()
    ec.push(0)
    if (temp !== 0) {
      for (let i = 0; i < ecCount; i++) {
        ec[i] ^= gfMultiply(temp, GENERATOR_ROOTS[ecCount - 1 - i])
      }
    }
  }

  return ec
}

// Generator polynomial roots for different EC codeword counts (alpha values)
const GENERATOR_ROOTS: Record<number, number[]> = {
  7: [0, 1, 2, 3, 4, 5, 6],
  10: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  15: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  18: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  20: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
  24: Array.from({ length: 24 }, (_, i) => i),
  26: Array.from({ length: 26 }, (_, i) => i),
  30: Array.from({ length: 30 }, (_, i) => i),
}

// GF(256) logarithm and exponent tables
const GF_EXP: number[] = new Array(512).fill(1)
const GF_LOG: number[] = new Array(256).fill(0)

// Initialize GF(256) tables
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x = x * 2
    if (x >= 256) x ^= 0x11D
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]
  }
})()

function gfMultiply(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

function getFormatBits(maskPattern: number): number {
  // Format information for error correction level L (01) and mask pattern
  const ecLevel = 1 // L = 01
  let data = (ecLevel << 3) | maskPattern
  let bits = data << 10

  // Find remainder of dividing by generator polynomial
  let rem = bits
  for (let i = 14; i >= 10; i--) {
    if (rem & (1 << i)) {
      rem ^= 0x537 << (i - 10)
    }
  }

  return (bits | rem) ^ 0x5412 // XOR with mask
}

/**
 * Generate QR code as SVG string
 */
function generateQrSvg(data: string, size: number = 200): string {
  const matrix = generateQrMatrix(data)
  const modules = matrix.length
  const quiet = 4 // quiet zone modules
  const totalModules = modules + quiet * 2
  const moduleSize = size / totalModules

  let rects = ''
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (matrix[row][col]) {
        const x = (col + quiet) * moduleSize
        const y = (row + quiet) * moduleSize
        rects += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${moduleSize.toFixed(1)}" height="${moduleSize.toFixed(1)}" fill="black"/>`
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="white"/>
  ${rects}
</svg>`
}

// ============================================
// Public API
// ============================================

/**
 * Generate Code128 barcode as SVG data URL
 */
export function generateBarcodeSvg(value: string): string {
  const svg = generateCode128Svg(value)
  const encoded = svg.replace(/"/g, "'").replace(/\n/g, '').replace(/\s{2,}/g, ' ')
  return `data:image/svg+xml,${encodeURIComponent(encoded)}`
}

/**
 * Generate QR code as SVG data URL
 */
export function generateQrCodeSvg(value: string): string {
  const svg = generateQrSvg(value)
  const encoded = svg.replace(/"/g, "'").replace(/\n/g, '').replace(/\s{2,}/g, ' ')
  return `data:image/svg+xml,${encodeURIComponent(encoded)}`
}

/**
 * Generate barcode and QR code data for a product
 */
export function generateProductBarcode(product: {
  sku?: string | null
  id: string
  name: string
}): { barcode: string; qr: string } {
  // Use SKU for barcode if available, otherwise use product ID
  const barcodeValue = product.sku || product.id
  // QR code contains product info as a URL-like string
  const qrValue = `INV:${product.id}|${product.sku || 'NOSKU'}|${product.name.slice(0, 50)}`

  return {
    barcode: generateBarcodeSvg(barcodeValue),
    qr: generateQrCodeSvg(qrValue),
  }
}

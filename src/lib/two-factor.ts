/**
 * Two-Factor Authentication (2FA) — TOTP Implementation
 * 
 * Implements RFC 6238 (TOTP: Time-Based One-Time Password)
 * Using HMAC-SHA1, 30-second time step, 6-digit codes
 * 
 * No external OTP libraries — uses Node.js crypto module directly.
 */
import crypto from 'crypto'
import { getJwtSecret } from '@/lib/auth'

// ============================================
// Constants
// ============================================

const TOTP_PERIOD = 30 // seconds
const TOTP_DIGITS = 6
const TOTP_ALGORITHM = 'sha1'

// ============================================
// TOTP Secret Generation
// ============================================

/**
 * Generate a random TOTP secret (Base32 encoded).
 * Returns 20 bytes of entropy (160 bits) as a Base32 string.
 */
function generateSecret(): string {
  const buffer = crypto.randomBytes(20)
  return base32Encode(buffer)
}

/**
 * Generate the otpauth:// URL for authenticator apps.
 */
function generateQrCodeUrl(secret: string, email: string, issuer: string = 'InvenSync'): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedEmail = encodeURIComponent(email)
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`
}

/**
 * Generate backup codes (8 single-use codes).
 * Each code is 8 characters, alphanumeric, grouped as XXXX-XXXX.
 */
function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(4)
    const hex = bytes.toString('hex').toUpperCase()
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`)
  }
  return codes
}

/**
 * Main entry point: generate TOTP secret, QR code URL, and backup codes.
 */
export function generateTotpSecret(userId: string, email: string): {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
} {
  const secret = generateSecret()
  const qrCodeUrl = generateQrCodeUrl(secret, email)
  const backupCodes = generateBackupCodes()
  return { secret, qrCodeUrl, backupCodes }
}

// ============================================
// TOTP Verification
// ============================================

/**
 * Generate a TOTP code for a given secret and timestamp.
 * Implements the TOTP algorithm per RFC 6238.
 */
function generateTotp(secret: string, timestamp: number = Date.now()): string {
  const decodedSecret = base32Decode(secret)
  const timeStep = Math.floor(timestamp / 1000 / TOTP_PERIOD)
  const timeBuffer = Buffer.alloc(8)
  timeBuffer.writeUInt32BE(0, 0)
  timeBuffer.writeUInt32BE(timeStep, 4)

  const hmac = crypto.createHmac(TOTP_ALGORITHM, decodedSecret)
  hmac.update(timeBuffer)
  const hmacResult = hmac.digest()

  // Dynamic truncation
  const offset = hmacResult[hmacResult.length - 1] & 0x0f
  const binary =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff)

  const otp = binary % Math.pow(10, TOTP_DIGITS)
  return otp.toString().padStart(TOTP_DIGITS, '0')
}

/**
 * Verify a TOTP code against a secret.
 * Allows ±1 time step (i.e., current step, one step before, one step after)
 * to account for clock drift.
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  if (!code || code.length !== TOTP_DIGITS) return false

  const now = Date.now()
  // Check current, -1 step, and +1 step
  for (let offset = -1; offset <= 1; offset++) {
    const adjustedTime = now + offset * TOTP_PERIOD * 1000
    const expectedCode = generateTotp(secret, adjustedTime)
    if (crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expectedCode))) {
      return true
    }
  }
  return false
}

// ============================================
// Backup Code Handling
// ============================================

/**
 * Hash a backup code using SHA-256.
 * Store the hashed version in the database, never the plain code.
 */
export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

/**
 * Verify a backup code against an array of hashed backup codes.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): boolean {
  const codeHash = hashBackupCode(code)
  for (const hashedCode of hashedCodes) {
    if (hashedCode.length === codeHash.length) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(codeHash), Buffer.from(hashedCode))) {
          return true
        }
      } catch {
        // Length mismatch, continue
      }
    }
  }
  return false
}

// ============================================
// Temp Token (for 2FA login flow)
// ============================================

/**
 * Generate a short-lived temporary token for the 2FA login flow.
 * This token is returned after password verification when 2FA is enabled,
 * and is required to complete the 2FA verification step.
 * Expires in 5 minutes.
 */
export function generateTempToken(userId: string): string {
  const payload = {
    userId,
    type: '2fa-temp',
    exp: Date.now() + 5 * 60 * 1000, // 5 minutes
    rand: crypto.randomBytes(8).toString('hex'), // prevent guessing
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  // Shared, cached signing secret (production-enforced; see getJwtSecret).
  // Using a single cached secret ensures generate/verify agree within a process.
  const hmacSecret = getJwtSecret()
  const signature = crypto
    .createHmac('sha256', hmacSecret)
    .update(encoded)
    .digest('base64url')
  return `${encoded}.${signature}`
}

/**
 * Verify a temporary token for the 2FA login flow.
 * Returns the userId if valid, null otherwise.
 */
export function verifyTempToken(token: string): string | null {
  try {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return null

    // Verify signature
    const hmacSecret = process.env.JWT_SECRET || (() => {
      console.warn('[2FA] WARNING: JWT_SECRET not set. Using generated secret. Set JWT_SECRET in production!')
      return crypto.randomBytes(32).toString('hex')
    })()
    const expectedSignature = crypto
      .createHmac('sha256', hmacSecret)
      .update(encoded)
      .digest('base64url')

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null
    }

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())

    // Check type
    if (payload.type !== '2fa-temp') return null

    // Check expiration
    if (Date.now() > payload.exp) return null

    return payload.userId
  } catch {
    return null
  }
}

// ============================================
// User-Agent Parsing (for device tracking)
// ============================================

export interface ParsedUserAgent {
  browser: string
  os: string
  deviceType: string
  deviceName: string
}

/**
 * Parse a User-Agent string into browser, OS, and device type.
 * Uses simple heuristics — no external libraries.
 */
export function parseUserAgent(ua: string): ParsedUserAgent {
  let browser = 'Unknown'
  let os = 'Unknown'
  let deviceType = 'desktop'

  // Detect OS
  if (/Windows NT/i.test(ua)) {
    os = 'Windows'
  } else if (/Mac OS X/i.test(ua)) {
    os = 'macOS'
    if (/iPhone|iPad|iPod/i.test(ua)) {
      os = 'iOS'
      deviceType = /iPad/i.test(ua) ? 'tablet' : 'mobile'
    }
  } else if (/Android/i.test(ua)) {
    os = 'Android'
    deviceType = /Mobile/i.test(ua) ? 'mobile' : 'tablet'
  } else if (/Linux/i.test(ua)) {
    os = 'Linux'
  } else if (/CrOS/i.test(ua)) {
    os = 'Chrome OS'
  }

  // Detect Browser
  if (/Edg\//i.test(ua)) {
    browser = 'Edge'
  } else if (/OPR|Opera/i.test(ua)) {
    browser = 'Opera'
  } else if (/Firefox/i.test(ua)) {
    browser = 'Firefox'
  } else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) {
    browser = 'Chrome'
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari'
  }

  const deviceName = `${browser} on ${os}`

  return { browser, os, deviceType, deviceName }
}

// ============================================
// Base32 Encoding/Decoding
// ============================================

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/**
 * Encode a Buffer to a Base32 string (RFC 4648).
 */
function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31]
  }

  return output
}

/**
 * Decode a Base32 string to a Buffer (RFC 4648).
 */
function base32Decode(str: string): Buffer {
  const cleaned = str.toUpperCase().replace(/[^A-Z2-7]/g, '')
  const bytes: number[] = []
  let bits = 0
  let value = 0

  for (let i = 0; i < cleaned.length; i++) {
    const charIndex = BASE32_CHARS.indexOf(cleaned[i])
    if (charIndex === -1) continue

    value = (value << 5) | charIndex
    bits += 5

    while (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

// ============================================
// Secret encryption at rest (AES-256-GCM)
// ============================================
// Used to encrypt TOTP secrets before they are stored in the database.
// A database leak alone must not be enough to generate valid 2FA codes.
//
// Key: TOTP_ENCRYPTION_KEY — 32 bytes as 64 hex chars.
// Generate with: openssl rand -hex 32
//
// Backward compatibility: secrets written before encryption was added are
// stored as plaintext. `decryptSecret` detects the `enc:v1:` prefix and
// passes anything else through unchanged, so existing users keep working.
// Their secret is re-encrypted the next time it is written.

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const PREFIX = 'enc:v1:'

function getKey(): Buffer | null {
  const hex = process.env.TOTP_ENCRYPTION_KEY
  if (!hex) return null
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('TOTP_ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32)')
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a secret for storage. Returns `enc:v1:<iv>:<tag>:<ciphertext>`.
 * If no encryption key is configured, returns the plaintext unchanged
 * (dev environments) — production must set TOTP_ENCRYPTION_KEY.
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey()
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[crypto] TOTP_ENCRYPTION_KEY not set — storing secret unencrypted')
    }
    return plaintext
  }
  const iv = randomBytes(12) // 96-bit IV, recommended size for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return PREFIX + [iv, authTag, encrypted].map(b => b.toString('base64')).join(':')
}

/**
 * Decrypt a stored secret. Plaintext legacy values (no `enc:v1:` prefix)
 * are returned as-is so pre-encryption accounts keep working.
 */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored
  const key = getKey()
  if (!key) {
    throw new Error('TOTP_ENCRYPTION_KEY is required to decrypt stored secrets')
  }
  const [ivB64, tagB64, encB64] = stored.slice(PREFIX.length).split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const encrypted = Buffer.from(encB64, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

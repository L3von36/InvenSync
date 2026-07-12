// ============================================
// Chapa payment gateway (Ethiopian payments)
// ============================================
// Server-side helpers for the Chapa API. All functions are no-ops that
// report "not configured" when CHAPA_SECRET_KEY is unset, so the app
// runs fine without payments enabled.
//
// Env:
//   CHAPA_SECRET_KEY      — API key from the Chapa dashboard
//   CHAPA_WEBHOOK_SECRET  — secret configured for webhook HMAC signatures

import crypto from 'crypto'

const CHAPA_API_BASE = 'https://api.chapa.co/v1'

export function isChapaConfigured(): boolean {
  return !!process.env.CHAPA_SECRET_KEY
}

interface ChapaVerifyResult {
  ok: boolean
  status?: string // 'success' | 'failed' | 'pending'
  amount?: number
  currency?: string
  txRef?: string
  error?: string
}

/**
 * Verify a transaction reference against the Chapa API.
 * This is the authoritative check — never trust a client-supplied
 * payment reference without verifying it server-side.
 */
export async function verifyChapaTransaction(txRef: string): Promise<ChapaVerifyResult> {
  const secretKey = process.env.CHAPA_SECRET_KEY
  if (!secretKey) {
    return { ok: false, error: 'Chapa is not configured (CHAPA_SECRET_KEY missing)' }
  }

  try {
    const res = await fetch(
      `${CHAPA_API_BASE}/transaction/verify/${encodeURIComponent(txRef)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(10_000),
      },
    )

    const body = await res.json().catch(() => null) as {
      status?: string
      data?: { status?: string; amount?: number; currency?: string; tx_ref?: string }
      message?: string
    } | null

    if (!res.ok || !body || body.status !== 'success' || !body.data) {
      return { ok: false, error: body?.message || `Chapa verify failed (HTTP ${res.status})` }
    }

    return {
      ok: true,
      status: body.data.status,
      amount: body.data.amount,
      currency: body.data.currency,
      txRef: body.data.tx_ref,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Chapa verify request failed' }
  }
}

/**
 * Verify the HMAC-SHA256 signature on an incoming Chapa webhook.
 * Chapa signs the raw request body with the webhook secret and sends
 * the hex digest in the `x-chapa-signature` (or `chapa-signature`) header.
 */
export function verifyChapaWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.CHAPA_WEBHOOK_SECRET
  if (!secret || !signature) return false

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch — check first
  return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)
}

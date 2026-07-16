// ============================================
// Chapa payment webhook
// ============================================
// Receives payment notifications from Chapa. Three layers of protection:
//  1. HMAC-SHA256 signature check against CHAPA_WEBHOOK_SECRET
//  2. Server-side verification of the transaction with the Chapa API
//     (never trust the webhook body alone)
//  3. Idempotency via the ChapaWebhookEvent table — Chapa retries every
//     10 minutes for 72h on non-200, so duplicates are guaranteed
//
// Subscription fulfillment: the payment's meta must carry orgId + plan
// (set when the checkout is initialized). Events without meta are recorded
// but not fulfilled — visible for manual reconciliation.

import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { verifyChapaWebhookSignature, verifyChapaTransaction, isChapaConfigured } from '@/lib/chapa'
import { isDatabaseError } from '@/lib/api-error'

const VALID_PLANS = ['starter', 'growth', 'professional', 'premium']

export async function POST(request: Request) {
  if (!isChapaConfigured()) {
    return NextResponse.json({ error: 'Payments not configured' }, { status: 503 })
  }

  const rawBody = await request.text()
  const signature =
    request.headers.get('x-chapa-signature') ?? request.headers.get('chapa-signature')

  if (!verifyChapaWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: { tx_ref?: string; status?: string; meta?: { orgId?: string; plan?: string } }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const txRef = payload.tx_ref
  if (!txRef) {
    return NextResponse.json({ error: 'Missing tx_ref' }, { status: 400 })
  }

  try {
    // Idempotency gate — the unique constraint on txRef means only one
    // concurrent delivery wins the create; the rest return 200 immediately.
    try {
      await db.chapaWebhookEvent.create({
        data: { txRef, status: 'received', payload: rawBody },
      })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2002') {
        return NextResponse.json({ received: true, duplicate: true })
      }
      throw err
    }

    // Authoritative verification against the Chapa API
    const verification = await verifyChapaTransaction(txRef)
    if (!verification.ok || verification.status !== 'success') {
      await db.chapaWebhookEvent.update({
        where: { txRef },
        data: { status: 'failed' },
      })
      // 200 — the event was handled; retrying won't change the outcome
      return NextResponse.json({ received: true, fulfilled: false })
    }

    // Fulfill: activate the subscription if the payment carries org + plan
    const orgId = payload.meta?.orgId
    const plan = payload.meta?.plan
    if (orgId && plan && VALID_PLANS.includes(plan)) {
      await db.$transaction(async (tx) => {
        await tx.organization.update({
          where: { id: orgId },
          data: {
            subscriptionPlan: plan,
            subscriptionStatus: 'active',
            subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        })
        await tx.chapaWebhookEvent.update({
          where: { txRef },
          data: { status: 'fulfilled' },
        })
      })
      console.log(`[Chapa] Subscription fulfilled: org=${orgId} plan=${plan} tx=${txRef}`)
    } else {
      // Verified payment but no fulfillment target — keep as 'received'
      // for manual reconciliation in the admin panel.
      console.warn(`[Chapa] Verified payment without org/plan meta: tx=${txRef}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    if (isDatabaseError(error)) {
      // Non-200 → Chapa will retry, which is what we want for transient DB issues
      return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
    }
    console.error('[Chapa] Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

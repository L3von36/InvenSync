import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/subscriptions?orgId=xxx
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const organization = await db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Plan limits & pricing (ETB per month)
    const planLimits: Record<string, { maxProducts: number; maxUsers: number; price: number; features: string[] }> = {
      starter: { maxProducts: 50, maxUsers: 1, price: 0, features: ['Basic inventory', 'Sales tracking', 'Debt management', '50 products max'] },
      growth: { maxProducts: 500, maxUsers: 2, price: 150, features: ['Everything in Starter', 'Inventory + Sales', '500 products', '2 users', 'Debts tracking', 'Customer management'] },
      professional: { maxProducts: 2000, maxUsers: 10, price: 300, features: ['Everything in Growth', 'AI Business Assistant', 'Advanced reports & analytics', 'Telegram bot integration', '10 users', 'Supplier management'] },
      premium: { maxProducts: -1, maxUsers: -1, price: 500, features: ['Everything in Professional', 'AI Inventory Assistant', 'AI-powered insights', 'WhatsApp Business integration', 'Unlimited products & users', 'API access', 'Custom integrations', 'Priority support'] },
    }

    const currentPlan = planLimits[organization.subscriptionPlan] || planLimits.starter

    return NextResponse.json({
      subscription: organization,
      planLimits: currentPlan,
      plans: Object.entries(planLimits).map(([name, limits]) => ({
        name,
        ...limits,
      }))
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get subscription error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/subscriptions - Update plan
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { orgId, plan } = body

    if (!orgId || !plan) {
      return NextResponse.json({ error: 'orgId and plan are required' }, { status: 400 })
    }

    if (!['starter', 'growth', 'professional', 'premium'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only owner can change plan
    const membership = user.memberships.find(m => m.organizationId === orgId)
    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only organization owner can change plan' }, { status: 403 })
    }

    // TODO: Integrate with payment gateway (Chapa/Stripe)
    // For now, only allow plan changes from admin endpoint
    // Direct subscription upgrades without payment verification are blocked
    if (body.plan === 'premium' || body.plan === 'enterprise') {
      // Check if this request came from an admin or has a valid payment reference
      if (!body.paymentReference && user.role !== 'admin') {
        return NextResponse.json({ 
          error: 'Payment verification required for premium plans. Please complete payment first.' 
        }, { status: 402 })
      }
    }

    const organization = await db.organization.update({
      where: { id: orgId },
      data: {
        subscriptionPlan: plan,
        subscriptionStatus: 'active',
        subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      }
    })

    return NextResponse.json({
      subscription: {
        id: organization.id,
        name: organization.name,
        subscriptionPlan: organization.subscriptionPlan,
        subscriptionStatus: organization.subscriptionStatus,
        subscriptionExpiresAt: organization.subscriptionExpiresAt,
      }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update subscription error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

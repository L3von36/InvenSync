import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'

// Tier thresholds
const TIER_THRESHOLDS = [
  { tier: 'platinum', minPoints: 5000 },
  { tier: 'gold', minPoints: 2000 },
  { tier: 'silver', minPoints: 500 },
  { tier: 'bronze', minPoints: 0 },
]

function computeTier(points: number): string {
  for (const { tier, minPoints } of TIER_THRESHOLDS) {
    if (points >= minPoints) return tier
  }
  return 'bronze'
}

// GET /api/loyalty/[id]?organizationId=xxx
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (user.role !== 'admin') {
      const moduleError = await requireModule(organizationId, 'customers')
      if (moduleError) return moduleError
    }

    const account = await db.loyaltyAccount.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            organizationId: true,
          },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!account || account.customer.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Loyalty account not found' }, { status: 404 })
    }

    return NextResponse.json({ account })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get loyalty account error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/loyalty/[id] — Adjust points (add/deduct with reason)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { organizationId, action, points, reason } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    if (!action || !['add', 'deduct'].includes(action)) {
      return NextResponse.json({ error: 'action must be "add" or "deduct"' }, { status: 400 })
    }

    if (!points || typeof points !== 'number' || points <= 0) {
      return NextResponse.json({ error: 'points must be a positive number' }, { status: 400 })
    }

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (user.role !== 'admin') {
      const moduleError = await requireModule(organizationId, 'customers')
      if (moduleError) return moduleError
    }

    const existing = await db.loyaltyAccount.findUnique({
      where: { id },
      include: {
        customer: { select: { organizationId: true } },
      },
    })

    if (!existing || existing.customer.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Loyalty account not found' }, { status: 404 })
    }

    // For deduct, ensure we don't go below 0
    if (action === 'deduct' && existing.points < points) {
      return NextResponse.json(
        { error: `Cannot deduct ${points} points. Account only has ${existing.points} points.` },
        { status: 400 }
      )
    }

    const pointsChange = action === 'add' ? points : -points
    const newPoints = existing.points + pointsChange
    const newTotalEarned = action === 'add' ? existing.totalEarned + points : existing.totalEarned
    const newTotalRedeemed = action === 'deduct' ? existing.totalRedeemed + points : existing.totalRedeemed
    const newTier = computeTier(newPoints)

    // Update account and create transaction in a transaction
    const [updatedAccount] = await db.$transaction([
      db.loyaltyAccount.update({
        where: { id },
        data: {
          points: newPoints,
          totalEarned: newTotalEarned,
          totalRedeemed: newTotalRedeemed,
          tier: newTier,
        },
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      }),
      db.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: id,
          type: 'adjust',
          points: pointsChange,
          description: `${action === 'add' ? 'Manual add' : 'Manual deduction'}: ${reason}`,
        },
      }),
    ])

    return NextResponse.json({ account: updatedAccount })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Adjust loyalty points error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

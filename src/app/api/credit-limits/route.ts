import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/credit-limits?organizationId=xxx&search=xxx
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(organizationId, 'customers')
      if (moduleError) return moduleError
    }

    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {
      customer: { organizationId },
    }
    if (search) {
      where.customer = {
        organizationId,
        name: { contains: search },
      }
    }

    // OPTIMIZED: Run all queries in parallel instead of sequentially
    // Previously: creditLimits+count in parallel, then summaryAgg + blockedCount sequentially
    // Now: All 4 queries run in parallel
    const [creditLimits, total, summaryAgg, blockedCount] = await Promise.all([
      db.creditLimit.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.creditLimit.count({ where }),
      // Compute summary KPIs
      db.creditLimit.aggregate({
        where: {
          customer: { organizationId },
        },
        _sum: {
          creditLimit: true,
          usedCredit: true,
          availableCredit: true,
        },
        _count: {
          isBlocked: true,
        },
      }),
      db.creditLimit.count({
        where: {
          customer: { organizationId },
          isBlocked: true,
        },
      }),
    ])

    return NextResponse.json({
      creditLimits,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        totalCreditExtended: summaryAgg._sum.creditLimit || 0,
        totalUsed: summaryAgg._sum.usedCredit || 0,
        totalAvailable: summaryAgg._sum.availableCredit || 0,
        blockedAccounts: blockedCount,
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('List credit limits error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/credit-limits — Create/set credit limit for a customer
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
    const { organizationId, customerId, creditLimit, alertThreshold } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
    }

    if (creditLimit === undefined || typeof creditLimit !== 'number' || creditLimit < 0) {
      return NextResponse.json({ error: 'creditLimit must be a non-negative number' }, { status: 400 })
    }

    if (alertThreshold !== undefined && (typeof alertThreshold !== 'number' || alertThreshold < 0 || alertThreshold > 1)) {
      return NextResponse.json({ error: 'alertThreshold must be between 0 and 1' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (user.role !== 'admin') {
      const moduleError = await requireModule(organizationId, 'customers')
      if (moduleError) return moduleError
    }

    // Verify customer belongs to org
    const customer = await db.customer.findFirst({
      where: { id: customerId, organizationId },
    })
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found in this organization' }, { status: 404 })
    }

    // Check if credit limit already exists
    const existing = await db.creditLimit.findUnique({
      where: { customerId },
    })

    const threshold = alertThreshold !== undefined ? alertThreshold : 0.8
    const availableCredit = creditLimit - (existing?.usedCredit || 0)

    if (existing) {
      // Update existing credit limit
      const updated = await db.creditLimit.update({
        where: { id: existing.id },
        data: {
          creditLimit,
          availableCredit,
          alertThreshold: threshold,
        },
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      })
      return NextResponse.json({ creditLimit: updated })
    }

    // Create new credit limit
    const created = await db.creditLimit.create({
      data: {
        customerId,
        creditLimit,
        usedCredit: 0,
        availableCredit: creditLimit,
        alertThreshold: threshold,
        isBlocked: false,
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    })

    return NextResponse.json({ creditLimit: created }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Create credit limit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/credit-limits/[id]?organizationId=xxx
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

    const creditLimit = await db.creditLimit.findUnique({
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
      },
    })

    if (!creditLimit || creditLimit.customer.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Credit limit not found' }, { status: 404 })
    }

    return NextResponse.json({ creditLimit })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get credit limit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/credit-limits/[id] — Update credit limit (amount, threshold, isBlocked)
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
    const { organizationId, creditLimit: creditLimitAmount, alertThreshold, isBlocked } = body

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

    const existing = await db.creditLimit.findUnique({
      where: { id },
      include: {
        customer: { select: { organizationId: true } },
      },
    })

    if (!existing || existing.customer.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Credit limit not found' }, { status: 404 })
    }

    // Validate inputs
    if (creditLimitAmount !== undefined && (typeof creditLimitAmount !== 'number' || creditLimitAmount < 0)) {
      return NextResponse.json({ error: 'creditLimit must be a non-negative number' }, { status: 400 })
    }

    if (alertThreshold !== undefined && (typeof alertThreshold !== 'number' || alertThreshold < 0 || alertThreshold > 1)) {
      return NextResponse.json({ error: 'alertThreshold must be between 0 and 1' }, { status: 400 })
    }

    if (isBlocked !== undefined && typeof isBlocked !== 'boolean') {
      return NextResponse.json({ error: 'isBlocked must be a boolean' }, { status: 400 })
    }

    const newCreditLimit = creditLimitAmount !== undefined ? creditLimitAmount : existing.creditLimit
    const newThreshold = alertThreshold !== undefined ? alertThreshold : existing.alertThreshold
    const newIsBlocked = isBlocked !== undefined ? isBlocked : existing.isBlocked
    const newAvailableCredit = newCreditLimit - existing.usedCredit

    const updated = await db.creditLimit.update({
      where: { id },
      data: {
        creditLimit: newCreditLimit,
        alertThreshold: newThreshold,
        isBlocked: newIsBlocked,
        availableCredit: newAvailableCredit,
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    })

    return NextResponse.json({ creditLimit: updated })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update credit limit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

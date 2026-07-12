import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { recordTombstone } from '@/lib/tombstones'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/expenses/[id]?organizationId=xxx
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

    const expense = await db.expense.findFirst({
      where: { id, organizationId },
      include: {
        shop: { select: { id: true, name: true } },
      },
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    return NextResponse.json({ expense })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/expenses/[id]
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
    const { organizationId, category, amount, description, expenseDate, shopId, isRecurring, recurringPeriod } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify expense exists and belongs to org
    const existing = await db.expense.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (category !== undefined) {
      const validCategories = ['rent', 'salary', 'utilities', 'marketing', 'supplies', 'transport', 'other']
      if (!validCategories.includes(category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
      updateData.category = category
    }
    if (amount !== undefined) {
      const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
      }
      updateData.amount = parsedAmount
    }
    if (description !== undefined) updateData.description = description || null
    if (expenseDate !== undefined) updateData.expenseDate = new Date(expenseDate)
    if (shopId !== undefined) updateData.shopId = shopId || null
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring
    if (recurringPeriod !== undefined) updateData.recurringPeriod = recurringPeriod || null

    const expense = await db.expense.update({
      where: { id },
      data: updateData,
      include: {
        shop: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ expense })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/expenses/[id]
export async function PATCH(
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
    const { organizationId, category, amount, description, expenseDate, shopId, isRecurring, recurringPeriod } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify expense exists and belongs to org
    const existing = await db.expense.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (category !== undefined) {
      const validCategories = ['rent', 'salary', 'utilities', 'marketing', 'supplies', 'transport', 'other']
      if (!validCategories.includes(category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
      updateData.category = category
    }
    if (amount !== undefined) {
      const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
      }
      updateData.amount = parsedAmount
    }
    if (description !== undefined) updateData.description = description || null
    if (expenseDate !== undefined) updateData.expenseDate = new Date(expenseDate)
    if (shopId !== undefined) updateData.shopId = shopId || null
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring
    if (recurringPeriod !== undefined) updateData.recurringPeriod = recurringPeriod || null

    const expense = await db.expense.update({
      where: { id },
      data: updateData,
      include: {
        shop: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ expense })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Patch expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/expenses/[id]
export async function DELETE(
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

    // Verify expense exists and belongs to org
    const existing = await db.expense.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    await db.expense.delete({ where: { id } })

    // Tombstone so offline clients learn about this deletion on delta pull
    await recordTombstone('expenses', id, existing.organizationId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Delete expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

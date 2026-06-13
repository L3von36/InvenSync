import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'
import { sanitizeAndTruncate, validateSanitizedField } from '@/lib/sanitize'
import { broadcastNotification, NotificationTypes } from '@/lib/notification-broadcast'
import { cache, CacheNamespaces } from '@/lib/cache'

// GET /api/expenses?organizationId=xxx&category=xxx&shopId=xxx&page=1&limit=50
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

    const category = searchParams.get('category')
    const shopId = searchParams.get('shopId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: Record<string, unknown> = { organizationId }
    if (category) where.category = category
    if (shopId) where.shopId = shopId
    if (from || to) {
      where.expenseDate = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(new Date(to).setHours(23, 59, 59, 999)) } : {}),
      }
    }

    // OPTIMIZED: Run all queries in parallel instead of sequentially
    // Previously: expenses+count in parallel, then totalAmount + monthlyExpenses sequentially
    // Now: All 4 queries run in parallel
    const [expenses, total, totalAmount, monthlyExpenses] = await Promise.all([
      db.expense.findMany({
        where,
        include: {
          shop: { select: { id: true, name: true } },
        },
        orderBy: { expenseDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.expense.count({ where }),
      // Summary for KPI
      db.expense.aggregate({
        where: { organizationId },
        _sum: { amount: true },
      }),
      // Monthly expense summary for chart
      db.expense.findMany({
        where: {
          organizationId,
          expenseDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1),
          },
        },
        select: {
          amount: true,
          category: true,
          expenseDate: true,
        },
        orderBy: { expenseDate: 'asc' },
      }),
    ])

    const monthlySummary = [...monthlyExpenses.reduce((map, exp) => {
      const monthKey = exp.expenseDate.toISOString().slice(0, 7)
      const existing = map.get(monthKey) || { month: monthKey, total: 0 }
      existing.total += exp.amount
      map.set(monthKey, existing)
      return map
    }, new Map<string, { month: string; total: number }>()).values()]
      .sort((a, b) => a.month.localeCompare(b.month))

    return NextResponse.json({
      expenses,
      total,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        totalExpenses: totalAmount._sum.amount || 0,
      },
      monthlySummary,
    }, {
      headers: {
        'Cache-Control': 'private, max-age=5, stale-while-revalidate=15',
      }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('List expenses error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/expenses
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
    const { organizationId, shopId, category, amount, expenseDate, isRecurring, recurringPeriod } = body
    let { description } = body

    // Sanitize text inputs and enforce max lengths
    description = description ? sanitizeAndTruncate(description, 1000) : description

    // Validate that sanitized fields are not empty when originally provided
    const descError = validateSanitizedField(body.description, description, 'Description')
    if (descError) {
      return NextResponse.json({ error: descError }, { status: 400 })
    }

    if (!organizationId || !category || !amount) {
      return NextResponse.json(
        { error: 'organizationId, category, and amount are required' },
        { status: 400 }
      )
    }

    const validCategories = ['rent', 'salary', 'utilities', 'marketing', 'supplies', 'transport', 'other']
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const expense = await db.expense.create({
      data: {
        organizationId,
        shopId: shopId || null,
        category,
        amount: parsedAmount,
        description: description || null,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        isRecurring: isRecurring || false,
        recurringPeriod: recurringPeriod || null,
      },
      include: {
        shop: { select: { id: true, name: true } },
      },
    })

    // --- Notification triggers (fire-and-forget) ---
    // Large expense notification (if amount >= 10000)
    if (parsedAmount >= 10000) {
      void broadcastNotification({
        organizationId,
        type: NotificationTypes.LARGE_EXPENSE,
        title: 'Large Expense Recorded',
        message: `Expense of ETB ${parsedAmount} recorded for category ${category}`,
        actionUrl: '/expenses',
        metadata: { expenseId: expense.id, amount: parsedAmount, category }
      }).catch(() => {})
    }

    // Invalidate dashboard cache so fresh data is shown
    cache.invalidate(CacheNamespaces.BUSINESS_DASHBOARD)

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Create expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

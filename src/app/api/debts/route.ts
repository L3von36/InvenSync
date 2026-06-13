import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'
import { sanitizeAndTruncate, validateSanitizedField } from '@/lib/sanitize'

// GET /api/debts?orgId=xxx&status=xxx&type=xxx
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

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'debts')
      if (moduleError) return moduleError
    }

    const shopId = searchParams.get('shopId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = { organizationId: orgId }
    if (shopId) where.AND = [{ OR: [{ shopId }, { shopId: null }] }]
    if (status) where.status = status
    if (type) where.type = type

    // OPTIMIZED: Run all queries in parallel instead of sequentially
    // Previously: debts+count in parallel, then summary query sequentially
    // Now: All 3 queries run in parallel
    const summaryWhere: Record<string, unknown> = { organizationId: orgId, status: { in: ['pending', 'partial'] } }
    if (shopId) summaryWhere.AND = [{ OR: [{ shopId }, { shopId: null }] }]

    const [debts, total, customerDebtAgg, supplierDebtAgg] = await Promise.all([
      db.debt.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          supplier: { select: { id: true, name: true, phone: true } },
          payments: { orderBy: { paidAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.debt.count({ where }),
      // OPTIMIZED: Use aggregate instead of findMany+filter for customer debt summary
      db.debt.aggregate({
        where: { ...summaryWhere, type: 'customer_debt' },
        _sum: { amount: true, paidAmount: true },
      }),
      // OPTIMIZED: Use aggregate instead of findMany+filter for supplier debt summary
      db.debt.aggregate({
        where: { ...summaryWhere, type: 'supplier_debt' },
        _sum: { amount: true, paidAmount: true },
      }),
    ])

    const totalCustomerDebt = (customerDebtAgg._sum.amount || 0) - (customerDebtAgg._sum.paidAmount || 0)
    const totalSupplierDebt = (supplierDebtAgg._sum.amount || 0) - (supplierDebtAgg._sum.paidAmount || 0)

    return NextResponse.json({
      debts,
      summary: {
        totalCustomerDebt,
        totalSupplierDebt,
        totalOutstanding: totalCustomerDebt + totalSupplierDebt,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
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
    console.error('List debts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/debts
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
    const { orgId, shopId, customerId, supplierId, type, dueDate } = body
    let { description } = body

    // Ensure numeric fields are properly parsed (form may send strings)
    const amount = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount

    // Sanitize text inputs and enforce max lengths
    description = description ? sanitizeAndTruncate(description, 1000) : description

    // Validate that sanitized fields are not empty when originally provided
    const descError = validateSanitizedField(body.description, description, 'Description')
    if (descError) {
      return NextResponse.json({ error: descError }, { status: 400 })
    }

    if (!orgId || !type || !amount) {
      return NextResponse.json(
        { error: 'orgId, type, and amount are required' },
        { status: 400 }
      )
    }

    if (!['customer_debt', 'supplier_debt'].includes(type)) {
      return NextResponse.json({ error: 'Invalid debt type' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'debts')
      if (moduleError) return moduleError
    }

    const debt = await db.debt.create({
      data: {
        organizationId: orgId,
        shopId: shopId || null,
        customerId: customerId || null,
        supplierId: supplierId || null,
        type,
        amount,
        paidAmount: 0,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'pending',
        description: description || null,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        supplier: { select: { id: true, name: true, phone: true } },
      }
    })

    return NextResponse.json({ debt }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Create debt error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

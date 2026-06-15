import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/admin/sales-reps/[id]/commissions - List commissions for a sales rep (admin only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id } = await params

    // Verify sales rep exists
    const salesRep = await db.salesRep.findUnique({
      where: { id },
    })

    if (!salesRep) {
      return NextResponse.json({ error: 'Sales rep not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = { salesRepId: id }
    if (status) {
      where.status = status
    }

    const [commissions, total] = await Promise.all([
      db.salesCommission.findMany({
        where,
        include: {
          organization: {
            select: { id: true, name: true, city: true, businessType: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.salesCommission.count({ where }),
    ])

    // Calculate summary
    const allCommissions = await db.salesCommission.findMany({
      where: { salesRepId: id },
      select: { amount: true, status: true },
    })

    const summary = {
      total: allCommissions.reduce((sum, c) => sum + c.amount, 0),
      pending: allCommissions
        .filter((c) => c.status === 'pending')
        .reduce((sum, c) => sum + c.amount, 0),
      paid: allCommissions
        .filter((c) => c.status === 'paid')
        .reduce((sum, c) => sum + c.amount, 0),
      cancelled: allCommissions
        .filter((c) => c.status === 'cancelled')
        .reduce((sum, c) => sum + c.amount, 0),
    }

    return NextResponse.json({
      commissions: commissions.map((c) => ({
        id: c.id,
        salesRepId: c.salesRepId,
        organizationId: c.organizationId,
        amount: c.amount,
        status: c.status,
        paidAt: c.paidAt ? c.paidAt.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        organization: c.organization,
      })),
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin list commissions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/sales-reps/[id]/commissions - Mark commissions as paid (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id } = await params
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { commissionIds, paidAt } = body

    if (!commissionIds || !Array.isArray(commissionIds) || commissionIds.length === 0) {
      return NextResponse.json(
        { error: 'commissionIds (non-empty array) is required' },
        { status: 400 }
      )
    }

    // Verify sales rep exists
    const salesRep = await db.salesRep.findUnique({
      where: { id },
    })

    if (!salesRep) {
      return NextResponse.json({ error: 'Sales rep not found' }, { status: 404 })
    }

    // Verify all commissions belong to this sales rep
    const commissions = await db.salesCommission.findMany({
      where: {
        id: { in: commissionIds },
        salesRepId: id,
      },
    })

    if (commissions.length !== commissionIds.length) {
      const foundIds = new Set(commissions.map((c) => c.id))
      const invalidIds = commissionIds.filter((cid: string) => !foundIds.has(cid))
      return NextResponse.json(
        { error: `Some commission IDs not found or don't belong to this sales rep: ${invalidIds.join(', ')}` },
        { status: 400 }
      )
    }

    // Check for already paid commissions
    const alreadyPaid = commissions.filter((c) => c.status === 'paid')
    if (alreadyPaid.length > 0) {
      return NextResponse.json(
        { error: `Some commissions are already paid: ${alreadyPaid.map((c) => c.id).join(', ')}` },
        { status: 400 }
      )
    }

    const paidAtDate = paidAt ? new Date(paidAt) : new Date()

    // Update all commissions to paid
    await db.salesCommission.updateMany({
      where: {
        id: { in: commissionIds },
        salesRepId: id,
      },
      data: {
        status: 'paid',
        paidAt: paidAtDate,
      },
    })

    // Fetch updated commissions
    const updatedCommissions = await db.salesCommission.findMany({
      where: { id: { in: commissionIds } },
      include: {
        organization: {
          select: { id: true, name: true, city: true },
        },
      },
    })

    const totalPaidAmount = updatedCommissions.reduce((sum, c) => sum + c.amount, 0)

    return NextResponse.json({
      message: `${commissionIds.length} commission(s) marked as paid`,
      totalPaidAmount,
      paidAt: paidAtDate.toISOString(),
      commissions: updatedCommissions.map((c) => ({
        id: c.id,
        salesRepId: c.salesRepId,
        organizationId: c.organizationId,
        amount: c.amount,
        status: c.status,
        paidAt: c.paidAt ? c.paidAt.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        organization: c.organization,
      })),
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin mark commissions paid error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

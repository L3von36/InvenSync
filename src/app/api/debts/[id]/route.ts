import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'
import { broadcastNotification, NotificationTypes } from '@/lib/notification-broadcast'

// PATCH /api/debts/[id] - Update debt (add payment, update status)
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
    const { orgId, status, dueDate, description } = body

    // Ensure payment amount is properly parsed (form may send strings)
    const payment = body.payment ? {
      ...body.payment,
      amount: typeof body.payment.amount === 'string' ? parseFloat(body.payment.amount) : body.payment.amount,
    } : undefined

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

    const existing = await db.debt.findFirst({
      where: { id, organizationId: orgId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Debt not found' }, { status: 404 })
    }

    // NOTE: We avoid db.$transaction (interactive transactions) because Supabase's
    // pgbouncer connection pooler does not support them. Use sequential queries instead.

    // Track payment result for notification triggers
    let paymentMade = false
    let paidOff = false
    let paymentAmount = 0

    // If payment is provided, add a payment
    if (payment && payment.amount > 0) {
      await db.debtPayment.create({
        data: {
          debtId: id,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod || 'cash',
          notes: payment.notes || null,
        }
      })

      const newPaidAmount = existing.paidAmount + payment.amount
      let newStatus: string

      if (newPaidAmount >= existing.amount) {
        newStatus = 'paid'
        paidOff = true
      } else if (newPaidAmount > 0) {
        newStatus = 'partial'
      } else {
        newStatus = existing.status
      }

      paymentMade = true
      paymentAmount = payment.amount

      await db.debt.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        }
      })
    } else {
      // Just update fields
      await db.debt.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(description !== undefined && { description }),
        }
      })
    }

    const debt = await db.debt.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        supplier: { select: { id: true, name: true, phone: true } },
        payments: { orderBy: { paidAt: 'desc' } },
      }
    })

    // --- Notification triggers (fire-and-forget) ---
    // Debt payment received
    if (paymentMade) {
      void broadcastNotification({
        organizationId: orgId,
        type: NotificationTypes.DEBT_PAYMENT,
        title: paidOff ? 'Debt Fully Paid' : 'Debt Payment Received',
        message: paidOff
          ? `Debt of ETB ${debt?.amount} has been fully paid off`
          : `Payment of ETB ${paymentAmount} received`,
        actionUrl: '/debts',
        metadata: { debtId: id, paymentAmount, totalAmount: debt?.amount, paidAmount: debt?.paidAmount, paidOff }
      }).catch(() => {})
    }

    // Debt overdue check: if dueDate is past and status is still pending/partial
    if (debt?.dueDate && new Date(debt.dueDate) < new Date() && (debt.status === 'pending' || debt.status === 'partial')) {
      void broadcastNotification({
        organizationId: orgId,
        type: NotificationTypes.DEBT_OVERDUE,
        title: 'Debt Overdue',
        message: `Debt of ETB ${debt.amount} is overdue`,
        actionUrl: '/debts',
        metadata: { debtId: id, amount: debt.amount, paidAmount: debt.paidAmount, dueDate: debt.dueDate }
      }).catch(() => {})
    }

    return NextResponse.json({ debt })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update debt error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'

// PATCH: Update booking status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const existing = await db.serviceBooking.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const hasAccess = await verifyOrgAccess(user, existing.organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(existing.organizationId, 'services')
      if (moduleError) return moduleError
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { status } = body

    const validStatuses = ['scheduled', 'completed', 'cancelled', 'no_show']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const booking = await db.serviceBooking.update({
      where: { id },
      data: { status },
      include: {
        serviceType: { select: { id: true, name: true, duration: true, price: true } },
        customer: { select: { id: true, name: true, phone: true } },
      }
    })

    return NextResponse.json({ booking })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update service booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

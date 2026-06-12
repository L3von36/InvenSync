import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'

// GET: List bookings for an org
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'services')
      if (moduleError) return moduleError
    }

    const status = searchParams.get('status')
    const date = searchParams.get('date')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const shopId = searchParams.get('shopId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { organizationId: orgId }
    if (status) where.status = status
    // When shopId is provided, filter bookings strictly by that shop
    if (shopId) where.shopId = shopId
    if (date) {
      const dayStart = new Date(date)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      where.bookingDate = { gte: dayStart, lt: dayEnd }
    } else if (startDate && endDate) {
      where.bookingDate = { gte: new Date(startDate), lte: new Date(endDate) }
    }

    const [bookings, total] = await Promise.all([
      db.serviceBooking.findMany({
        where,
        include: {
          serviceType: { select: { id: true, name: true, duration: true, price: true } },
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { bookingDate: 'desc' },
        skip,
        take: limit,
      }),
      db.serviceBooking.count({ where })
    ])

    return NextResponse.json({
      bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get service bookings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create booking
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const {
      orgId, serviceTypeId, customerName, customerPhone,
      bookingDate, startTime, endTime, notes, customerId, shopId
    } = body

    if (!orgId || !serviceTypeId || !customerName || !bookingDate || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'orgId, serviceTypeId, customerName, bookingDate, startTime, and endTime are required' },
        { status: 400 }
      )
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'services')
      if (moduleError) return moduleError
    }

    // Verify service type belongs to org
    const serviceType = await db.serviceType.findFirst({
      where: { id: serviceTypeId, organizationId: orgId }
    })
    if (!serviceType) {
      return NextResponse.json({ error: 'Service type not found in this organization' }, { status: 404 })
    }

    // If customerId provided, verify it belongs to org
    if (customerId) {
      const customer = await db.customer.findFirst({
        where: { id: customerId, organizationId: orgId }
      })
      if (!customer) {
        return NextResponse.json({ error: 'Customer not found in this organization' }, { status: 404 })
      }
    }

    const booking = await db.serviceBooking.create({
      data: {
        organizationId: orgId,
        shopId: shopId || null,
        serviceTypeId,
        customerName,
        customerPhone: customerPhone || null,
        bookingDate: new Date(bookingDate),
        startTime,
        endTime,
        notes: notes || null,
        customerId: customerId || null,
      },
      include: {
        serviceType: { select: { id: true, name: true, duration: true, price: true } },
        customer: { select: { id: true, name: true, phone: true } },
      }
    })

    return NextResponse.json({ booking }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Create service booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

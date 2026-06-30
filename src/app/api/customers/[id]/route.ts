import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'
import { sanitizeAndTruncate, validateSanitizedField } from '@/lib/sanitize'

// GET /api/customers/[id]?orgId=xxx
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
      const moduleError = await requireModule(orgId, 'customers')
      if (moduleError) return moduleError
    }

    const customer = await db.customer.findFirst({
      where: { id, organizationId: orgId },
      include: {
        _count: { select: { sales: true, debts: true } },
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json({ customer })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get customer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/customers/[id]
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
    const { orgId } = body
    let { name, email, phone, address } = body

    // Sanitize text inputs and enforce max lengths
    if (name !== undefined) name = sanitizeAndTruncate(name, 255)
    if (email !== undefined) email = email ? sanitizeAndTruncate(email, 255) : email
    if (phone !== undefined) phone = phone ? sanitizeAndTruncate(phone, 50) : phone
    if (address !== undefined) address = address ? sanitizeAndTruncate(address, 1000) : address

    // Validate that sanitized fields are not empty when originally provided
    const nameError = validateSanitizedField(body.name, name, 'Name')
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 })
    }
    const emailError = validateSanitizedField(body.email, email, 'Email')
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 })
    }
    const phoneError = validateSanitizedField(body.phone, phone, 'Phone')
    if (phoneError) {
      return NextResponse.json({ error: phoneError }, { status: 400 })
    }
    const addressError = validateSanitizedField(body.address, address, 'Address')
    if (addressError) {
      return NextResponse.json({ error: addressError }, { status: 400 })
    }

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'customers')
      if (moduleError) return moduleError
    }

    const existing = await db.customer.findFirst({
      where: { id, organizationId: orgId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const customer = await db.customer.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
      }
    })

    return NextResponse.json({ customer })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update customer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/customers/[id]
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
      const moduleError = await requireModule(orgId, 'customers')
      if (moduleError) return moduleError
    }

    const existing = await db.customer.findFirst({
      where: { id, organizationId: orgId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    await db.customer.delete({ where: { id } })

    return NextResponse.json({ message: 'Customer deleted' })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Delete customer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

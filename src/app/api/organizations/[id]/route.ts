import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'
import { sanitizeAndTruncate, validateSanitizedField } from '@/lib/sanitize'

// GET /api/organizations/[id]
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
    const hasAccess = await verifyOrgAccess(user, id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const organization = await db.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        }
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json({ organization })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get organization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/organizations/[id]
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
    const hasAccess = await verifyOrgAccess(user, id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only owner or manager can update
    const membership = user.memberships.find(m => m.organizationId === id)
    if (!membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { currency, country, logoUrl } = body
    let { name, address, city, phone, description } = body

    // Sanitize text inputs and enforce max lengths
    if (name !== undefined) name = sanitizeAndTruncate(name, 255)
    if (address !== undefined) address = address ? sanitizeAndTruncate(address, 1000) : address
    if (city !== undefined) city = city ? sanitizeAndTruncate(city, 255) : city
    if (phone !== undefined) phone = phone ? sanitizeAndTruncate(phone, 50) : phone
    if (description !== undefined) description = description ? sanitizeAndTruncate(description, 1000) : description

    // Validate that sanitized fields are not empty when originally provided
    const nameError = validateSanitizedField(body.name, name, 'Name')
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 })
    }
    const addressError = validateSanitizedField(body.address, address, 'Address')
    if (addressError) {
      return NextResponse.json({ error: addressError }, { status: 400 })
    }
    const cityError = validateSanitizedField(body.city, city, 'City')
    if (cityError) {
      return NextResponse.json({ error: cityError }, { status: 400 })
    }
    const phoneError = validateSanitizedField(body.phone, phone, 'Phone')
    if (phoneError) {
      return NextResponse.json({ error: phoneError }, { status: 400 })
    }
    const descError = validateSanitizedField(body.description, description, 'Description')
    if (descError) {
      return NextResponse.json({ error: descError }, { status: 400 })
    }

    const organization = await db.organization.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(currency && { currency }),
        ...(country && { country }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(phone !== undefined && { phone }),
        ...(description !== undefined && { description }),
      }
    })

    return NextResponse.json({ organization })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update organization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

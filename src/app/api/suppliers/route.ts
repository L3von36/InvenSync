import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getTombstones } from '@/lib/tombstones'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'
import { sanitizeAndTruncate, validateSanitizedField } from '@/lib/sanitize'
import { isValidClientId } from '@/lib/client-id'

// GET /api/suppliers?orgId=xxx&search=xxx
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
      const moduleError = await requireModule(orgId, 'suppliers')
      if (moduleError) return moduleError
    }

    const shopId = searchParams.get('shopId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = { organizationId: orgId }
    if (shopId) where.AND = [{ OR: [{ shopId }, { shopId: null }] }]
    if (search) {
      const searchOr = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ]
      if (where.AND) {
        (where.AND as Record<string, unknown>[]).push({ OR: searchOr })
      } else {
        where.OR = searchOr
      }
    }

    // Delta sync: filter records updated since the given timestamp
    const updatedSince = searchParams.get('updatedSince')
    if (updatedSince) {
      const updatedSinceDate = new Date(updatedSince)
      if (!isNaN(updatedSinceDate.getTime())) {
        where.updatedAt = { gte: updatedSinceDate }
      }
    }

    const [suppliers, total] = await Promise.all([
      db.supplier.findMany({
        where,
        include: {
          _count: { select: { debts: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.supplier.count({ where })
    ])

    return NextResponse.json({
      suppliers: updatedSince ? [...suppliers, ...(await getTombstones('suppliers', orgId, updatedSince))] : suppliers,
      serverTime: new Date().toISOString(),
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
    console.error('List suppliers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/suppliers
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
    const { orgId, shopId } = body
    let { name, email, phone, address } = body

    // Sanitize text inputs and enforce max lengths
    name = sanitizeAndTruncate(name, 255)
    email = email ? sanitizeAndTruncate(email, 255) : email
    phone = phone ? sanitizeAndTruncate(phone, 50) : phone
    address = address ? sanitizeAndTruncate(address, 1000) : address

    // Validate required fields after sanitization
    if (!orgId || !name) {
      if (orgId && body.name && !name) {
        return NextResponse.json({ error: 'Name contains only invalid characters' }, { status: 400 })
      }
      return NextResponse.json({ error: 'orgId and name are required' }, { status: 400 })
    }

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

    // Optional client-generated ID (offline-first creates)
    const clientId = body.id
    if (clientId !== undefined && !isValidClientId(clientId)) {
      return NextResponse.json({ error: 'Invalid id format' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'suppliers')
      if (moduleError) return moduleError
    }

    // Idempotent replay: return the existing record if this ID was already created
    if (clientId) {
      const existingById = await db.supplier.findUnique({ where: { id: clientId } })
      if (existingById) {
        if (existingById.organizationId !== orgId) {
          return NextResponse.json({ error: 'ID already in use' }, { status: 409 })
        }
        return NextResponse.json({ supplier: existingById }, { status: 200 })
      }
    }

    // Check for duplicate supplier in this org
    if (email) {
      const existing = await db.supplier.findFirst({
        where: { organizationId: orgId, email }
      })
      if (existing) {
        return NextResponse.json(
          { error: 'A supplier with this email already exists' },
          { status: 409 }
        )
      }
    }

    const supplier = await db.supplier.create({
      data: {
        ...(clientId ? { id: clientId } : {}),
        organizationId: orgId,
        shopId: shopId || null,
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
      }
    })

    return NextResponse.json({ supplier }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Create supplier error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

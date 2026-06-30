import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'
import { sanitizeAndTruncate, validateSanitizedField } from '@/lib/sanitize'

// GET /api/shops?orgId=xxx - List all shops for an organization
// Owner/Manager sees all shops, Employee sees only shops they're assigned to
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

    // OPTIMIZED: Added pagination to prevent fetching all shops at once
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100') // Higher default since shops are typically few

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check user's role in the organization
    const membership = user.memberships.find(m => m.organizationId === orgId)
    const isOwnerOrManager = membership && (membership.role === 'owner' || membership.role === 'manager')

    let shops, total
    if (isOwnerOrManager) {
      // Owner/Manager sees all shops in the organization
      ;[shops, total] = await Promise.all([
        db.shop.findMany({
          where: { organizationId: orgId },
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, avatarUrl: true }
                }
              }
            },
            _count: {
              select: { products: true, sales: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.shop.count({ where: { organizationId: orgId } }),
      ])
    } else {
      // Employee sees only shops they're assigned to
      ;[shops, total] = await Promise.all([
        db.shop.findMany({
          where: {
            organizationId: orgId,
            members: {
              some: { userId: user.id }
            }
          },
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, avatarUrl: true }
                }
              }
            },
            _count: {
              select: { products: true, sales: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.shop.count({
          where: {
            organizationId: orgId,
            members: { some: { userId: user.id } }
          }
        }),
      ])
    }

    return NextResponse.json({
      shops,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
      }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('List shops error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/shops - Create a new shop
// Auto-assigns the creator as shop manager
// Only owner/manager can create shops
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
    const { orgId, latitude, longitude } = body
    let { name, address, city, phone } = body

    // Sanitize text inputs and enforce max lengths
    name = sanitizeAndTruncate(name, 255)
    address = address ? sanitizeAndTruncate(address, 1000) : address
    city = city ? sanitizeAndTruncate(city, 255) : city
    phone = phone ? sanitizeAndTruncate(phone, 50) : phone

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

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses) - required for creating shops
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'multi-shop')
      if (moduleError) return moduleError
    }

    // Only owner or manager can create shops
    const membership = user.memberships.find(m => m.organizationId === orgId)
    if (!membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
      return NextResponse.json({ error: 'Insufficient permissions. Only owners and managers can create shops.' }, { status: 403 })
    }

    // NOTE: We avoid db.$transaction (interactive transactions) because Supabase's
    // pgbouncer connection pooler does not support them. Use sequential queries instead.

    const newShop = await db.shop.create({
      data: {
        organizationId: orgId,
        name,
        address: address || null,
        city: city || null,
        latitude: latitude ? parseFloat(String(latitude)) : null,
        longitude: longitude ? parseFloat(String(longitude)) : null,
        phone: phone || null,
      }
    })

    // Auto-assign the creator as shop manager
    await db.shopMember.create({
      data: {
        userId: user.id,
        shopId: newShop.id,
        role: 'manager',
      }
    })

    // Return the shop with its members and counts
    const shop = await db.shop.findUnique({
      where: { id: newShop.id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        },
        _count: {
          select: { products: true, sales: true }
        }
      }
    })

    return NextResponse.json({ shop }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Create shop error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

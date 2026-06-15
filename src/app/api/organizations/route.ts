import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'
import { sanitizeAndTruncate, validateSanitizedField } from '@/lib/sanitize'

// GET /api/organizations - List user's orgs
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgs = user.memberships.map(m => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      logoUrl: m.organization.logoUrl,
      currency: m.organization.currency,
      country: m.organization.country,
      subscriptionPlan: m.organization.subscriptionPlan,
      subscriptionStatus: m.organization.subscriptionStatus,
      role: m.role,
      joinedAt: m.joinedAt,
    }))

    return NextResponse.json({ organizations: orgs }, {
      headers: {
        // Org list rarely changes - cache for 30 seconds
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('List organizations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/organizations - Create org
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
    const { name, currency, country } = body

    if (!name) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
    }

    // Sanitize text inputs
    const sanitizedName = sanitizeAndTruncate(name, 255)
    const nameError = validateSanitizedField(name, sanitizedName, 'Organization name')
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 })
    }

    if (!sanitizedName) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
    }

    const slug = sanitizedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now().toString(36)

    // NOTE: We avoid db.$transaction (interactive transactions) because Supabase's
    // pgbouncer connection pooler does not support them. Use sequential queries instead.

    const organization = await db.organization.create({
      data: {
        name: sanitizedName,
        slug,
        currency: currency || 'ETB',
        country: country || 'Ethiopia',
      }
    })

    await db.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: 'owner'
      }
    })

    const result = organization

    return NextResponse.json({
      organization: {
        id: result.id,
        name: result.name,
        slug: result.slug,
        currency: result.currency,
        country: result.country,
      }
    }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Create organization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

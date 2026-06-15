import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// PATCH /api/admin/organizations/[id]/suspend - Toggle org suspension (admin only)
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
    const { suspended } = body

    if (typeof suspended !== 'boolean') {
      return NextResponse.json(
        { error: 'suspended (boolean) is required' },
        { status: 400 }
      )
    }

    // Verify org exists
    const existing = await db.organization.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Set subscriptionStatus based on suspended flag
    const newStatus = suspended ? 'suspended' : 'active'

    const organization = await db.organization.update({
      where: { id },
      data: {
        subscriptionStatus: newStatus,
      },
    })

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        subscriptionPlan: organization.subscriptionPlan,
        subscriptionStatus: organization.subscriptionStatus,
        subscriptionExpiresAt: organization.subscriptionExpiresAt ? organization.subscriptionExpiresAt.toISOString() : null,
        isSuspended: organization.subscriptionStatus === 'suspended',
        createdAt: organization.createdAt.toISOString(),
        updatedAt: organization.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin suspend organization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

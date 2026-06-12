import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'

// GET: Get single service type
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const serviceType = await db.serviceType.findUnique({
      where: { id },
      include: { organization: true }
    })

    if (!serviceType) {
      return NextResponse.json({ error: 'Service type not found' }, { status: 404 })
    }

    const hasAccess = await verifyOrgAccessForServiceType(user, serviceType.organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(serviceType.organizationId, 'services')
      if (moduleError) return moduleError
    }

    return NextResponse.json({ serviceType })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get service type error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Update service type
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
    const existing = await db.serviceType.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Service type not found' }, { status: 404 })
    }

    const hasAccess = await verifyOrgAccessForServiceType(user, existing.organizationId)
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
    const { name, description, duration, price, imageUrl, isActive } = body

    const serviceType = await db.serviceType.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(duration !== undefined && { duration: parseInt(String(duration)) }),
        ...(price !== undefined && { price: parseFloat(String(price)) }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(isActive !== undefined && { isActive }),
      }
    })

    return NextResponse.json({ serviceType })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update service type error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Delete service type
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const existing = await db.serviceType.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Service type not found' }, { status: 404 })
    }

    const hasAccess = await verifyOrgAccessForServiceType(user, existing.organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(existing.organizationId, 'services')
      if (moduleError) return moduleError
    }

    await db.serviceType.delete({ where: { id } })

    return NextResponse.json({ message: 'Service type deleted' })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Delete service type error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function verifyOrgAccessForServiceType(
  user: Awaited<ReturnType<typeof getUserFromRequest>>,
  orgId: string
) {
  if (!user) return false
  return user.memberships.some(m => m.organizationId === orgId)
}

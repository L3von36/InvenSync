import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// PATCH /api/admin/modules/[id] - Update module (admin only, for dynamic pricing etc.)
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
    const { name, description, icon, category, priceETB, isFree, freeTrialDays, billingCycle, isActive, order } = body

    const existing = await db.module.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }

    const mod = await db.module.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(category !== undefined && { category }),
        ...(priceETB !== undefined && { priceETB }),
        ...(isFree !== undefined && { isFree }),
        ...(freeTrialDays !== undefined && { freeTrialDays }),
        ...(billingCycle !== undefined && { billingCycle }),
        ...(isActive !== undefined && { isActive }),
        ...(order !== undefined && { order }),
      }
    })

    return NextResponse.json({ module: mod })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin update module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/modules/[id] - Deactivate module (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.module.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }

    // Soft delete: just deactivate
    const mod = await db.module.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ module: mod })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin delete module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

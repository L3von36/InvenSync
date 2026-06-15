import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// PATCH /api/admin/sales-reps/[id] - Update sales rep details (admin only)
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
    const { commissionRate, commissionPerReg, targetCity, isActive, phone } = body

    // Verify sales rep exists
    const existingRep = await db.salesRep.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    })

    if (!existingRep) {
      return NextResponse.json({ error: 'Sales rep not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (commissionRate !== undefined) updateData.commissionRate = parseFloat(String(commissionRate))
    if (commissionPerReg !== undefined) updateData.commissionPerReg = parseFloat(String(commissionPerReg))
    if (targetCity !== undefined) updateData.targetCity = targetCity
    if (isActive !== undefined) updateData.isActive = Boolean(isActive)
    if (phone !== undefined) updateData.phone = phone

    const updatedRep = await db.salesRep.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    return NextResponse.json({
      message: 'Sales rep updated successfully',
      salesRep: {
        id: updatedRep.id,
        userId: updatedRep.userId,
        phone: updatedRep.phone,
        targetCity: updatedRep.targetCity,
        commissionRate: updatedRep.commissionRate,
        commissionPerReg: updatedRep.commissionPerReg,
        isActive: updatedRep.isActive,
        joinedAt: updatedRep.joinedAt.toISOString(),
        createdAt: updatedRep.createdAt.toISOString(),
        updatedAt: updatedRep.updatedAt.toISOString(),
        user: updatedRep.user,
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin update sales rep error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/sales-reps/[id] - Deactivate a sales rep (admin only)
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

    // Verify sales rep exists
    const existingRep = await db.salesRep.findUnique({
      where: { id },
    })

    if (!existingRep) {
      return NextResponse.json({ error: 'Sales rep not found' }, { status: 404 })
    }

    if (!existingRep.isActive) {
      return NextResponse.json(
        { error: 'Sales rep is already deactivated' },
        { status: 400 }
      )
    }

    // Deactivate instead of deleting
    const deactivatedRep = await db.salesRep.update({
      where: { id },
      data: { isActive: false },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    return NextResponse.json({
      message: 'Sales rep deactivated successfully',
      salesRep: {
        id: deactivatedRep.id,
        userId: deactivatedRep.userId,
        phone: deactivatedRep.phone,
        targetCity: deactivatedRep.targetCity,
        commissionRate: deactivatedRep.commissionRate,
        commissionPerReg: deactivatedRep.commissionPerReg,
        isActive: deactivatedRep.isActive,
        joinedAt: deactivatedRep.joinedAt.toISOString(),
        createdAt: deactivatedRep.createdAt.toISOString(),
        updatedAt: deactivatedRep.updatedAt.toISOString(),
        user: deactivatedRep.user,
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin deactivate sales rep error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

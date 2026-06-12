import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// POST /api/admin/sales-reps/[id]/goals - Set a new goal for a sales rep (admin only)
export async function POST(
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
    const { period, targetCount, bonusAmount } = body

    if (!period) {
      return NextResponse.json(
        { error: 'Period is required (format: YYYY-MM)' },
        { status: 400 }
      )
    }

    // Validate period format
    const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/
    if (!periodRegex.test(period)) {
      return NextResponse.json(
        { error: 'Invalid period format. Use YYYY-MM (e.g. 2025-03)' },
        { status: 400 }
      )
    }

    // Verify sales rep exists
    const salesRep = await db.salesRep.findUnique({
      where: { id },
    })

    if (!salesRep) {
      return NextResponse.json({ error: 'Sales rep not found' }, { status: 404 })
    }

    // Upsert goal based on salesRepId + period unique constraint
    const goal = await db.salesGoal.upsert({
      where: {
        salesRepId_period: {
          salesRepId: id,
          period,
        },
      },
      create: {
        salesRepId: id,
        period,
        targetCount: targetCount ? parseInt(String(targetCount)) : 0,
        bonusAmount: bonusAmount ? parseFloat(String(bonusAmount)) : 0,
      },
      update: {
        targetCount: targetCount !== undefined ? parseInt(String(targetCount)) : undefined,
        bonusAmount: bonusAmount !== undefined ? parseFloat(String(bonusAmount)) : undefined,
      },
    })

    return NextResponse.json({
      message: goal.createdAt.getTime() === goal.updatedAt.getTime()
        ? 'Goal created successfully'
        : 'Goal updated successfully',
      goal: {
        id: goal.id,
        salesRepId: goal.salesRepId,
        period: goal.period,
        targetCount: goal.targetCount,
        achievedCount: goal.achievedCount,
        progressPercentage:
          goal.targetCount > 0
            ? Math.round((goal.achievedCount / goal.targetCount) * 100)
            : 0,
        bonusAmount: goal.bonusAmount,
        isAchieved: goal.isAchieved,
        createdAt: goal.createdAt.toISOString(),
        updatedAt: goal.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin set sales goal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/sales-reps/[id]/goals - Update goal achieved count (admin only)
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
    const { goalId, achievedCount, period } = body

    // Find the goal either by goalId or by period
    let goal
    if (goalId) {
      goal = await db.salesGoal.findUnique({
        where: { id: goalId },
      })
    } else if (period) {
      goal = await db.salesGoal.findUnique({
        where: {
          salesRepId_period: {
            salesRepId: id,
            period,
          },
        },
      })
    } else {
      return NextResponse.json(
        { error: 'Either goalId or period is required' },
        { status: 400 }
      )
    }

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    if (goal.salesRepId !== id) {
      return NextResponse.json(
        { error: 'Goal does not belong to this sales rep' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (achievedCount !== undefined) {
      updateData.achievedCount = parseInt(String(achievedCount))
      // Auto-mark as achieved if target is met
      if (parseInt(String(achievedCount)) >= goal.targetCount && goal.targetCount > 0) {
        updateData.isAchieved = true
      } else {
        updateData.isAchieved = false
      }
    }

    const updatedGoal = await db.salesGoal.update({
      where: { id: goal.id },
      data: updateData,
    })

    return NextResponse.json({
      message: 'Goal updated successfully',
      goal: {
        id: updatedGoal.id,
        salesRepId: updatedGoal.salesRepId,
        period: updatedGoal.period,
        targetCount: updatedGoal.targetCount,
        achievedCount: updatedGoal.achievedCount,
        progressPercentage:
          updatedGoal.targetCount > 0
            ? Math.round((updatedGoal.achievedCount / updatedGoal.targetCount) * 100)
            : 0,
        bonusAmount: updatedGoal.bonusAmount,
        isAchieved: updatedGoal.isAchieved,
        createdAt: updatedGoal.createdAt.toISOString(),
        updatedAt: updatedGoal.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin update sales goal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/admin/sales-team/overview - Aggregate stats for admin dashboard
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const now = new Date()
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Fetch core data in parallel
    const [
      totalActiveReps,
      totalInactiveReps,
      currentMonthRegistrations,
      currentMonthGoals,
      allCommissionsThisMonth,
      topRepsData,
    ] = await Promise.all([
      // Total active sales reps
      db.salesRep.count({
        where: { isActive: true },
      }),

      // Total inactive sales reps
      db.salesRep.count({
        where: { isActive: false },
      }),

      // Total registrations this month by all reps
      db.organization.count({
        where: {
          referredById: { not: null },
          createdAt: { gte: startOfMonth },
        },
      }),

      // Current month goals
      db.salesGoal.findMany({
        where: { period: currentPeriod },
        select: {
          id: true,
          salesRepId: true,
          targetCount: true,
          achievedCount: true,
          bonusAmount: true,
          isAchieved: true,
          salesRep: {
            select: {
              id: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),

      // All commissions this month (paid)
      db.salesCommission.findMany({
        where: {
          paidAt: { gte: startOfMonth },
          status: 'paid',
        },
        select: { amount: true },
      }),

      // Top performing reps - get all active reps with registration counts
      db.salesRep.findMany({
        where: { isActive: true },
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { registrations: true } },
          registrations: {
            where: { createdAt: { gte: startOfMonth } },
            select: { id: true },
          },
        },
      }),
    ])

    // Calculate total commissions paid this month
    const totalCommissionsPaidThisMonth = allCommissionsThisMonth.reduce(
      (sum, c) => sum + c.amount,
      0
    )

    // Top performing reps by registration count (current month)
    const topPerformingReps = topRepsData
      .map((rep) => ({
        id: rep.id,
        userId: rep.userId,
        name: rep.user.name,
        email: rep.user.email,
        totalRegistrations: rep._count.registrations,
        currentMonthRegistrations: rep.registrations.length,
      }))
      .sort((a, b) => b.currentMonthRegistrations - a.currentMonthRegistrations)
      .slice(0, 10)

    // Team goal progress (aggregate)
    const teamGoalAggregate = currentMonthGoals.reduce(
      (acc, goal) => {
        acc.totalTarget += goal.targetCount
        acc.totalAchieved += goal.achievedCount
        acc.totalBonus += goal.bonusAmount
        if (goal.isAchieved) acc.goalsAchieved += 1
        acc.totalGoals += 1
        return acc
      },
      {
        totalTarget: 0,
        totalAchieved: 0,
        totalBonus: 0,
        goalsAchieved: 0,
        totalGoals: 0,
      }
    )

    const teamGoalProgress =
      teamGoalAggregate.totalTarget > 0
        ? Math.round(
            (teamGoalAggregate.totalAchieved / teamGoalAggregate.totalTarget) * 100
          )
        : 0

    // Goals by rep for detailed view
    const goalsByRep = currentMonthGoals.map((goal) => ({
      salesRepId: goal.salesRepId,
      repName: goal.salesRep.user.name,
      repEmail: goal.salesRep.user.email,
      targetCount: goal.targetCount,
      achievedCount: goal.achievedCount,
      progressPercentage:
        goal.targetCount > 0
          ? Math.round((goal.achievedCount / goal.targetCount) * 100)
          : 0,
      bonusAmount: goal.bonusAmount,
      isAchieved: goal.isAchieved,
    }))

    return NextResponse.json({
      overview: {
        totalActiveReps,
        totalInactiveReps,
        totalReps: totalActiveReps + totalInactiveReps,
        currentMonthRegistrations,
        totalCommissionsPaidThisMonth,
      },
      teamGoal: {
        totalTarget: teamGoalAggregate.totalTarget,
        totalAchieved: teamGoalAggregate.totalAchieved,
        progressPercentage: teamGoalProgress,
        totalBonusPool: teamGoalAggregate.totalBonus,
        goalsAchieved: teamGoalAggregate.goalsAchieved,
        totalGoals: teamGoalAggregate.totalGoals,
      },
      topPerformingReps,
      goalsByRep,
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin sales team overview error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

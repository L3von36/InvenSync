import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/sales-rep/dashboard - Dashboard data for the logged-in sales rep
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'sales_rep') {
      return NextResponse.json(
        { error: 'Forbidden - Sales rep access required' },
        { status: 403 }
      )
    }

    // Find the sales rep profile for this user
    const salesRep = await db.salesRep.findUnique({
      where: { userId: user.id },
    })

    if (!salesRep) {
      return NextResponse.json(
        { error: 'Sales rep profile not found' },
        { status: 404 }
      )
    }

    if (!salesRep.isActive) {
      return NextResponse.json(
        { error: 'Sales rep account is deactivated' },
        { status: 403 }
      )
    }

    const now = new Date()
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Fetch all data in parallel for performance
    const [
      totalRegistrations,
      currentMonthRegistrations,
      allCommissions,
      currentGoal,
      recentRegistrations,
      recentCommissions,
    ] = await Promise.all([
      // Total registrations count
      db.organization.count({
        where: { referredById: salesRep.id },
      }),

      // Current month registrations count
      db.organization.count({
        where: {
          referredById: salesRep.id,
          createdAt: { gte: startOfMonth },
        },
      }),

      // All commissions for summary
      db.salesCommission.findMany({
        where: { salesRepId: salesRep.id },
        select: { amount: true, status: true },
      }),

      // Current month goal
      db.salesGoal.findUnique({
        where: {
          salesRepId_period: {
            salesRepId: salesRep.id,
            period: currentPeriod,
          },
        },
      }),

      // Recent registrations (last 10)
      db.organization.findMany({
        where: { referredById: salesRep.id },
        select: {
          id: true,
          name: true,
          city: true,
          businessType: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Recent commissions (last 10)
      db.salesCommission.findMany({
        where: { salesRepId: salesRep.id },
        include: {
          organization: {
            select: { id: true, name: true, city: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    // Calculate commission summaries
    const totalCommissionAmount = allCommissions.reduce((sum, c) => sum + c.amount, 0)
    const pendingCommissions = allCommissions
      .filter((c) => c.status === 'pending')
      .reduce((sum, c) => sum + c.amount, 0)
    const paidCommissions = allCommissions
      .filter((c) => c.status === 'paid')
      .reduce((sum, c) => sum + c.amount, 0)

    // Build goal data
    const goalData = currentGoal
      ? {
          id: currentGoal.id,
          period: currentGoal.period,
          targetCount: currentGoal.targetCount,
          achievedCount: currentGoal.achievedCount,
          progressPercentage:
            currentGoal.targetCount > 0
              ? Math.round((currentGoal.achievedCount / currentGoal.targetCount) * 100)
              : 0,
          bonusAmount: currentGoal.bonusAmount,
          isAchieved: currentGoal.isAchieved,
          remaining: Math.max(0, currentGoal.targetCount - currentGoal.achievedCount),
        }
      : null

    return NextResponse.json({
      salesRep: {
        id: salesRep.id,
        phone: salesRep.phone,
        targetCity: salesRep.targetCity,
        commissionRate: salesRep.commissionRate,
        commissionPerReg: salesRep.commissionPerReg,
        isActive: salesRep.isActive,
        joinedAt: salesRep.joinedAt.toISOString(),
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      stats: {
        totalRegistrations,
        currentMonthRegistrations,
        commissions: {
          total: totalCommissionAmount,
          pending: pendingCommissions,
          paid: paidCommissions,
        },
      },
      currentGoal: goalData,
      recentRegistrations: recentRegistrations.map((org) => ({
        id: org.id,
        name: org.name,
        city: org.city,
        businessType: org.businessType,
        subscriptionPlan: org.subscriptionPlan,
        subscriptionStatus: org.subscriptionStatus,
        createdAt: org.createdAt.toISOString(),
      })),
      recentCommissions: recentCommissions.map((c) => ({
        id: c.id,
        organizationId: c.organizationId,
        amount: c.amount,
        status: c.status,
        paidAt: c.paidAt ? c.paidAt.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
        organization: c.organization,
      })),
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Sales rep dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

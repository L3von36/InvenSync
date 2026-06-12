import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, hashPassword } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/admin/sales-reps - List all sales reps (admin only)
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const now = new Date()
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
        { targetCity: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    const [salesReps, total] = await Promise.all([
      db.salesRep.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          _count: { select: { registrations: true } },
          goals: {
            where: { period: currentPeriod },
            select: {
              id: true,
              period: true,
              targetCount: true,
              achievedCount: true,
              bonusAmount: true,
              isAchieved: true,
            },
          },
          commissions: {
            select: { amount: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.salesRep.count({ where }),
    ])

    const salesRepsData = salesReps.map((rep) => {
      const totalCommissions = rep.commissions.reduce((sum, c) => sum + c.amount, 0)
      const pendingCommissions = rep.commissions
        .filter((c) => c.status === 'pending')
        .reduce((sum, c) => sum + c.amount, 0)
      const paidCommissions = rep.commissions
        .filter((c) => c.status === 'paid')
        .reduce((sum, c) => sum + c.amount, 0)

      const currentGoal = rep.goals.length > 0 ? rep.goals[0] : null

      return {
        id: rep.id,
        userId: rep.userId,
        phone: rep.phone,
        targetCity: rep.targetCity,
        commissionRate: rep.commissionRate,
        commissionPerReg: rep.commissionPerReg,
        isActive: rep.isActive,
        joinedAt: rep.joinedAt.toISOString(),
        createdAt: rep.createdAt.toISOString(),
        updatedAt: rep.updatedAt.toISOString(),
        user: rep.user,
        totalRegistrations: rep._count.registrations,
        currentGoal: currentGoal
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
            }
          : null,
        commissions: {
          total: totalCommissions,
          pending: pendingCommissions,
          paid: paidCommissions,
        },
      }
    })

    return NextResponse.json({
      salesReps: salesRepsData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin list sales reps error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/sales-reps - Create a new sales rep (admin only)
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { email, name, phone, targetCity, commissionRate, commissionPerReg } = body

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
      include: { salesRep: true },
    })

    if (existingUser) {
      // If user already has a sales rep profile, reject
      if (existingUser.salesRep) {
        return NextResponse.json(
          { error: 'This user is already a sales rep' },
          { status: 409 }
        )
      }

      // Link existing user to a new SalesRep profile
      // Update their role to sales_rep
      // NOTE: We avoid db.$transaction (interactive transactions) because Supabase's
      // pgbouncer connection pooler does not support them. Use sequential queries instead.

      const updatedUser = await db.user.update({
        where: { id: existingUser.id },
        data: { role: 'sales_rep' },
      })

      const salesRep = await db.salesRep.create({
        data: {
          userId: existingUser.id,
          phone: phone || null,
          targetCity: targetCity || null,
          commissionRate: commissionRate ? parseFloat(String(commissionRate)) : 0,
          commissionPerReg: commissionPerReg ? parseFloat(String(commissionPerReg)) : 0,
        },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      })

      // Auto-create a monthly goal for the current period
      const now = new Date()
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      await db.salesGoal.upsert({
        where: {
          salesRepId_period: {
            salesRepId: salesRep.id,
            period: currentPeriod,
          },
        },
        create: {
          salesRepId: salesRep.id,
          period: currentPeriod,
          targetCount: 0,
          bonusAmount: 0,
        },
        update: {},
      })

      return NextResponse.json(
        {
          message: 'Sales rep created from existing user',
          salesRep: {
            id: salesRep.id,
            userId: salesRep.userId,
            phone: salesRep.phone,
            targetCity: salesRep.targetCity,
            commissionRate: salesRep.commissionRate,
            commissionPerReg: salesRep.commissionPerReg,
            isActive: salesRep.isActive,
            joinedAt: salesRep.joinedAt.toISOString(),
            createdAt: salesRep.createdAt.toISOString(),
            user: salesRep.user,
          },
        },
        { status: 201 }
      )
    }

    // Create new user + sales rep using sequential queries
    // NOTE: We avoid db.$transaction (interactive transactions) because Supabase's
    // pgbouncer connection pooler does not support them. Use sequential queries instead.
    const defaultPassword = 'InvenSync2024!'
    const passwordHash = await hashPassword(defaultPassword)

    const newUser = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: 'sales_rep',
      },
    })

    const salesRepResult = await db.salesRep.create({
      data: {
        userId: newUser.id,
        phone: phone || null,
        targetCity: targetCity || null,
        commissionRate: commissionRate ? parseFloat(String(commissionRate)) : 0,
        commissionPerReg: commissionPerReg ? parseFloat(String(commissionPerReg)) : 0,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    // Auto-create a monthly goal for the current period
    const now = new Date()
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    await db.salesGoal.upsert({
      where: {
        salesRepId_period: {
          salesRepId: salesRepResult.id,
          period: currentPeriod,
        },
      },
      create: {
        salesRepId: salesRepResult.id,
        period: currentPeriod,
        targetCount: 0,
        bonusAmount: 0,
      },
      update: {},
    })

    const result = salesRepResult

    return NextResponse.json(
      {
        message: 'Sales rep created successfully',
        salesRep: {
          id: result.id,
          userId: result.userId,
          phone: result.phone,
          targetCity: result.targetCity,
          commissionRate: result.commissionRate,
          commissionPerReg: result.commissionPerReg,
          isActive: result.isActive,
          joinedAt: result.joinedAt.toISOString(),
          createdAt: result.createdAt.toISOString(),
          user: result.user,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin create sales rep error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

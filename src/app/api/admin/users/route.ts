import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

// GET /api/admin/users - List all users with pagination, search, and filter (admin only)
export async function GET(request: Request) {
  // Rate limit admin endpoints
  const rateLimitResult = applyRateLimit(request, RateLimitTiers.ADMIN)
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    // Search by name or email
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ]
    }

    // Filter by role
    if (role) {
      where.role = role
    }

    const [users, total, totalAdmins, totalSalesReps] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
          memberships: {
            select: {
              role: true,
              organization: {
                select: { id: true, name: true, businessType: true }
              }
            }
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
      db.user.count({ where: { role: 'admin' } }),
      db.user.count({ where: { role: 'sales_rep' } }),
    ])

    return NextResponse.json({
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt.toISOString(),
        organizations: u.memberships.map(m => ({
          id: m.organization.id,
          name: m.organization.name,
          role: m.role,
          businessType: m.organization.businessType,
        })),
      })),
      stats: {
        totalUsers: total,
        adminCount: totalAdmins,
        salesRepCount: totalSalesReps,
        businessUserCount: total - totalAdmins - totalSalesReps,
      },
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
    console.error('Admin list users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

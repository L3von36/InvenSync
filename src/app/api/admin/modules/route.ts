import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/admin/modules - List all modules (admin only)
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const modules = await db.module.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { orgModules: true } }
      }
    })

    return NextResponse.json({
      modules: modules.map(m => ({
        id: m.id,
        key: m.key,
        name: m.name,
        description: m.description,
        icon: m.icon,
        category: m.category,
        priceETB: m.priceETB,
        isFree: m.isFree,
        freeTrialDays: m.freeTrialDays,
        billingCycle: m.billingCycle,
        isActive: m.isActive,
        order: m.order,
        orgCount: m._count.orgModules,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      }))
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin list modules error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/modules - Create a new module (admin only)
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
    const { key, name, description, icon, category, priceETB, isFree, freeTrialDays, billingCycle, order } = body

    if (!key || !name || !description) {
      return NextResponse.json({ error: 'Key, name, and description are required' }, { status: 400 })
    }

    // Check unique key
    const existing = await db.module.findUnique({ where: { key } })
    if (existing) {
      return NextResponse.json({ error: 'Module key already exists' }, { status: 409 })
    }

    const mod = await db.module.create({
      data: {
        key,
        name,
        description,
        icon: icon || 'Package',
        category: category || 'core',
        priceETB: priceETB ?? 0,
        isFree: isFree ?? false,
        freeTrialDays: freeTrialDays ?? 30,
        billingCycle: billingCycle || 'monthly',
        order: order ?? 0,
      }
    })

    return NextResponse.json({ module: mod }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin create module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

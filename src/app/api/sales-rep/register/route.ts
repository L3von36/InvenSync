import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, hashPassword, generateToken } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

export async function POST(request: Request) {
  try {
    // 1. Authenticate and verify sales_rep role
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'sales_rep') {
      return NextResponse.json(
        { error: 'Unauthorized: Only sales representatives can access this endpoint' },
        { status: 403 }
      )
    }

    // 2. Find the sales rep profile
    const salesRep = await db.salesRep.findUnique({
      where: { userId: user.id }
    })

    if (!salesRep || !salesRep.isActive) {
      return NextResponse.json(
        { error: 'Active sales representative profile not found' },
        { status: 403 }
      )
    }

    // 3. Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const {
      name, email, password, organizationName,
      businessType, description, address, city,
      latitude, longitude, phone
    } = body

    if (!name || !email || !password || !organizationName) {
      return NextResponse.json(
        { error: 'Name, email, password, and organization name are required' },
        { status: 400 }
      )
    }

    const validBusinessTypes = ['retail', 'service', 'mixed']
    const resolvedBusinessType = validBusinessTypes.includes(businessType) ? businessType : 'retail'

    // 4. Check if user already exists
    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    // 5. Generate slug from organization name
    const slug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now().toString(36)

    // Check slug uniqueness
    const existingSlug = await db.organization.findUnique({ where: { slug } })
    if (existingSlug) {
      return NextResponse.json(
        { error: 'Organization slug already exists' },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(password)

    // 6. Create everything using sequential queries
    // NOTE: We avoid db.$transaction (interactive transactions) because Supabase's
    // pgbouncer connection pooler does not support them. Use sequential queries instead.

    // Create the customer's user account
    const customerUser = await db.user.create({
      data: { email, name, passwordHash }
    })

    // Create organization with referredById set to the sales rep
    const organization = await db.organization.create({
      data: {
        name: organizationName,
        slug,
        businessType: resolvedBusinessType,
        description: description || null,
        address: address || null,
        city: city || null,
        latitude: latitude != null ? parseFloat(String(latitude)) : null,
        longitude: longitude != null ? parseFloat(String(longitude)) : null,
        phone: phone || null,
        referredById: salesRep.id,
      }
    })

    // Create organization membership (customer is owner)
    await db.organizationMember.create({
      data: {
        userId: customerUser.id,
        organizationId: organization.id,
        role: 'owner'
      }
    })

    // Create default "Main Shop"
    const shop = await db.shop.create({
      data: {
        organizationId: organization.id,
        name: 'Main Shop',
        address: address || null,
        city: city || null,
        latitude: latitude != null ? parseFloat(String(latitude)) : null,
        longitude: longitude != null ? parseFloat(String(longitude)) : null,
        phone: phone || null,
      }
    })

    // Assign the customer as shop manager
    await db.shopMember.create({
      data: {
        userId: customerUser.id,
        shopId: shop.id,
        role: 'manager',
      }
    })

    // Auto-assign free modules with trial period
    const freeModules = await db.module.findMany({
      where: { isActive: true, isFree: true }
    })

    const now = new Date()
    for (const mod of freeModules) {
      const expiresAt = new Date(now.getTime() + mod.freeTrialDays * 24 * 60 * 60 * 1000)
      await db.organizationModule.create({
        data: {
          organizationId: organization.id,
          moduleId: mod.id,
          status: 'trial',
          isActive: true,
          expiresAt,
          priceAtActivation: mod.priceETB,
          autoRenew: false,
        }
      })
    }

    // Create commission record for the sales rep
    await db.salesCommission.create({
      data: {
        salesRepId: salesRep.id,
        organizationId: organization.id,
        amount: salesRep.commissionPerReg,
        status: 'pending',
      }
    })

    // Get or create current month's sales goal and increment achieved count
    const period = new Date().toISOString().slice(0, 7)
    const goal = await db.salesGoal.upsert({
      where: {
        salesRepId_period: { salesRepId: salesRep.id, period }
      },
      create: {
        salesRepId: salesRep.id,
        period,
        targetCount: 0,
        achievedCount: 1,
      },
      update: {
        achievedCount: { increment: 1 },
      }
    })

    // Mark goal as achieved if target is met
    if (goal.achievedCount >= goal.targetCount && goal.targetCount > 0) {
      await db.salesGoal.update({
        where: { id: goal.id },
        data: { isAchieved: true }
      })
    }

    const result = { customerUser, organization }

    // 7. Generate token for the new customer user
    const token = generateToken(result.customerUser.id)

    return NextResponse.json({
      token,
      user: {
        id: result.customerUser.id,
        email: result.customerUser.email,
        name: result.customerUser.name,
        role: result.customerUser.role,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        businessType: result.organization.businessType,
        city: result.organization.city,
        referredById: result.organization.referredById,
      },
    }, { status: 201 })

  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Sales rep registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

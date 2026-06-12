import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/product-types?orgId=xxx
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'inventory')
      if (moduleError) return moduleError
    }

    const shopId = searchParams.get('shopId')

    const productTypes = await db.productType.findMany({
      where: {
        organizationId: orgId,
        // Prisma doesn't allow null inside `in` arrays, so use AND + OR instead
        ...(shopId ? { products: { some: { AND: [{ OR: [{ shopId }, { shopId: null }] }] } } } : {}),
      },
      include: {
        attributes: {
          orderBy: { order: 'asc' }
        },
        _count: {
          select: { products: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ productTypes })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('List product types error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/product-types - Create product type with attributes
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { orgId, name, icon, attributes } = body

    if (!orgId || !name) {
      return NextResponse.json({ error: 'orgId and name are required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'inventory')
      if (moduleError) return moduleError
    }

    // NOTE: We avoid db.$transaction (interactive transactions) because Supabase's
    // pgbouncer connection pooler does not support them. Use sequential queries instead.

    const productType = await db.productType.create({
      data: {
        organizationId: orgId,
        name,
        icon: icon || null,
      }
    })

    if (attributes && attributes.length > 0) {
      for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i]
        await db.attributeDefinition.create({
          data: {
            productTypeId: productType.id,
            name: attr.name,
            fieldType: attr.fieldType || 'text',
            options: (attr.fieldType === 'select' && attr.options) 
              ? JSON.stringify(attr.options.split(',').map((o: string) => o.trim()).filter(Boolean))
              : null,
            required: attr.required || false,
            order: i,
          }
        })
      }
    }

    // Fetch with attributes to return
    const result = await db.productType.findUnique({
      where: { id: productType.id },
      include: { attributes: { orderBy: { order: 'asc' } } }
    })

    return NextResponse.json({ productType: result }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Create product type error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

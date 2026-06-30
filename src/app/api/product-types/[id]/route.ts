import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/product-types/[id]?orgId=xxx
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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

    const productType = await db.productType.findFirst({
      where: { id, organizationId: orgId },
      include: {
        attributes: { orderBy: { order: 'asc' } },
        _count: { select: { products: true } }
      }
    })

    if (!productType) {
      return NextResponse.json({ error: 'Product type not found' }, { status: 404 })
    }

    return NextResponse.json({ productType })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get product type error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/product-types/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { orgId, name, icon, attributes } = body

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

    // Verify product type belongs to org
    const existing = await db.productType.findFirst({
      where: { id, organizationId: orgId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Product type not found' }, { status: 404 })
    }

    // NOTE: We avoid db.$transaction (interactive transactions) because Supabase's
    // pgbouncer connection pooler does not support them. Use sequential queries instead.

    const productType = await db.productType.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(icon !== undefined && { icon }),
      }
    })

    // If attributes provided, replace them
    if (attributes !== undefined) {
      await db.attributeDefinition.deleteMany({
        where: { productTypeId: id }
      })

      for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i]
        await db.attributeDefinition.create({
          data: {
            productTypeId: id,
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

    const result = await db.productType.findUnique({
      where: { id },
      include: { attributes: { orderBy: { order: 'asc' } } }
    })

    return NextResponse.json({ productType: result })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update product type error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/product-types/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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

    const existing = await db.productType.findFirst({
      where: { id, organizationId: orgId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Product type not found' }, { status: 404 })
    }

    await db.productType.delete({ where: { id } })

    return NextResponse.json({ message: 'Product type deleted' })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Delete product type error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'
import { sanitizeAndTruncate, validateSanitizedField } from '@/lib/sanitize'

// GET /api/products/[id]?orgId=xxx
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

    const product = await db.product.findFirst({
      where: { id, organizationId: orgId },
      include: {
        productType: {
          include: { attributes: { orderBy: { order: 'asc' } } }
        },
        attributeValues: {
          include: {
            attributeDefinition: { select: { id: true, name: true, fieldType: true } }
          }
        },
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        }
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ product })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get product error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/products/[id]
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
    const {
      orgId, imageUrl,
      isActive, attributeValues, stockReason, shopId
    } = body
    let { name, sku, description } = body

    // Sanitize text inputs and enforce max lengths
    if (name !== undefined) name = sanitizeAndTruncate(name, 255)
    if (sku !== undefined) sku = sku ? sanitizeAndTruncate(sku, 100) : sku
    if (description !== undefined) description = description ? sanitizeAndTruncate(description, 1000) : description

    // Validate that sanitized fields are not empty when originally provided
    const nameError = validateSanitizedField(body.name, name, 'Name')
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 })
    }
    const skuError = validateSanitizedField(body.sku, sku, 'SKU')
    if (skuError) {
      return NextResponse.json({ error: skuError }, { status: 400 })
    }
    const descError = validateSanitizedField(body.description, description, 'Description')
    if (descError) {
      return NextResponse.json({ error: descError }, { status: 400 })
    }

    // Ensure numeric fields are properly parsed (form may send strings)
    const costPrice = body.costPrice !== undefined ? (typeof body.costPrice === 'string' ? parseFloat(body.costPrice) : body.costPrice) : undefined
    const sellingPrice = body.sellingPrice !== undefined ? (typeof body.sellingPrice === 'string' ? parseFloat(body.sellingPrice) : body.sellingPrice) : undefined
    const quantity = body.quantity !== undefined ? (typeof body.quantity === 'string' ? parseInt(body.quantity, 10) : body.quantity) : undefined
    const lowStockThreshold = body.lowStockThreshold !== undefined ? (typeof body.lowStockThreshold === 'string' ? parseInt(body.lowStockThreshold, 10) : body.lowStockThreshold) : undefined

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

    const existing = await db.product.findFirst({
      where: { id, organizationId: orgId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Wrap stock movement + product update + attribute updates in a transaction
    // to prevent race conditions (TOCTOU on quantity, partial writes)
    const result = await db.$transaction(async (tx) => {
      // Handle stock quantity change with movement tracking
      if (quantity !== undefined && quantity !== existing.quantity) {
        const diff = quantity - existing.quantity
        const movementType = diff > 0 ? 'in' : 'out'
        const reason = stockReason || (diff > 0 ? 'Stock adjustment (added)' : 'Stock adjustment (removed)')

        await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            shopId: existing.shopId,
            productId: id,
            type: movementType,
            quantity: Math.abs(diff),
            previousStock: existing.quantity,
            newStock: quantity,
            reason,
          }
        })
      }

      const product = await tx.product.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(sku !== undefined && { sku }),
          ...(description !== undefined && { description }),
          ...(imageUrl !== undefined && { imageUrl }),
          ...(costPrice !== undefined && { costPrice }),
          ...(sellingPrice !== undefined && { sellingPrice }),
          ...(quantity !== undefined && { quantity }),
          ...(lowStockThreshold !== undefined && { lowStockThreshold }),
          ...(isActive !== undefined && { isActive }),
          ...(shopId !== undefined && { shopId }),
        }
      })

      // Update attribute values if provided
      if (attributeValues !== undefined) {
        for (const av of attributeValues) {
          await tx.productAttributeValue.upsert({
            where: {
              productId_attributeDefinitionId: {
                productId: id,
                attributeDefinitionId: av.attributeDefinitionId,
              }
            },
            create: {
              productId: id,
              attributeDefinitionId: av.attributeDefinitionId,
              value: String(av.value),
            },
            update: {
              value: String(av.value),
            }
          })
        }
      }

      return tx.product.findUnique({
        where: { id },
        include: {
          productType: { include: { attributes: { orderBy: { order: 'asc' } } } },
          attributeValues: {
            include: {
              attributeDefinition: { select: { id: true, name: true, fieldType: true } }
            }
          }
        }
      })
    })

    return NextResponse.json({ product: result })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update product error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/products/[id]
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

    const existing = await db.product.findFirst({
      where: { id, organizationId: orgId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Soft delete
    await db.product.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ message: 'Product deleted' })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Delete product error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

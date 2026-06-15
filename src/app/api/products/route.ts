import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'
import { sanitizeAndTruncate, validateSanitizedField } from '@/lib/sanitize'
import { applyRateLimit, RateLimitTiers } from '@/lib/rate-limit'

// GET /api/products?orgId=xxx&productTypeId=xxx&search=xxx
export async function GET(request: Request) {
  // Rate limit list endpoints (60 req/min per user/IP)
  const rateLimitResult = applyRateLimit(request, RateLimitTiers.LIST)
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

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

    const productTypeId = searchParams.get('productTypeId')
    const search = searchParams.get('search')
    const shopId = searchParams.get('shopId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {
      organizationId: orgId,
      isActive: true,
    }

    // When shopId is provided, show products for that shop AND shared products (shopId=null)
    // Prisma doesn't allow null inside `in` arrays, so use AND + OR instead
    if (shopId) {
      where.AND = [
        { OR: [{ shopId }, { shopId: null }] },
      ]
    }

    if (productTypeId) {
      where.productTypeId = productTypeId
    }

    if (search) {
      // Add search OR conditions inside the AND array (alongside shopId filter if present)
      const searchOr = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { description: { contains: search } },
      ]
      if (where.AND) {
        where.AND.push({ OR: searchOr })
      } else {
        where.OR = searchOr
      }
    }

    // Delta sync: filter records updated since the given timestamp
    const updatedSince = searchParams.get('updatedSince')
    if (updatedSince) {
      const updatedSinceDate = new Date(updatedSince)
      if (!isNaN(updatedSinceDate.getTime())) {
        where.updatedAt = { gte: updatedSinceDate }
      }
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          productType: { select: { id: true, name: true, icon: true } },
          attributeValues: {
            include: {
              attributeDefinition: { select: { id: true, name: true, fieldType: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.product.count({ where })
    ])

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, {
      headers: {
        // Product lists change infrequently - short browser cache with SWR
        'Cache-Control': 'private, max-age=5, stale-while-revalidate=15',
      }
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('List products error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper: safely parse a numeric field from the request body (may be string or number)
function parseNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback
  const num = typeof value === 'string' ? parseFloat(value) : Number(value)
  return Number.isNaN(num) ? fallback : num
}

function parseInteger(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback
  const num = typeof value === 'string' ? parseInt(value, 10) : Number(value)
  return Number.isNaN(num) ? fallback : Math.floor(num)
}

// POST /api/products - Create product with attribute values
export async function POST(request: Request) {
  // Rate limit mutation endpoints (20 req/min per user/IP)
  const rateLimitResult = applyRateLimit(request, RateLimitTiers.MUTATION)
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

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
    const {
      orgId, productTypeId, imageUrl,
      attributeValues, shopId
    } = body
    let { name, sku, description } = body

    // Sanitize text inputs and enforce max lengths
    name = sanitizeAndTruncate(name, 255)
    sku = sku ? sanitizeAndTruncate(sku, 100) : sku
    description = description ? sanitizeAndTruncate(description, 1000) : description

    // Validate required fields after sanitization
    if (!orgId || !productTypeId || !name) {
      if (orgId && productTypeId && body.name && !name) {
        return NextResponse.json(
          { error: 'Name contains only invalid characters' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'orgId, productTypeId, and name are required' },
        { status: 400 }
      )
    }

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

    // Parse numeric fields safely (form may send strings)
    const quantity = parseInteger(body.quantity, 0)
    const costPrice = parseNumber(body.costPrice, 0)
    const sellingPrice = parseNumber(body.sellingPrice, 0)
    const lowStockThreshold = parseInteger(body.lowStockThreshold, 10)

    if (!costPrice || costPrice <= 0) {
      return NextResponse.json(
        { error: 'Cost price must be greater than 0' },
        { status: 400 }
      )
    }

    if (!sellingPrice || sellingPrice <= 0) {
      return NextResponse.json(
        { error: 'Selling price must be greater than 0' },
        { status: 400 }
      )
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

    // Verify product type belongs to org and fetch its attribute definitions
    const productType = await db.productType.findFirst({
      where: { id: productTypeId, organizationId: orgId },
      include: { attributes: { select: { id: true } } }
    })
    if (!productType) {
      return NextResponse.json({ error: 'Product type not found' }, { status: 404 })
    }

    // Validate attributeDefinitionIds before creating the product
    const validAttrIds = new Set(productType.attributes.map(a => a.id))
    if (attributeValues && Array.isArray(attributeValues) && attributeValues.length > 0) {
      for (const av of attributeValues) {
        if (!av.attributeDefinitionId || typeof av.attributeDefinitionId !== 'string') {
          return NextResponse.json(
            { error: 'Each attribute value must include a valid attributeDefinitionId' },
            { status: 400 }
          )
        }
        if (!validAttrIds.has(av.attributeDefinitionId)) {
          return NextResponse.json(
            { error: `Attribute "${av.attributeDefinitionId}" does not belong to the selected product type. Please refresh the page and try again.` },
            { status: 400 }
          )
        }
        if (av.value === undefined || av.value === null) {
          return NextResponse.json(
            { error: 'Each attribute value must include a value' },
            { status: 400 }
          )
        }
      }
    }

    // Auto-generate SKU if not provided: {TYPE-ABBREV}-{TIMESTAMP}
    // e.g., "SNK-1718991234" or "SHOES-1718991234"
    if (!sku || sku.trim() === '') {
      const typeAbbr = (productType.name || 'PRD')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 4)
      const count = await db.product.count({
        where: { organizationId: orgId, productTypeId }
      })
      const seq = String(count + 1).padStart(3, '0')
      sku = `${typeAbbr}-${seq}`
    }

    // Wrap product creation + attribute values + initial stock movement in a transaction
    // to prevent orphaned products if attribute creation fails
    const result = await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          productTypeId,
          organizationId: orgId,
          shopId: shopId || null,
          name,
          sku,
          description: description || null,
          imageUrl: imageUrl || null,
          quantity: quantity || 0,
          costPrice: costPrice,
          sellingPrice: sellingPrice,
          lowStockThreshold: lowStockThreshold || 10,
        }
      })

      // Create attribute values inside the transaction
      // OPTIMIZATION: Use createMany for batch insert instead of sequential create calls
      if (attributeValues && Array.isArray(attributeValues) && attributeValues.length > 0) {
        await tx.productAttributeValue.createMany({
          data: attributeValues.map((av: { attributeDefinitionId: string; value: string }) => ({
            productId: product.id,
            attributeDefinitionId: av.attributeDefinitionId,
            value: String(av.value),
          }))
        })
      }

      // Create initial stock movement if quantity > 0
      if (quantity && quantity > 0) {
        await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            shopId: shopId || null,
            productId: product.id,
            type: 'in',
            quantity: quantity,
            previousStock: 0,
            newStock: quantity,
            reason: 'Initial stock',
          }
        })
      }

      // Fetch with relations
      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          productType: { select: { id: true, name: true, icon: true } },
          attributeValues: {
            include: {
              attributeDefinition: { select: { id: true, name: true, fieldType: true } }
            }
          }
        }
      })
    })

    return NextResponse.json({ product: result }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Create product error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred while creating the product. Please try again.' },
      { status: 500 }
    )
  }
}

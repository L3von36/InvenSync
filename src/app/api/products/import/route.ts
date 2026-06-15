import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

interface ImportProduct {
  name: string
  sku?: string
  productType?: string
  costPrice: number
  sellingPrice: number
  quantity: number
  lowStockThreshold: number
}

interface ImportError {
  row: number
  field: string
  message: string
}

// POST /api/products/import
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
    const { organizationId, shopId, products } = body as {
      organizationId: string
      shopId?: string
      products: ImportProduct[]
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'products array is required and must not be empty' }, { status: 400 })
    }

    if (products.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 products can be imported at once' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch product types for this organization
    const productTypes = await db.productType.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    })

    const productTypeMap = new Map(
      productTypes.map((pt) => [pt.name.toLowerCase(), pt.id])
    )

    // Default product type (first one or a generic one)
    const defaultProductTypeId = productTypes.length > 0 ? productTypes[0].id : null

    // Validate and import
    const errors: ImportError[] = []
    const validProducts: Array<{
      data: ImportProduct
      productTypeId: string
      rowIndex: number
    }> = []

    products.forEach((product, index) => {
      const row = index + 1

      // Validate name
      if (!product.name || typeof product.name !== 'string' || product.name.trim() === '') {
        errors.push({ row, field: 'name', message: 'Product name is required' })
        return
      }

      // Validate costPrice
      const costPrice = Number(product.costPrice)
      if (isNaN(costPrice) || costPrice < 0) {
        errors.push({ row, field: 'costPrice', message: 'Cost price must be a valid non-negative number' })
        return
      }

      // Validate sellingPrice
      const sellingPrice = Number(product.sellingPrice)
      if (isNaN(sellingPrice) || sellingPrice <= 0) {
        errors.push({ row, field: 'sellingPrice', message: 'Selling price must be a valid positive number' })
        return
      }

      // Validate quantity
      const quantity = Number(product.quantity)
      if (isNaN(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
        errors.push({ row, field: 'quantity', message: 'Quantity must be a valid non-negative integer' })
        return
      }

      // Validate lowStockThreshold
      const lowStockThreshold = Number(product.lowStockThreshold)
      if (isNaN(lowStockThreshold) || lowStockThreshold < 0 || !Number.isInteger(lowStockThreshold)) {
        errors.push({ row, field: 'lowStockThreshold', message: 'Low stock threshold must be a valid non-negative integer' })
        return
      }

      // Resolve product type
      let productTypeId = defaultProductTypeId
      if (product.productType) {
        const matchedTypeId = productTypeMap.get(product.productType.toLowerCase())
        if (matchedTypeId) {
          productTypeId = matchedTypeId
        } else {
          errors.push({
            row,
            field: 'productType',
            message: `Product type "${product.productType}" not found. Available types: ${productTypes.map((pt) => pt.name).join(', ')}`,
          })
          return
        }
      }

      if (!productTypeId) {
        errors.push({ row, field: 'productType', message: 'No product type available. Create a product type first.' })
        return
      }

      // Check for duplicate SKU within the import
      if (product.sku) {
        const existingSku = validProducts.find(
          (vp) => vp.data.sku && vp.data.sku.toLowerCase() === product.sku!.toLowerCase()
        )
        if (existingSku) {
          errors.push({
            row,
            field: 'sku',
            message: `Duplicate SKU "${product.sku}" found in row ${existingSku.rowIndex}`,
          })
          return
        }
      }

      validProducts.push({
        data: {
          name: product.name.trim(),
          sku: product.sku?.trim() || undefined,
          productType: product.productType,
          costPrice,
          sellingPrice,
          quantity,
          lowStockThreshold: lowStockThreshold || 10,
        },
        productTypeId,
        rowIndex: row,
      })
    })

    // Check for existing SKUs in database
    const skusToCheck = validProducts
      .filter((vp) => vp.data.sku)
      .map((vp) => vp.data.sku!)

    if (skusToCheck.length > 0) {
      const existingProducts = await db.product.findMany({
        where: {
          organizationId,
          sku: { in: skusToCheck },
        },
        select: { sku: true },
      })

      const existingSkuSet = new Set(existingProducts.map((p) => p.sku?.toLowerCase()))

      for (const vp of validProducts) {
        if (vp.data.sku && existingSkuSet.has(vp.data.sku.toLowerCase())) {
          errors.push({
            row: vp.rowIndex,
            field: 'sku',
            message: `SKU "${vp.data.sku}" already exists in the database`,
          })
        }
      }

      // Remove products with existing SKU errors
      const errorRows = new Set(errors.map((e) => e.row))
      const filteredProducts = validProducts.filter((vp) => !errorRows.has(vp.rowIndex))
      validProducts.length = 0
      validProducts.push(...filteredProducts)
    }

    // Create products in bulk
    let successCount = 0
    const creationErrors: ImportError[] = []

    for (const vp of validProducts) {
      try {
        await db.product.create({
          data: {
            organizationId,
            shopId: shopId || null,
            productTypeId: vp.productTypeId,
            name: vp.data.name,
            sku: vp.data.sku || null,
            costPrice: vp.data.costPrice,
            sellingPrice: vp.data.sellingPrice,
            quantity: vp.data.quantity,
            lowStockThreshold: vp.data.lowStockThreshold,
            isActive: true,
          },
        })
        successCount++
      } catch (err) {
        creationErrors.push({
          row: vp.rowIndex,
          field: 'general',
          message: err instanceof Error ? err.message : 'Failed to create product',
        })
      }
    }

    const allErrors = [...errors, ...creationErrors]

    return NextResponse.json({
      successCount,
      failureCount: allErrors.length,
      errors: allErrors,
      totalAttempted: products.length,
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Bulk import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { generateProductBarcode } from '@/lib/barcode'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/products/[id]/barcode?orgId=xxx
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

    // Fetch the product
    const product = await db.product.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        costPrice: true,
        sellingPrice: true,
        quantity: true,
        productType: {
          select: { id: true, name: true },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Generate barcode and QR code
    const { barcode, qr } = generateProductBarcode({
      id: product.id,
      name: product.name,
      sku: product.sku,
    })

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        quantity: product.quantity,
        productType: product.productType,
      },
      barcode,
      qr,
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Barcode generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

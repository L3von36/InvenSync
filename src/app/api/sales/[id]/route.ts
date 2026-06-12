import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/sales/[id]?orgId=xxx
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
      const moduleError = await requireModule(orgId, 'sales')
      if (moduleError) return moduleError
    }

    const sale = await db.sale.findFirst({
      where: { id, organizationId: orgId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true, address: true } },
        items: {
          include: {
            product: {
              include: {
                productType: { select: { id: true, name: true } }
              }
            }
          }
        }
      }
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    return NextResponse.json({ sale })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Get sale error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

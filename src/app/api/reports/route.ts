import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/reports?orgId=xxx&type=daily|weekly|monthly&startDate=xxx&endDate=xxx&shopId=xxx
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

    const shopIdRaw = searchParams.get('shopId')
    const shopId = (shopIdRaw && shopIdRaw !== 'undefined' && shopIdRaw !== 'null') ? shopIdRaw : undefined

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Module access check (admin bypasses)
    if (user.role !== 'admin') {
      const moduleError = await requireModule(orgId, 'reports')
      if (moduleError) return moduleError
    }

    const type = searchParams.get('type') || 'daily' // daily, weekly, monthly
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const now = new Date()
    const defaultEnd = now
    let defaultStart: Date

    switch (type) {
      case 'weekly':
        defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'monthly':
        defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      default: // daily
        defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }

    const periodStart = startDate ? new Date(startDate) : defaultStart
    const periodEnd = endDate ? new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000) : defaultEnd

    // Build sale where clause with optional shopId filter
    const saleWhere = {
      organizationId: orgId,
      saleDate: { gte: periodStart, lte: periodEnd },
      status: 'completed' as const,
      ...(shopId ? { shopId } : {}),
    }

    // Sales by period
    const sales = await db.sale.findMany({
      where: saleWhere,
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, costPrice: true } }
          }
        }
      },
      orderBy: { saleDate: 'asc' }
    })

    // Group sales by date
    const salesByDate: Record<string, { revenue: number; cost: number; profit: number; count: number }> = {}
    for (const sale of sales) {
      const dateKey = sale.saleDate.toISOString().split('T')[0]
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = { revenue: 0, cost: 0, profit: 0, count: 0 }
      }
      salesByDate[dateKey].revenue += sale.total
      salesByDate[dateKey].count += 1

      const saleCost = sale.items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0)
      salesByDate[dateKey].cost += saleCost
      salesByDate[dateKey].profit += sale.total - saleCost
    }

    // Best-selling products (with shopId filter on the sale)
    const bestSellingProducts = await db.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          organizationId: orgId,
          saleDate: { gte: periodStart, lte: periodEnd },
          status: 'completed',
          ...(shopId ? { shopId } : {}),
        }
      },
      _sum: { total: true, quantity: true },
      _count: true,
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    })

    const bestSellingWithDetails = await Promise.all(
      bestSellingProducts.map(async (item) => {
        const product = await db.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, sku: true, sellingPrice: true }
        })
        return {
          ...product,
          totalRevenue: item._sum.total || 0,
          totalQuantity: item._sum.quantity || 0,
          salesCount: item._count,
        }
      })
    )

    // Inventory valuation (with shopId filter: show branch products + shared products)
    // Prisma doesn't allow null inside `in` arrays, so use AND + OR instead
    const products = await db.product.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        ...(shopId ? { AND: [{ OR: [{ shopId }, { shopId: null }] }] } : {}),
      },
      select: { name: true, quantity: true, costPrice: true, sellingPrice: true }
    })

    const inventoryValuation = {
      totalItems: products.reduce((sum, p) => sum + p.quantity, 0),
      totalCostValue: products.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0),
      totalRetailValue: products.reduce((sum, p) => sum + (p.quantity * p.sellingPrice), 0),
      potentialProfit: products.reduce((sum, p) => sum + (p.quantity * (p.sellingPrice - p.costPrice)), 0),
    }

    // Summary
    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)
    const totalCost = sales.reduce((sum, s) =>
      sum + s.items.reduce((itemSum, item) => itemSum + (item.costPrice * item.quantity), 0), 0)

    // Format salesByDate as salesByPeriod with period field for consistency
    const salesByPeriod = Object.entries(salesByDate).map(([date, data]) => ({
      period: date,
      revenue: data.revenue,
      cost: data.cost,
      profit: data.profit,
      count: data.count,
    }))

    return NextResponse.json({
      period: { start: periodStart, end: periodEnd, type },
      summary: {
        totalRevenue,
        totalCost,
        totalProfit: totalRevenue - totalCost,
        totalSales: sales.length,
        averageSaleValue: sales.length > 0 ? totalRevenue / sales.length : 0,
      },
      salesByPeriod,
      salesByDate: Object.entries(salesByDate).map(([date, data]) => ({
        date,
        ...data,
      })),
      bestSellingProducts: bestSellingWithDetails,
      inventoryValuation,
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Reports error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

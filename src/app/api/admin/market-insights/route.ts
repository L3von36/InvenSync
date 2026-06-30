import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const regionId = searchParams.get('regionId') || undefined

    // Build org-level where clause based on region filter
    const orgWhere = regionId ? { regionId } : {}

    // Low stock products across all orgs
    // SQLite doesn't support field-to-field comparison in WHERE, so we fetch all
    // active products and filter in JS.
    // Product has no direct "organization" relation — we go through shop → organization
    const allActiveProducts = await db.product.findMany({
      where: {
        isActive: true,
        ...(regionId ? { organization: { regionId } } : {}),
      },
      select: {
        name: true,
        quantity: true,
        lowStockThreshold: true,
        organizationId: true,
        productType: { select: { name: true } },
        shop: {
          select: {
            organization: { select: { name: true, id: true, regionId: true } },
          }
        },
      },
    })

    // Also fetch organizations directly for products without a shop
    const orgIds = [...new Set(allActiveProducts.map(p => p.organizationId))]
    const orgs = await db.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true, regionId: true },
    })
    const orgMap = new Map(orgs.map(o => [o.id, o]))

    // Filter in JS: products at or below their low stock threshold
    const filteredLowStock = allActiveProducts.filter(p => p.quantity <= p.lowStockThreshold)
    const lowStockResult = filteredLowStock.map(p => {
      const org = p.shop?.organization || orgMap.get(p.organizationId)
      return {
        orgName: org?.name || 'Unknown',
        productName: p.name,
        quantity: p.quantity,
        category: p.productType.name,
      }
    })

    // Fast moving products (highest sales volume, last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const saleItems = await db.saleItem.findMany({
      where: {
        sale: {
          status: 'completed',
          saleDate: { gte: sixMonthsAgo },
          ...(regionId ? { organization: { regionId } } : {}),
        }
      },
      select: {
        productId: true,
        quantity: true,
        total: true,
        product: {
          select: {
            name: true,
            organizationId: true,
            productType: { select: { name: true } },
            shop: {
              select: {
                organization: { select: { name: true } },
              }
            },
          }
        }
      }
    })

    // Aggregate by product
    const productSalesMap = new Map<string, { name: string; orgName: string; category: string; quantitySold: number; revenue: number }>()
    saleItems.forEach(item => {
      // Skip items whose product was deleted (productId/product nullable after deletion)
      if (!item.product || !item.productId) return
      const orgName = item.product.shop?.organization?.name || orgMap.get(item.product.organizationId)?.name || 'Unknown'
      const existing = productSalesMap.get(item.productId)
      if (existing) {
        existing.quantitySold += item.quantity
        existing.revenue += item.total
      } else {
        productSalesMap.set(item.productId, {
          name: item.product.name,
          orgName,
          category: item.product.productType.name,
          quantitySold: item.quantity,
          revenue: item.total,
        })
      }
    })

    const fastMovingProducts = [...productSalesMap.values()]
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 20)

    // Demand by category (aggregate product type demand)
    const demandByCategory = new Map<string, { category: string; quantitySold: number; revenue: number }>()
    saleItems.forEach(item => {
      if (!item.product) return
      const cat = item.product.productType.name
      const existing = demandByCategory.get(cat)
      if (existing) {
        existing.quantitySold += item.quantity
        existing.revenue += item.total
      } else {
        demandByCategory.set(cat, {
          category: cat,
          quantitySold: item.quantity,
          revenue: item.total,
        })
      }
    })
    const demandByCategoryResult = [...demandByCategory.values()].sort((a, b) => b.revenue - a.revenue)

    // Supply opportunities: Products that are low/out of stock across multiple organizations
    // Count UNIQUE organizations per product type (not total products)
    const lowStockByType = new Map<string, { productType: string; orgNames: string[]; orgIds: Set<string> }>()
    filteredLowStock.forEach(p => {
      const typeName = p.productType.name
      const org = p.shop?.organization || orgMap.get(p.organizationId)
      const orgId = org?.id || p.organizationId
      const orgName = org?.name || 'Unknown'
      const existing = lowStockByType.get(typeName)
      if (existing) {
        if (!existing.orgIds.has(orgId)) {
          existing.orgIds.add(orgId)
          existing.orgNames.push(orgName)
        }
      } else {
        const orgIdSet = new Set<string>()
        orgIdSet.add(orgId)
        lowStockByType.set(typeName, {
          productType: typeName,
          orgNames: [orgName],
          orgIds: orgIdSet,
        })
      }
    })
    const supplyOpportunities = [...lowStockByType.values()]
      .map(({ orgIds, ...rest }) => ({ ...rest, lowStockCount: rest.orgNames.length }))
      .filter(s => s.lowStockCount >= 1)
      .sort((a, b) => b.lowStockCount - a.lowStockCount)

    // Top cities with most shops
    const orgsByCity = await db.organization.groupBy({
      by: ['city'],
      where: { city: { not: null }, ...orgWhere },
      _count: { city: true },
      orderBy: { _count: { city: 'desc' } },
      take: 10,
    })
    const topCities = orgsByCity.map(item => ({
      city: item.city,
      shopCount: item._count.city,
    }))

    // Business type distribution
    const orgsByType = await db.organization.groupBy({
      by: ['businessType'],
      where: orgWhere,
      _count: { businessType: true },
    })
    const businessTypeDistribution = orgsByType.map(item => ({
      businessType: item.businessType,
      count: item._count.businessType,
    }))

    // Average revenue by business type (last 6 months)
    const allOrgsWithSales = await db.organization.findMany({
      where: orgWhere,
      select: {
        businessType: true,
        sales: {
          where: { status: 'completed', saleDate: { gte: sixMonthsAgo } },
          select: { total: true }
        }
      }
    })

    const revenueByType = new Map<string, { total: number; count: number }>()
    allOrgsWithSales.forEach(org => {
      const orgRevenue = org.sales.reduce((sum, s) => sum + s.total, 0)
      const existing = revenueByType.get(org.businessType)
      if (existing) {
        existing.total += orgRevenue
        existing.count++
      } else {
        revenueByType.set(org.businessType, { total: orgRevenue, count: 1 })
      }
    })
    const averageRevenueByType = [...revenueByType.entries()].map(([type, data]) => ({
      businessType: type,
      averageRevenue: data.count > 0 ? Math.round(data.total / data.count) : 0,
      totalRevenue: data.total,
      organizationCount: data.count,
    }))

    return NextResponse.json({
      lowStockProducts: lowStockResult,
      fastMovingProducts,
      demandByCategory: demandByCategoryResult,
      supplyOpportunities,
      topCities,
      businessTypeDistribution,
      averageRevenueByType,
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Admin market insights error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

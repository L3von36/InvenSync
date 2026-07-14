import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess, canReadFinancials } from '@/lib/auth'
import { requireModule } from '@/lib/module-guard'
import { isDatabaseError } from '@/lib/api-error'
import {
  ETHIOPIA_TAX_CONFIG,
  TAX_DISCLAIMER,
  suggestCategory,
  computeCategoryBTax,
  computeCategoryATax,
  getFiscalYearBounds,
  getTaxDeadlines,
  getThresholdStatus,
  type TaxProfile,
} from '@/lib/tax/ethiopia'

const TAX_PROFILE_CONFIG_TYPE = 'tax-profile'

const DEFAULT_PROFILE: TaxProfile = {
  legalForm: 'individual',
  vatRegistered: false,
  isProfessional: false,
  keepsBooks: false,
  hasEmployees: false,
}

async function loadProfile(orgId: string): Promise<{ profile: TaxProfile; configured: boolean }> {
  const row = await db.integrationConfig.findFirst({
    where: { organizationId: orgId, type: TAX_PROFILE_CONFIG_TYPE },
  })
  if (!row) return { profile: DEFAULT_PROFILE, configured: false }
  try {
    return { profile: { ...DEFAULT_PROFILE, ...JSON.parse(row.config) }, configured: true }
  } catch {
    return { profile: DEFAULT_PROFILE, configured: false }
  }
}

// GET /api/tax?orgId=xxx — tax estimates, thresholds, and deadlines
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Tax data is financial — org owners/managers only
    if (!canReadFinancials(user, orgId)) {
      return NextResponse.json({ error: 'Forbidden: tax data is available to owners and managers only' }, { status: 403 })
    }

    const moduleError = await requireModule(orgId, 'tax-assistant')
    if (moduleError) return moduleError

    const now = new Date()
    const fy = getFiscalYearBounds(now)
    const trailingStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

    const [profileResult, fyRevenue, trailingRevenue, fyExpenses, fyCogsResult] = await Promise.all([
      loadProfile(orgId),
      // Fiscal-year-to-date gross sales (org-wide — tax is assessed per taxpayer, not per shop)
      db.sale.aggregate({
        where: { organizationId: orgId, status: 'completed', saleDate: { gte: fy.start } },
        _sum: { total: true },
        _count: true,
      }),
      // Trailing 12-month turnover for threshold monitoring
      db.sale.aggregate({
        where: { organizationId: orgId, status: 'completed', saleDate: { gte: trailingStart } },
        _sum: { total: true },
      }),
      // Fiscal-year-to-date deductible expenses
      db.expense.aggregate({
        where: { organizationId: orgId, expenseDate: { gte: fy.start } },
        _sum: { amount: true },
      }),
      // Fiscal-year-to-date cost of goods sold
      db.$queryRaw<Array<{ cogs: number | bigint }>>(
        Prisma.sql`
          SELECT COALESCE(SUM(si."costPrice" * si.quantity), 0) as cogs
          FROM "SaleItem" si
          JOIN "Sale" s ON si."saleId" = s.id
          WHERE s."organizationId" = ${orgId} AND s.status = 'completed'
          AND s."saleDate" >= ${fy.start}
        `
      ),
    ])

    const { profile, configured } = profileResult
    const ytdGrossSales = Number(fyRevenue._sum.total || 0)
    const ytdSalesCount = Number(fyRevenue._count || 0)
    const trailing12moTurnover = Number(trailingRevenue._sum.total || 0)
    const ytdExpenses = Number(fyExpenses._sum.amount || 0)
    const ytdCogs = Number(fyCogsResult[0]?.cogs ?? 0)
    const ytdTaxableIncome = ytdGrossSales - ytdCogs - ytdExpenses

    // Linear projection of gross sales to fiscal year end (labelled as such)
    const daysElapsed = Math.max(1, (now.getTime() - fy.start.getTime()) / (24 * 60 * 60 * 1000))
    const fyDays = (fy.end.getTime() - fy.start.getTime()) / (24 * 60 * 60 * 1000)
    const projectedGrossSales = (ytdGrossSales / daysElapsed) * fyDays

    const category = suggestCategory(trailing12moTurnover, profile)

    // Estimates for the applicable regime (plus the projection)
    const estimate =
      category === 'B'
        ? {
            regime: 'B' as const,
            ytd: computeCategoryBTax(ytdGrossSales),
            projected: computeCategoryBTax(projectedGrossSales),
          }
        : {
            regime: 'A' as const,
            ytd: computeCategoryATax(ytdTaxableIncome, ytdGrossSales, profile.legalForm),
            projected: computeCategoryATax(
              (ytdTaxableIncome / daysElapsed) * fyDays,
              projectedGrossSales,
              profile.legalForm
            ),
          }

    return NextResponse.json({
      profile,
      configured,
      category,
      fiscalYear: { start: fy.start.toISOString(), end: fy.end.toISOString(), label: fy.label },
      figures: {
        ytdGrossSales,
        ytdSalesCount,
        ytdCogs,
        ytdExpenses,
        ytdTaxableIncome,
        projectedGrossSales,
        trailing12moTurnover,
      },
      estimate,
      threshold: getThresholdStatus(trailing12moTurnover),
      deadlines: getTaxDeadlines(now, profile).map((d) => ({ ...d, due: d.due.toISOString() })),
      config: {
        effectiveFrom: ETHIOPIA_TAX_CONFIG.effectiveFrom,
        legalBasis: ETHIOPIA_TAX_CONFIG.legalBasis,
        categoryThresholdETB: ETHIOPIA_TAX_CONFIG.categoryThresholdETB,
        categoryBBands: ETHIOPIA_TAX_CONFIG.categoryBBands,
        individualBusinessBands: ETHIOPIA_TAX_CONFIG.individualBusinessBands,
        corporateRate: ETHIOPIA_TAX_CONFIG.corporateRate,
        matRate: ETHIOPIA_TAX_CONFIG.matRate,
        vat: ETHIOPIA_TAX_CONFIG.vat,
        withholding: ETHIOPIA_TAX_CONFIG.withholding,
        cashPaymentCapETB: ETHIOPIA_TAX_CONFIG.cashPaymentCapETB,
      },
      disclaimer: TAX_DISCLAIMER,
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Tax summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/tax?orgId=xxx — save the organization's tax profile
export async function PUT(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!canReadFinancials(user, orgId)) {
      return NextResponse.json({ error: 'Forbidden: owners and managers only' }, { status: 403 })
    }

    const moduleError = await requireModule(orgId, 'tax-assistant')
    if (moduleError) return moduleError

    const body = await request.json()
    const profile: TaxProfile = {
      legalForm: body.legalForm === 'entity' ? 'entity' : 'individual',
      vatRegistered: Boolean(body.vatRegistered),
      isProfessional: Boolean(body.isProfessional),
      keepsBooks: Boolean(body.keepsBooks),
      hasEmployees: Boolean(body.hasEmployees),
      tinNumber: typeof body.tinNumber === 'string' ? body.tinNumber.slice(0, 20) : undefined,
    }

    const existing = await db.integrationConfig.findFirst({
      where: { organizationId: orgId, type: TAX_PROFILE_CONFIG_TYPE },
    })
    if (existing) {
      await db.integrationConfig.update({
        where: { id: existing.id },
        data: { config: JSON.stringify(profile), isActive: true },
      })
    } else {
      await db.integrationConfig.create({
        data: {
          organizationId: orgId,
          type: TAX_PROFILE_CONFIG_TYPE,
          config: JSON.stringify(profile),
          isActive: true,
        },
      })
    }

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Tax profile save error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

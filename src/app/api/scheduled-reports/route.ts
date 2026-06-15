import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/scheduled-reports?organizationId=xxx
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const reports = await db.scheduledReport.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ reports })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('List scheduled reports error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/scheduled-reports
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
    const { organizationId, name, reportType, frequency, deliveryMethod, deliveryConfig } = body

    if (!organizationId || !name || !reportType || !frequency || !deliveryMethod) {
      return NextResponse.json(
        { error: 'organizationId, name, reportType, frequency, and deliveryMethod are required' },
        { status: 400 }
      )
    }

    const validReportTypes = ['daily_sales', 'weekly_summary', 'monthly_pnl', 'inventory_status']
    if (!validReportTypes.includes(reportType)) {
      return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    const validFrequencies = ['daily', 'weekly', 'monthly']
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
    }

    const validDeliveryMethods = ['email', 'telegram', 'whatsapp']
    if (!validDeliveryMethods.includes(deliveryMethod)) {
      return NextResponse.json({ error: 'Invalid delivery method' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Calculate next send date
    const now = new Date()
    let nextSendAt: Date
    switch (frequency) {
      case 'daily':
        nextSendAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0)
        break
      case 'weekly':
        const daysUntilMonday = ((8 - now.getDay()) % 7) || 7
        nextSendAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday, 8, 0, 0)
        break
      case 'monthly':
        nextSendAt = new Date(now.getFullYear(), now.getMonth() + 1, 1, 8, 0, 0)
        break
      default:
        nextSendAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0)
    }

    const report = await db.scheduledReport.create({
      data: {
        organizationId,
        name,
        reportType,
        frequency,
        deliveryMethod,
        deliveryConfig: deliveryConfig ? JSON.stringify(deliveryConfig) : '{}',
        isActive: true,
        nextSendAt,
      },
    })

    return NextResponse.json({ report }, { status: 201 })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Create scheduled report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

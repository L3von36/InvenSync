import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

// DELETE /api/scheduled-reports/[id]?organizationId=xxx
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
    const organizationId = searchParams.get('organizationId')
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await db.scheduledReport.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Scheduled report not found' }, { status: 404 })
    }

    await db.scheduledReport.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Delete scheduled report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/scheduled-reports/[id]
export async function PUT(
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
    const { organizationId, name, reportType, frequency, deliveryMethod, deliveryConfig, isActive } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await db.scheduledReport.findFirst({
      where: { id, organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Scheduled report not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (reportType !== undefined) {
      const validReportTypes = ['daily_sales', 'weekly_summary', 'monthly_pnl', 'inventory_status']
      if (!validReportTypes.includes(reportType)) {
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
      }
      updateData.reportType = reportType
    }
    if (frequency !== undefined) {
      const validFrequencies = ['daily', 'weekly', 'monthly']
      if (!validFrequencies.includes(frequency)) {
        return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
      }
      updateData.frequency = frequency
    }
    if (deliveryMethod !== undefined) {
      const validDeliveryMethods = ['email', 'telegram', 'whatsapp']
      if (!validDeliveryMethods.includes(deliveryMethod)) {
        return NextResponse.json({ error: 'Invalid delivery method' }, { status: 400 })
      }
      updateData.deliveryMethod = deliveryMethod
    }
    if (deliveryConfig !== undefined) {
      updateData.deliveryConfig = JSON.stringify(deliveryConfig)
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive
      // Recalculate nextSendAt when reactivating
      if (isActive && !existing.nextSendAt) {
        const now = new Date()
        const freq = (updateData.frequency as string) || existing.frequency
        let nextSendAt: Date
        switch (freq) {
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
        updateData.nextSendAt = nextSendAt
      } else if (!isActive) {
        updateData.nextSendAt = null
      }
    }

    const report = await db.scheduledReport.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ report })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Update scheduled report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

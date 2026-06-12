import { NextResponse } from 'next/server'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiHandler, requireAuth, requireOrgAccess, handleApiError, isDatabaseError } from '@/lib/api-error'

// GET /api/integrations/whatsapp — Get current WhatsApp config for an organization
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

    // FIX: Added await — verifyOrgAccess is async!
    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const config = await db.integrationConfig.findFirst({
      where: { organizationId, type: 'whatsapp' },
    })

    if (!config) {
      return NextResponse.json({ config: null })
    }

    let parsedConfig: Record<string, unknown>
    try {
      parsedConfig = JSON.parse(config.config)
    } catch {
      // Corrupted config data — delete it and return null
      console.error('[WhatsAppAPI] Corrupted config data for org:', organizationId)
      await db.integrationConfig.delete({ where: { id: config.id } }).catch(() => {})
      return NextResponse.json({ config: null })
    }

    // Mask the API key for security
    const apiKey = typeof parsedConfig.apiKey === 'string' ? parsedConfig.apiKey : ''
    const maskedApiKey = apiKey ? apiKey.substring(0, 8) + '***' : ''

    return NextResponse.json({
      config: {
        id: config.id,
        type: config.type,
        isActive: config.isActive,
        phoneNumber: (parsedConfig.phoneNumber as string) || '',
        apiKeyMasked: maskedApiKey,
        notificationTypes: (parsedConfig.notificationTypes as Record<string, boolean>) || {
          low_stock: true,
          debt_reminder: true,
          daily_summary: false,
          new_sale: false,
        },
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('[WhatsAppAPI] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/integrations/whatsapp — Set up WhatsApp integration
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { organizationId, phoneNumber, apiKey, notificationTypes } = body as {
      organizationId?: string
      phoneNumber?: string
      apiKey?: string
      notificationTypes?: Record<string, boolean>
    }

    if (!organizationId || !phoneNumber || !apiKey) {
      return NextResponse.json(
        { error: 'organizationId, phoneNumber, and apiKey are required' },
        { status: 400 }
      )
    }

    // FIX: Added await — verifyOrgAccess is async!
    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const configData = {
      phoneNumber,
      apiKey,
      notificationTypes: notificationTypes || {
        low_stock: true,
        debt_reminder: true,
        daily_summary: false,
        new_sale: false,
      },
    }

    // Upsert the integration config
    const existing = await db.integrationConfig.findFirst({
      where: { organizationId, type: 'whatsapp' },
    })

    let config
    if (existing) {
      config = await db.integrationConfig.update({
        where: { id: existing.id },
        data: {
          config: JSON.stringify(configData),
          isActive: true,
        },
      })
    } else {
      config = await db.integrationConfig.create({
        data: {
          organizationId,
          type: 'whatsapp',
          config: JSON.stringify(configData),
          isActive: true,
        },
      })
    }

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        type: config.type,
        isActive: config.isActive,
        phoneNumber,
        notificationTypes: configData.notificationTypes,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('[WhatsAppAPI] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/integrations/whatsapp — Remove WhatsApp integration
export async function DELETE(request: Request) {
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

    // FIX: Added await — verifyOrgAccess is async!
    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const existing = await db.integrationConfig.findFirst({
      where: { organizationId, type: 'whatsapp' },
    })

    if (!existing) {
      return NextResponse.json({ error: 'WhatsApp integration not found' }, { status: 404 })
    }

    await db.integrationConfig.delete({
      where: { id: existing.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('[WhatsAppAPI] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

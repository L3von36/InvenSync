import { NextResponse } from 'next/server'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { db } from '@/lib/db'
import { isDatabaseError } from '@/lib/api-error'

// GET /api/integrations/telegram — Get current Telegram config for an organization
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
      where: { organizationId, type: 'telegram' },
    })

    if (!config) {
      return NextResponse.json({ config: null })
    }

    let parsedConfig: Record<string, unknown>
    try {
      parsedConfig = JSON.parse(config.config)
    } catch {
      // Corrupted config data — delete it and return null
      console.error('[TelegramAPI] Corrupted config data for org:', organizationId)
      await db.integrationConfig.delete({ where: { id: config.id } }).catch(() => {})
      return NextResponse.json({ config: null })
    }

    // Mask the bot token for security
    const botToken = typeof parsedConfig.botToken === 'string' ? parsedConfig.botToken : ''
    const maskedToken = botToken ? botToken.substring(0, 10) + '***' : ''

    return NextResponse.json({
      config: {
        id: config.id,
        type: config.type,
        isActive: config.isActive,
        chatId: (parsedConfig.chatId as string) || '',
        botTokenMasked: maskedToken,
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
    console.error('[TelegramAPI] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/integrations/telegram — Set up Telegram bot
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

    const { organizationId, botToken, chatId, notificationTypes } = body as {
      organizationId?: string
      botToken?: string
      chatId?: string
      notificationTypes?: Record<string, boolean>
    }

    if (!organizationId || !botToken || !chatId) {
      return NextResponse.json(
        { error: 'organizationId, botToken, and chatId are required' },
        { status: 400 }
      )
    }

    // FIX: Added await — verifyOrgAccess is async!
    const hasAccess = await verifyOrgAccess(user, organizationId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Verify the bot token by calling getMe
    try {
      const meResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
        signal: AbortSignal.timeout(10000), // 10s timeout
      })
      const meData = await meResponse.json()
      if (!meData.ok) {
        return NextResponse.json(
          { error: 'Invalid bot token. Please check your token and try again.' },
          { status: 400 }
        )
      }
    } catch (verifyErr) {
      console.error('[TelegramAPI] Bot verification error:', verifyErr)
      return NextResponse.json(
        { error: 'Could not verify bot token. Please check your connection and token.' },
        { status: 400 }
      )
    }

    const configData = {
      botToken,
      chatId,
      notificationTypes: notificationTypes || {
        low_stock: true,
        debt_reminder: true,
        daily_summary: false,
        new_sale: false,
      },
    }

    // Upsert the integration config
    const existing = await db.integrationConfig.findFirst({
      where: { organizationId, type: 'telegram' },
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
          type: 'telegram',
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
        chatId,
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
    console.error('[TelegramAPI] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/integrations/telegram — Remove Telegram integration
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
      where: { organizationId, type: 'telegram' },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Telegram integration not found' }, { status: 404 })
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
    console.error('[TelegramAPI] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

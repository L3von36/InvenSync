'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Send, MessageSquare, Loader2, Check, X, Trash2, Bell,
  AlertTriangle, HandCoins, TrendingUp, ShoppingCart
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { getNetworkErrorMessage } from '@/lib/validation'

type ConnectionStatus = 'disconnected' | 'connected' | 'testing'

interface NotificationTypes {
  low_stock: boolean
  debt_reminder: boolean
  daily_summary: boolean
  new_sale: boolean
}

interface TelegramConfig {
  id: string
  type: string
  isActive: boolean
  chatId: string
  botTokenMasked: string
  notificationTypes: NotificationTypes
  createdAt: string
  updatedAt: string
}

interface WhatsAppConfig {
  id: string
  type: string
  isActive: boolean
  phoneNumber: string
  apiKeyMasked: string
  notificationTypes: NotificationTypes
  createdAt: string
  updatedAt: string
}

const NOTIFICATION_TYPE_INFO: Record<keyof NotificationTypes, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  low_stock: { label: 'Low Stock', icon: AlertTriangle, description: 'Alert when products are running low' },
  debt_reminder: { label: 'Debt Reminders', icon: HandCoins, description: 'Remind about overdue debts' },
  daily_summary: { label: 'Daily Summary', icon: TrendingUp, description: 'Daily sales and inventory summary' },
  new_sale: { label: 'New Sale', icon: ShoppingCart, description: 'Notification on every new sale' },
}

export function IntegrationsTab({ orgId }: { orgId: string }) {
  // Telegram state
  const [telegramEnabled, setTelegramEnabled] = useState(false)
  const [telegramBotToken, setTelegramBotToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [telegramStatus, setTelegramStatus] = useState<ConnectionStatus>('disconnected')
  const [telegramNotificationTypes, setTelegramNotificationTypes] = useState<NotificationTypes>({
    low_stock: true,
    debt_reminder: true,
    daily_summary: false,
    new_sale: false,
  })
  const [telegramSaving, setTelegramSaving] = useState(false)
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig | null>(null)

  // WhatsApp state
  const [whatsappEnabled, setWhatsappEnabled] = useState(false)
  const [whatsappApiKey, setWhatsappApiKey] = useState('')
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [whatsappStatus, setWhatsappStatus] = useState<ConnectionStatus>('disconnected')
  const [whatsappNotificationTypes, setWhatsappNotificationTypes] = useState<NotificationTypes>({
    low_stock: true,
    debt_reminder: true,
    daily_summary: false,
    new_sale: false,
  })
  const [whatsappSaving, setWhatsappSaving] = useState(false)
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig | null>(null)

  const [loading, setLoading] = useState(true)

  // Fetch existing configurations
  const fetchConfigs = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [telegramRes, whatsappRes] = await Promise.all([
        api.getTelegramConfig(orgId),
        api.getWhatsappConfig(orgId),
      ])

      if (telegramRes.config) {
        const cfg = telegramRes.config as TelegramConfig
        setTelegramConfig(cfg)
        setTelegramEnabled(cfg.isActive)
        setTelegramChatId(cfg.chatId || '')
        setTelegramStatus(cfg.isActive ? 'connected' : 'disconnected')
        setTelegramNotificationTypes(cfg.notificationTypes || {
          low_stock: true, debt_reminder: true, daily_summary: false, new_sale: false,
        })
      }

      if (whatsappRes.config) {
        const cfg = whatsappRes.config as WhatsAppConfig
        setWhatsappConfig(cfg)
        setWhatsappEnabled(cfg.isActive)
        setWhatsappPhone(cfg.phoneNumber || '')
        setWhatsappStatus(cfg.isActive ? 'connected' : 'disconnected')
        setWhatsappNotificationTypes(cfg.notificationTypes || {
          low_stock: true, debt_reminder: true, daily_summary: false, new_sale: false,
        })
      }
    } catch (err) {
      console.error('Failed to fetch integration configs:', err)
      // Without this the tab renders as "nothing configured", which could
      // mislead a user into reconfiguring from scratch
      toast.error('Could not load integration settings. Refresh the page to retry.')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  // Telegram handlers
  const handleTelegramToggle = (enabled: boolean) => {
    setTelegramEnabled(enabled)
    if (!enabled) {
      setTelegramStatus('disconnected')
    }
  }

  const handleTelegramSave = async () => {
    if (!telegramBotToken && !telegramConfig) {
      toast.error('Please enter a bot token')
      return
    }
    if (!telegramChatId) {
      toast.error('Please enter a chat ID')
      return
    }
    setTelegramSaving(true)
    try {
      await api.saveTelegramConfig(orgId, {
        botToken: telegramBotToken || undefined,
        chatId: telegramChatId,
        notificationTypes: telegramNotificationTypes,
      })
      toast.success('Telegram integration saved successfully')
      setTelegramStatus('connected')
      fetchConfigs()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setTelegramSaving(false)
    }
  }

  const handleTelegramTest = async () => {
    if (!telegramConfig?.isActive && !telegramBotToken) {
      toast.error('Please save your Telegram configuration first')
      return
    }
    setTelegramStatus('testing')
    try {
      const result = await api.testIntegration(orgId, 'telegram')
      if (result.success) {
        setTelegramStatus('connected')
        toast.success('Test message sent via Telegram!')
      } else {
        setTelegramStatus(telegramConfig?.isActive ? 'connected' : 'disconnected')
        toast.error(result.error || 'Test failed')
      }
    } catch (err) {
      setTelegramStatus(telegramConfig?.isActive ? 'connected' : 'disconnected')
      toast.error(getNetworkErrorMessage(err))
    }
  }

  const handleTelegramRemove = async () => {
    try {
      await api.deleteTelegramConfig(orgId)
      setTelegramEnabled(false)
      setTelegramBotToken('')
      setTelegramChatId('')
      setTelegramStatus('disconnected')
      setTelegramConfig(null)
      setTelegramNotificationTypes({
        low_stock: true, debt_reminder: true, daily_summary: false, new_sale: false,
      })
      toast.success('Telegram integration removed')
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    }
  }

  // WhatsApp handlers
  const handleWhatsappToggle = (enabled: boolean) => {
    setWhatsappEnabled(enabled)
    if (!enabled) {
      setWhatsappStatus('disconnected')
    }
  }

  const handleWhatsappSave = async () => {
    if (!whatsappApiKey && !whatsappConfig) {
      toast.error('Please enter an API key')
      return
    }
    if (!whatsappPhone) {
      toast.error('Please enter a phone number')
      return
    }
    setWhatsappSaving(true)
    try {
      await api.saveWhatsappConfig(orgId, {
        phoneNumber: whatsappPhone,
        apiKey: whatsappApiKey || undefined,
        notificationTypes: whatsappNotificationTypes,
      })
      toast.success('WhatsApp integration saved successfully')
      setWhatsappStatus('connected')
      fetchConfigs()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setWhatsappSaving(false)
    }
  }

  const handleWhatsappTest = async () => {
    if (!whatsappConfig?.isActive && !whatsappApiKey) {
      toast.error('Please save your WhatsApp configuration first')
      return
    }
    setWhatsappStatus('testing')
    try {
      const result = await api.testIntegration(orgId, 'whatsapp')
      if (result.success) {
        setWhatsappStatus('connected')
        toast.success('Test message sent via WhatsApp!')
      } else {
        setWhatsappStatus(whatsappConfig?.isActive ? 'connected' : 'disconnected')
        toast.error(result.error || 'Test failed')
      }
    } catch (err) {
      setWhatsappStatus(whatsappConfig?.isActive ? 'connected' : 'disconnected')
      toast.error(getNetworkErrorMessage(err))
    }
  }

  const handleWhatsappRemove = async () => {
    try {
      await api.deleteWhatsappConfig(orgId)
      setWhatsappEnabled(false)
      setWhatsappApiKey('')
      setWhatsappPhone('')
      setWhatsappStatus('disconnected')
      setWhatsappConfig(null)
      setWhatsappNotificationTypes({
        low_stock: true, debt_reminder: true, daily_summary: false, new_sale: false,
      })
      toast.success('WhatsApp integration removed')
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-muted animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-60 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Telegram Bot */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                <Send className="size-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Telegram Bot
                  {telegramConfig?.isActive && (
                    <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Active
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Get inventory & sales updates via Telegram</CardDescription>
              </div>
            </div>
            <Switch
              checked={telegramEnabled}
              onCheckedChange={handleTelegramToggle}
            />
          </div>
        </CardHeader>
        {telegramEnabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="telegram-bot-token">Bot Token</Label>
              <Input
                id="telegram-bot-token"
                placeholder={telegramConfig?.botTokenMasked || '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'}
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                Get your bot token from @BotFather on Telegram
                {telegramConfig?.botTokenMasked && ' — Leave empty to keep current token'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegram-chat-id">Chat ID</Label>
              <Input
                id="telegram-chat-id"
                placeholder="-1001234567890"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The chat ID where notifications will be sent. Use @userinfobot to find your chat ID.
              </p>
            </div>

            {/* Notification Types */}
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Bell className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Notification Types</p>
              </div>
              <div className="space-y-3">
                {(Object.keys(NOTIFICATION_TYPE_INFO) as Array<keyof NotificationTypes>).map((key) => {
                  const info = NOTIFICATION_TYPE_INFO[key]
                  const Icon = info.icon
                  return (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Icon className="size-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{info.label}</p>
                          <p className="text-xs text-muted-foreground">{info.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={telegramNotificationTypes[key]}
                        onCheckedChange={(checked) =>
                          setTelegramNotificationTypes((prev) => ({ ...prev, [key]: checked }))
                        }
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleTelegramSave}
                disabled={telegramSaving}
                className="gap-2"
              >
                {telegramSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Save
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleTelegramTest}
                disabled={telegramStatus === 'testing' || !telegramConfig?.isActive}
              >
                {telegramStatus === 'testing' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Test Connection
              </Button>
              {telegramConfig && (
                <Button
                  variant="outline"
                  className="gap-2 text-destructive hover:text-destructive"
                  onClick={handleTelegramRemove}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              )}
              <StatusIndicator status={telegramStatus} />
            </div>

            {/* Available Commands */}
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2">Available Commands</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { cmd: '/stock', desc: 'Check current stock levels' },
                  { cmd: '/sales', desc: "View today's sales summary" },
                  { cmd: '/profit', desc: 'View profit report' },
                  { cmd: '/debts', desc: 'View outstanding debts' },
                ].map((c) => (
                  <div key={c.cmd} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                    <code className="text-xs font-mono bg-background px-1.5 py-0.5 rounded border">
                      {c.cmd}
                    </code>
                    <span className="text-muted-foreground">{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* WhatsApp Business API */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <MessageSquare className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  WhatsApp Business API
                  {whatsappConfig?.isActive && (
                    <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Active
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Send notifications and receive orders via WhatsApp</CardDescription>
              </div>
            </div>
            <Switch
              checked={whatsappEnabled}
              onCheckedChange={handleWhatsappToggle}
            />
          </div>
        </CardHeader>
        {whatsappEnabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp-phone">Phone Number</Label>
              <Input
                id="whatsapp-phone"
                placeholder="+251912345678"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your WhatsApp Business phone number with country code
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-api-key">API Key</Label>
              <Input
                id="whatsapp-api-key"
                placeholder={whatsappConfig?.apiKeyMasked || 'Enter your WhatsApp Business API key'}
                value={whatsappApiKey}
                onChange={(e) => setWhatsappApiKey(e.target.value)}
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                {whatsappConfig?.apiKeyMasked
                  ? 'Leave empty to keep current API key'
                  : 'Get your API key from the WhatsApp Business Platform'}
              </p>
            </div>

            {/* Notification Types */}
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Bell className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Notification Types</p>
              </div>
              <div className="space-y-3">
                {(Object.keys(NOTIFICATION_TYPE_INFO) as Array<keyof NotificationTypes>).map((key) => {
                  const info = NOTIFICATION_TYPE_INFO[key]
                  const Icon = info.icon
                  return (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Icon className="size-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{info.label}</p>
                          <p className="text-xs text-muted-foreground">{info.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={whatsappNotificationTypes[key]}
                        onCheckedChange={(checked) =>
                          setWhatsappNotificationTypes((prev) => ({ ...prev, [key]: checked }))
                        }
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleWhatsappSave}
                disabled={whatsappSaving}
                className="gap-2"
              >
                {whatsappSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Save
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleWhatsappTest}
                disabled={whatsappStatus === 'testing' || !whatsappConfig?.isActive}
              >
                {whatsappStatus === 'testing' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageSquare className="size-4" />
                )}
                Test Connection
              </Button>
              {whatsappConfig && (
                <Button
                  variant="outline"
                  className="gap-2 text-destructive hover:text-destructive"
                  onClick={handleWhatsappRemove}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              )}
              <StatusIndicator status={whatsappStatus} />
            </div>

            {/* Info banner */}
            <div className="rounded-lg border border-dashed p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> WhatsApp Business API requires Meta Business verification.
                This integration uses a simulation mode for testing. For production use,
                connect your verified WhatsApp Business API provider.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

// ============================================
// Status Indicator
// ============================================
function StatusIndicator({ status }: { status: ConnectionStatus }) {
  if (status === 'testing') {
    return (
      <div className="flex items-center gap-2 text-sm text-yellow-600">
        <Loader2 className="size-4 animate-spin" />
        <span>Testing...</span>
      </div>
    )
  }
  if (status === 'connected') {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600">
        <Check className="size-4" />
        <span>Connected</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <X className="size-4" />
      <span>Not Connected</span>
    </div>
  )
}

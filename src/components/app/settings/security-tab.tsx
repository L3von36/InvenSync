'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import {
  Shield, ShieldCheck, ShieldOff, QrCode, KeyRound, Monitor, Smartphone,
  Tablet, Loader2, Trash2, AlertTriangle, RefreshCw, Copy, Check,
  Globe, Chrome, Apple
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

// ============================================
// Device Icon helper
// ============================================
function getDeviceIcon(deviceType: string | null) {
  switch (deviceType) {
    case 'mobile':
      return <Smartphone className="size-5" />
    case 'tablet':
      return <Tablet className="size-5" />
    default:
      return <Monitor className="size-5" />
  }
}

function getBrowserIcon(browser: string | null) {
  if (!browser) return <Globe className="size-4" />
  const lower = browser.toLowerCase()
  if (lower.includes('chrome')) return <Chrome className="size-4" />
  if (lower.includes('safari')) return <Apple className="size-4" />
  if (lower.includes('firefox')) return <Globe className="size-4" />
  return <Globe className="size-4" />
}

// ============================================
// Two-Factor Authentication Section
// ============================================
function TwoFactorSection() {
  const { user, token } = useAuthStore()
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [setupStep, setSetupStep] = useState<'idle' | 'setup' | 'verify' | 'backup-codes'>('idle')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verifyCode, setVerifyCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [regenerateCode, setRegenerateCode] = useState('')

  // Fetch current 2FA status from /api/auth/me (returns twoFactorEnabled)
  const fetch2faStatus = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await authFetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setEnabled(!!data.user?.twoFactorEnabled)
      } else {
        toast.error('Could not load two-factor status')
      }
    } catch {
      toast.error('Could not load two-factor status — check your connection')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetch2faStatus()
  }, [fetch2faStatus])

  const handleSetup = async () => {
    if (!user) return
    setSubmitting(true)
    try {
      const data = await api.setup2fa(user.id)
      setQrCodeUrl(data.qrCodeUrl)
      setSecret(data.secret)
      setBackupCodes(data.backupCodes)
      setSetupStep('setup')
      toast.success('Scan the QR code with your authenticator app')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('already enabled')) {
        setEnabled(true)
        toast.info('Two-factor authentication is already enabled')
      } else {
        toast.error(msg || 'Failed to set up 2FA')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifySetup = async () => {
    if (!user || verifyCode.length !== 6) return
    setSubmitting(true)
    try {
      const result = await api.verify2faSetup(user.id, verifyCode)
      if (result.success) {
        setEnabled(true)
        setSetupStep('backup-codes')
        toast.success('Two-factor authentication enabled!')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg || 'Invalid verification code')
      setVerifyCode('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDisable = async () => {
    if (!user || !disableCode) return
    setSubmitting(true)
    try {
      const result = await api.disable2fa(user.id, disableCode)
      if (result.success) {
        setEnabled(false)
        setDisableCode('')
        setSetupStep('idle')
        setShowDisableDialog(false)
        toast.success('Two-factor authentication disabled')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg || 'Failed to disable 2FA')
      setDisableCode('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegenerateCodes = async () => {
    if (!user || regenerateCode.length !== 6) return
    setSubmitting(true)
    try {
      const data = await api.regenerateBackupCodes(regenerateCode)
      setBackupCodes(data.backupCodes)
      setSetupStep('backup-codes')
      setShowRegenerateDialog(false)
      setRegenerateCode('')
      toast.success('New backup codes generated — your old codes no longer work')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg || 'Failed to regenerate backup codes')
      setRegenerateCode('')
    } finally {
      setSubmitting(false)
    }
  }

  const copyToClipboard = (text: string, codeIndex?: string) => {
    navigator.clipboard.writeText(text)
    if (codeIndex) {
      setCopiedCode(codeIndex)
      setTimeout(() => setCopiedCode(null), 2000)
    } else {
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2000)
    }
    toast.success('Copied to clipboard')
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {enabled ? (
            <ShieldCheck className="size-5 text-emerald-600" />
          ) : (
            <Shield className="size-5" />
          )}
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account by requiring a verification code in addition to your password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status indicator */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            {enabled ? (
              <>
                <div className="flex items-center justify-center size-10 rounded-full bg-emerald-100 dark:bg-emerald-950">
                  <ShieldCheck className="size-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium">Enabled</p>
                  <p className="text-sm text-muted-foreground">Your account is protected with 2FA</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center size-10 rounded-full bg-amber-100 dark:bg-amber-950">
                  <ShieldOff className="size-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium">Disabled</p>
                  <p className="text-sm text-muted-foreground">Your account is not protected with 2FA</p>
                </div>
              </>
            )}
          </div>
          {enabled ? (
            <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  Disable 2FA
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disable Two-Factor Authentication</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the extra layer of security from your account. Please enter your current 2FA code to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="disable-code">Verification Code</Label>
                  <Input
                    id="disable-code"
                    type="text"
                    placeholder="Enter 6-digit code or backup code"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    maxLength={9}
                    autoComplete="off"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDisable}
                    disabled={submitting || !disableCode}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    Disable 2FA
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              onClick={handleSetup}
              disabled={submitting}
              size="sm"
            >
              {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Enable 2FA
            </Button>
          )}
        </div>

        {/* Setup Flow */}
        {setupStep === 'setup' && !enabled && (
          <div className="space-y-4 border rounded-lg p-4">
            <div className="flex items-center gap-2">
              <QrCode className="size-5 text-primary" />
              <h3 className="font-medium">Step 1: Scan QR Code</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>

            {/* QR Code Display */}
            <div className="flex justify-center p-4 bg-white rounded-lg border">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl)}`}
                alt="2FA QR Code"
                className="size-48"
                loading="lazy"
              />
            </div>

            {/* Manual Entry */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Can&apos;t scan? Enter this code manually:</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">
                  {secret}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 md:size-8 shrink-0"
                  onClick={() => copyToClipboard(secret)}
                >
                  {copiedSecret ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Verify Step */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="size-5 text-primary" />
                <h3 className="font-medium">Step 2: Verify Code</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code from your authenticator app to verify setup
              </p>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={verifyCode}
                  onChange={setVerifyCode}
                  disabled={submitting}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSetupStep('idle')}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleVerifySetup}
                  disabled={submitting || verifyCode.length !== 6}
                >
                  {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Verify & Enable
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Backup Codes Display */}
        {setupStep === 'backup-codes' && enabled && (
          <div className="space-y-4 border rounded-lg p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" />
              <h3 className="font-medium">Backup Codes</h3>
            </div>

            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Save these codes in a safe place.</strong> Each code can only be used once. If you lose access to your authenticator app, you can use these codes to sign in.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted rounded font-mono text-sm"
                >
                  <span>{code}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 md:size-6 shrink-0"
                    onClick={() => copyToClipboard(code, String(index))}
                  >
                    {copiedCode === String(index) ? (
                      <Check className="size-3" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const text = backupCodes.join('\n')
                  copyToClipboard(text)
                }}
                size="sm"
              >
                <Copy className="size-4 mr-2" />
                Copy All
              </Button>
              <Button
                variant="outline"
                onClick={() => setSetupStep('idle')}
                size="sm"
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Regenerate backup codes option — requires a current TOTP code */}
        {enabled && setupStep === 'idle' && (
          <div className="flex items-center gap-2">
            <Dialog open={showRegenerateDialog} onOpenChange={(open) => {
              setShowRegenerateDialog(open)
              if (!open) setRegenerateCode('')
            }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRegenerateDialog(true)}
                disabled={submitting}
              >
                <RefreshCw className="size-4 mr-2" />
                Regenerate Backup Codes
              </Button>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Regenerate Backup Codes</DialogTitle>
                  <DialogDescription>
                    Enter the current 6-digit code from your authenticator app.
                    Your existing backup codes will stop working.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center py-2">
                  <InputOTP
                    maxLength={6}
                    value={regenerateCode}
                    onChange={setRegenerateCode}
                    disabled={submitting}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowRegenerateDialog(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRegenerateCodes}
                    disabled={submitting || regenerateCode.length !== 6}
                  >
                    {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    Generate New Codes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <span className="text-xs text-muted-foreground">
              This will invalidate your current backup codes
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Active Sessions Section
// ============================================
function SessionsSection() {
  const { user } = useAuthStore()
  const [sessions, setSessions] = useState<Array<{
    id: string
    deviceName: string | null
    deviceType: string | null
    browser: string | null
    os: string | null
    ipAddress: string | null
    lastActiveAt: string
    isActive: boolean
    isCurrent: boolean
    createdAt: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getSessions()
      setSessions(data.sessions)
    } catch {
      toast.error('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchSessions()
    }
  }, [user, fetchSessions])

  const handleRevoke = async (sessionId: string) => {
    setRevoking(sessionId)
    try {
      await api.revokeSession(sessionId)
      toast.success('Session revoked')
      fetchSessions()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg || 'Failed to revoke session')
    } finally {
      setRevoking(null)
    }
  }

  const handleRevokeAll = async () => {
    setRevokingAll(true)
    try {
      const result = await api.revokeAllSessions()
      toast.success(result.message || 'All other sessions revoked')
      fetchSessions()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg || 'Failed to revoke sessions')
    } finally {
      setRevokingAll(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="size-5" />
            Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const otherSessions = sessions.filter(s => !s.isCurrent)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="size-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>
              Devices where you&apos;re currently signed in
            </CardDescription>
          </div>
          {otherSessions.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={revokingAll}
                >
                  {revokingAll ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4 mr-2" />}
                  Revoke All Others
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke All Other Sessions?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will sign you out of all other devices except this one. You&apos;ll need to log in again on those devices.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRevokeAll}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Revoke All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No active sessions found</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`flex items-center justify-between rounded-lg border p-3 ${
                session.isCurrent ? 'border-primary/30 bg-primary/5' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex items-center justify-center size-10 rounded-full shrink-0 ${
                  session.isCurrent
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {getDeviceIcon(session.deviceType)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {session.browser || 'Unknown browser'} on {session.os || 'Unknown OS'}
                    </p>
                    {session.isCurrent && (
                      <Badge variant="default" className="text-[0.769rem] px-1.5 py-0">Current</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {session.ipAddress && (
                      <span>{session.ipAddress}</span>
                    )}
                    <span>·</span>
                    <span>
                      {session.isCurrent
                        ? 'Active now'
                        : `Last active ${formatDistanceToNow(new Date(session.lastActiveAt), { addSuffix: true })}`
                      }
                    </span>
                  </div>
                </div>
              </div>
              {!session.isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleRevoke(session.id)}
                  disabled={revoking === session.id}
                >
                  {revoking === session.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Security Tab
// ============================================
export function SecurityTab() {
  return (
    <div className="space-y-6">
      <TwoFactorSection />
      <SessionsSection />
    </div>
  )
}

'use client'

import { useState } from 'react'
import { ArrowLeft, Shield, Loader2, KeyRound } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp'
import { useAuthStore, TwoFactorRequiredError } from '@/lib/stores/auth-store'
import { getNetworkErrorMessage } from '@/lib/validation'

interface TwoFactorPageProps {
  tempToken: string
  userEmail: string
  userName: string
  onBack: () => void
}

export function TwoFactorPage({ tempToken, userEmail, userName, onBack }: TwoFactorPageProps) {
  const { verify2faLogin } = useAuthStore()
  const [otpCode, setOtpCode] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const [showBackupInput, setShowBackupInput] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleVerify = async () => {
    const code = showBackupInput ? backupCode.trim() : otpCode
    if (!code || (showBackupInput ? code.length < 4 : code.length !== 6)) {
      setError(showBackupInput ? 'Please enter a valid backup code' : 'Please enter the 6-digit code')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      await verify2faLogin(tempToken, code)
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      if (msg.includes('Invalid verification code')) {
        setError('Invalid code. Please try again.')
      } else if (msg.includes('expired')) {
        setError('Session expired. Please log in again.')
      } else {
        setError(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtpComplete = (value: string) => {
    setOtpCode(value)
    if (value.length === 6) {
      // Auto-submit when OTP is complete
      setTimeout(() => {
        handleVerifyWithCode(value)
      }, 200)
    }
  }

  const handleVerifyWithCode = async (code: string) => {
    if (code.length !== 6) return

    setError('')
    setIsLoading(true)

    try {
      await verify2faLogin(tempToken, code)
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      if (msg.includes('Invalid verification code')) {
        setError('Invalid code. Please try again.')
        setOtpCode('')
      } else if (msg.includes('expired')) {
        setError('Session expired. Please log in again.')
      } else {
        setError(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackupKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleVerify()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f2f0] dark:bg-gray-950 p-4" role="main">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to login
        </button>

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center size-14 rounded-full bg-primary text-primary-foreground mb-4 shadow-md shadow-primary/20">
            <Shield className="size-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Two-Factor Authentication</h1>
          <p className="text-muted-foreground text-sm mt-1">Verify your identity to continue</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Enter Verification Code</CardTitle>
            <CardDescription>
              Open your authenticator app and enter the 6-digit code for{' '}
              <span className="font-medium text-foreground">{userName}</span>
              <br />
              <span className="text-xs">({userEmail})</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error banner */}
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {!showBackupInput ? (
              /* OTP Input */
              <div className="space-y-3">
                <Label className="text-center block">Authentication Code</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={handleOtpComplete}
                    disabled={isLoading}
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
              </div>
            ) : (
              /* Backup Code Input */
              <div className="space-y-3">
                <Label htmlFor="backup-code">Backup Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="backup-code"
                    type="text"
                    placeholder="XXXX-XXXX"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                    onKeyDown={handleBackupKeyDown}
                    disabled={isLoading}
                    className="pl-9 text-center text-lg tracking-widest font-mono"
                    maxLength={9}
                    autoComplete="off"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Enter one of the backup codes you saved when setting up 2FA
                </p>
              </div>
            )}

            {/* Toggle between OTP and backup code */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setShowBackupInput(!showBackupInput)
                  setError('')
                  setOtpCode('')
                  setBackupCode('')
                }}
                className="text-xs text-primary hover:underline underline-offset-4"
              >
                {showBackupInput ? 'Use authenticator code instead' : 'Use backup code instead'}
              </button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-2">
            {!showBackupInput && (
              <Button
                onClick={handleVerify}
                disabled={isLoading || otpCode.length !== 6}
                className="w-full h-9"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </Button>
            )}
            {showBackupInput && (
              <Button
                onClick={handleVerify}
                disabled={isLoading || backupCode.length < 4}
                className="w-full h-9"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  'Verify Backup Code'
                )}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

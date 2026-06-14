'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { Package, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { useAuthStore, TwoFactorRequiredError } from '@/lib/stores/auth-store'
import { loginSchema, type LoginFormData } from '@/lib/validations'
import { getNetworkErrorMessage } from '@/lib/validation'
import { FormInputField, FormErrorBanner, FormSubmitButton } from '@/components/shared/form-fields'

interface LoginPageProps {
  onSwitchToRegister: () => void
  onSwitchToResetPassword: () => void
  onBack?: () => void
  onTwoFactorRequired?: (err: TwoFactorRequiredError) => void
}

/**
 * Translates raw API error messages into user-friendly messages
 * with actionable guidance.
 */
function getLoginErrorMessage(err: unknown): { message: string; isAccountNotConfigured?: boolean } {
  const raw = getNetworkErrorMessage(err)

  if (raw.includes('Invalid email or password')) {
    return {
      message: 'The email or password you entered is incorrect. Please check your credentials and try again.',
    }
  }

  if (raw.includes('Account not configured for password login')) {
    return {
      message: 'Your account is not configured for password login. Please reset your password or contact support.',
      isAccountNotConfigured: true,
    }
  }

  return { message: raw }
}

export function LoginPage({ onSwitchToRegister, onSwitchToResetPassword, onBack, onTwoFactorRequired }: LoginPageProps) {
  const { login } = useAuthStore()
  const [error, setError] = useState('')
  const [isAccountNotConfigured, setIsAccountNotConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const handleFormSubmit = async (data: LoginFormData) => {
    setError('')
    setIsAccountNotConfigured(false)
    setIsLoading(true)

    try {
      await login(data.email, data.password)
    } catch (err) {
      // Check if 2FA is required
      if (err instanceof TwoFactorRequiredError && onTwoFactorRequired) {
        onTwoFactorRequired(err)
        return
      }

      const { message, isAccountNotConfigured: notConfigured } = getLoginErrorMessage(err)
      setError(message)
      setIsAccountNotConfigured(!!notConfigured)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f2f0] dark:bg-gray-950 p-4" role="main">
      <div className="w-full max-w-md">
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </button>
        )}

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center size-14 rounded-full bg-primary text-primary-foreground mb-4 shadow-md shadow-primary/20">
            <Package className="size-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">InvenSync</h1>
          <p className="text-muted-foreground text-sm mt-1">Smart Inventory Management</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)}>
              <CardContent className="space-y-4">
                <FormErrorBanner message={error} />
                {isAccountNotConfigured && (
                  <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                    You can reset your password below to set up password login for your account.
                  </div>
                )}
                <FormInputField
                  name="email"
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
                <div className="space-y-1">
                  <FormInputField
                    name="password"
                    label="Password"
                    type="password"
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={onSwitchToResetPassword}
                      className="text-xs text-primary hover:underline underline-offset-4"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3 pt-2">
                <FormSubmitButton
                  isLoading={isLoading}
                  loadingText="Signing in..."
                  className="w-full h-9 px-4 py-2"
                  disabled={isLoading}
                >
                  Sign In
                </FormSubmitButton>
                <div className="h-px bg-border w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={onSwitchToRegister}
                    className="text-primary font-medium hover:underline underline-offset-4"
                  >
                    Register
                  </button>
                </p>
              </CardFooter>
            </form>
          </Form>
        </Card>


      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Package, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { api } from '@/lib/api-client'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations'
import { getNetworkErrorMessage } from '@/lib/validation'
import { FormInputField, FormErrorBanner, FormSubmitButton } from '@/components/shared/form-fields'

interface ResetPasswordPageProps {
  onSwitchToLogin: () => void
  onBack?: () => void
}

export function ResetPasswordPage({ onSwitchToLogin, onBack }: ResetPasswordPageProps) {
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const handleFormSubmit = async (data: ResetPasswordFormData) => {
    setError('')
    setIsLoading(true)

    try {
      await api.resetPassword(data.email, data.currentPassword, data.newPassword)
      setIsSuccess(true)
    } catch (err) {
      setError(getNetworkErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f2f0] dark:bg-gray-950 p-4" role="main">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center size-14 rounded-full bg-primary text-primary-foreground mb-4 shadow-md shadow-primary/20">
              <Package className="size-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">InvenSync</h1>
            <p className="text-muted-foreground text-sm mt-1">Smart Inventory Management</p>
          </div>

          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">
                <CheckCircle2 className="size-12 text-green-500" />
              </div>
              <CardTitle className="text-xl">Password Reset Successful</CardTitle>
              <CardDescription>
                Your password has been updated. You can now sign in with your new password.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="w-full inline-flex items-center justify-center h-9 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Sign In
              </button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
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
            <ArrowLeft className="size-4" />
            Back to login
          </button>
        )}

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center size-14 rounded-full bg-primary text-primary-foreground mb-4 shadow-md shadow-primary/20">
            <Package className="size-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">InvenSync</h1>
          <p className="text-muted-foreground text-sm mt-1">Smart Inventory Management</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Reset Password</CardTitle>
            <CardDescription>Enter your credentials and choose a new password</CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)}>
              <CardContent className="space-y-4">
                <FormErrorBanner message={error} />
                <FormInputField
                  name="email"
                  label="Email"
                  type="email"
                  placeholder="demo@example.com"
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
                <FormInputField
                  name="currentPassword"
                  label="Current Password"
                  type="password"
                  placeholder="Enter your current password"
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <FormInputField
                  name="newPassword"
                  label="New Password"
                  type="password"
                  placeholder="Min 8 chars: uppercase, lowercase, digit, special"
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <FormInputField
                  name="confirmPassword"
                  label="Confirm New Password"
                  type="password"
                  placeholder="Re-enter your new password"
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </CardContent>
              <CardFooter className="flex flex-col gap-3 pt-2">
                <FormSubmitButton
                  isLoading={isLoading}
                  loadingText="Resetting password..."
                  className="w-full h-9 px-4 py-2"
                  disabled={isLoading}
                >
                  Reset Password
                </FormSubmitButton>
                <div className="h-px bg-border w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  Remember your password?{' '}
                  <button
                    type="button"
                    onClick={onSwitchToLogin}
                    className="text-primary font-medium hover:underline underline-offset-4"
                  >
                    Sign In
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

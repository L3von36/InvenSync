'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { Package, ChevronRight, ChevronDown, MapPin, ArrowLeft, Store } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { useAuthStore } from '@/lib/stores/auth-store'
import { LocationPicker } from '@/components/app/shared/location-picker'
import { registerSchema, type RegisterFormData } from '@/lib/validations'
import { getNetworkErrorMessage } from '@/lib/validation'
import { BUSINESS_TYPE_OPTIONS, type BusinessTypeKey } from '@/lib/business-templates'
import {
  FormInputField,
  FormTextareaField,
  FormSelectField,
  FormErrorBanner,
  FormSubmitButton,
} from '@/components/shared/form-fields'

interface RegisterPageProps {
  onSwitchToLogin: () => void
  onBack?: () => void
}

const businessTypeSelectOptions = BUSINESS_TYPE_OPTIONS.map(t => ({
  value: t.value,
  label: `${t.icon} ${t.label}`,
}))

export function RegisterPage({ onSwitchToLogin, onBack }: RegisterPageProps) {
  const { register } = useAuthStore()
  const [error, setError] = useState('')
  const [isEmailExists, setIsEmailExists] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showBusinessDetails, setShowBusinessDetails] = useState(true)

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      orgName: '',
      businessType: '',
      description: '',
      address: '',
      city: '',
      phone: '',
      latitude: null,
      longitude: null,
      referralCode: '',
    },
  })

  const handleFormSubmit = async (data: RegisterFormData) => {
    setError('')
    setIsEmailExists(false)
    setIsLoading(true)

    try {
      await register(data.name, data.email, data.password, data.orgName, {
        businessType: data.businessType || undefined,
        description: data.description || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        latitude: data.latitude || undefined,
        longitude: data.longitude || undefined,
        phone: data.phone || undefined,
        referralCode: data.referralCode || undefined,
      })
    } catch (err) {
      const rawMessage = getNetworkErrorMessage(err)
      if (rawMessage.includes('Email already registered')) {
        setIsEmailExists(true)
        setError('An account with this email already exists. Would you like to sign in instead?')
      } else {
        setError(rawMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleLocationChange = (lat: number, lng: number) => {
    form.setValue('latitude', lat)
    form.setValue('longitude', lng)
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
            Back to home
          </button>
        )}

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center size-14 rounded-full bg-primary text-primary-foreground mb-4 shadow-md shadow-primary/20">
            <Package className="size-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">InvenSync</h1>
          <p className="text-muted-foreground text-sm mt-1">Smart Inventory Management</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Create your account</CardTitle>
            <CardDescription>Get started with InvenSync in seconds</CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)}>
              <CardContent className="space-y-4">
                <FormErrorBanner message={error} />
                {isEmailExists && (
                  <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                    An account with this email already exists. Would you like to{' '}
                    <button
                      type="button"
                      onClick={onSwitchToLogin}
                      className="font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
                    >
                      sign in instead
                    </button>
                    ?
                  </div>
                )}
                <FormInputField
                  name="name"
                  label="Full Name"
                  type="text"
                  placeholder="John Doe"
                  required
                  autoComplete="name"
                  disabled={isLoading}
                />
                <FormInputField
                  name="email"
                  label="Email"
                  type="email"
                  placeholder="john@example.com"
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
                <FormInputField
                  name="password"
                  label="Password"
                  type="password"
                  placeholder="Min 8 chars: uppercase, lowercase, digit, special"
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <FormInputField
                  name="orgName"
                  label="Business Name"
                  type="text"
                  placeholder="My Business"
                  required
                  disabled={isLoading}
                />
                <FormSelectField
                  name="businessType"
                  label="Business Type"
                  placeholder="Select your business type"
                  options={businessTypeSelectOptions}
                  required
                  disabled={isLoading}
                />
                {form.watch('businessType') && (
                  <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 p-3">
                    <Store className="size-4 text-primary mt-0.5 shrink-0" />
                    <div className="text-xs text-muted-foreground">
                      {BUSINESS_TYPE_OPTIONS.find(t => t.value === form.watch('businessType'))?.description}
                      <span className="block mt-1 text-primary/80">
                        Pre-configured product types &amp; attributes will be set up automatically.
                      </span>
                    </div>
                  </div>
                )}
                <FormInputField
                  name="referralCode"
                  label="Referral Code"
                  type="text"
                  placeholder="Enter sales rep referral code"
                  disabled={isLoading}
                  inputClassName="font-mono"
                  description="If a sales representative referred you, enter their code here."
                />

                {/* Expandable business details */}
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-primary hover:underline w-full"
                  onClick={() => setShowBusinessDetails(!showBusinessDetails)}
                >
                  {showBusinessDetails ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                  {showBusinessDetails ? 'Hide' : 'Show'} business details (optional)
                </button>

                {showBusinessDetails && (
                  <div className="space-y-4 border-l-2 border-primary/20 pl-4">
                    <FormTextareaField
                      name="description"
                      label="Business Description"
                      placeholder="Brief description of your business..."
                      rows={2}
                      disabled={isLoading}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormInputField
                        name="phone"
                        label="Phone"
                        type="tel"
                        placeholder="+251 9XX XXX XXXX"
                        disabled={isLoading}
                      />
                      <FormInputField
                        name="city"
                        label="City"
                        type="text"
                        placeholder="Addis Ababa"
                        disabled={isLoading}
                      />
                    </div>
                    <FormInputField
                      name="address"
                      label="Address"
                      type="text"
                      placeholder="Bole, Addis Ababa"
                      disabled={isLoading}
                    />
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <MapPin className="size-4" />
                        Business Location
                        <span className="text-xs font-normal text-muted-foreground">(auto-detected)</span>
                      </label>
                      <LocationPicker
                        latitude={form.watch('latitude') ?? null}
                        longitude={form.watch('longitude') ?? null}
                        onChange={handleLocationChange}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-3 pt-2">
                <FormSubmitButton
                  isLoading={isLoading}
                  loadingText="Creating account..."
                  className="w-full h-9 px-4 py-2"
                  disabled={isLoading}
                >
                  Create Account
                </FormSubmitButton>
                <div className="h-px bg-border w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  Already have an account?{' '}
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

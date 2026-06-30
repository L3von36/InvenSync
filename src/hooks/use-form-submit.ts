'use client'

// ============================================
// useFormSubmit — Consistent form submission handler with loading, error, toast
// ============================================

import { useState, useCallback } from 'react'
import { type FieldValues, type UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'
import { getNetworkErrorMessage } from '@/lib/validation'

interface UseFormSubmitOptions<TData> {
  onSuccess?: (data: TData) => void
  onError?: (error: unknown) => void
  successMessage?: string
  errorMessage?: string
  resetOnSuccess?: boolean
}

interface UseFormSubmitReturn<TFieldValues extends FieldValues> {
  isSubmitting: boolean
  formError: string | null
  handleSubmit: (
    form: UseFormReturn<TFieldValues>,
    onSubmit: (values: TFieldValues) => Promise<TData>
  ) => (e?: React.BaseSyntheticEvent) => Promise<void>
  clearFormError: () => void
}

type TData = unknown

export function useFormSubmit<TFieldValues extends FieldValues = FieldValues>(
  options: UseFormSubmitOptions<TData> = {}
): UseFormSubmitReturn<TFieldValues> {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const clearFormError = useCallback(() => setFormError(null), [])

  const handleSubmit = useCallback(
    (form: UseFormReturn<TFieldValues>, onSubmit: (values: TFieldValues) => Promise<TData>) => {
      return async (e?: React.BaseSyntheticEvent) => {
        e?.preventDefault()
        setFormError(null)

        // Validate the form first
        const isValid = await form.trigger()
        if (!isValid) {
          toast.error('Please fix the errors in the form')
          return
        }

        setIsSubmitting(true)
        try {
          const values = form.getValues()
          const result = await onSubmit(values)

          if (options.successMessage) {
            toast.success(options.successMessage)
          }

          if (options.resetOnSuccess) {
            form.reset()
          }

          if (options.onSuccess) {
            options.onSuccess(result)
          }
        } catch (err: unknown) {
          const message = options.errorMessage || getNetworkErrorMessage(err)
          setFormError(message)
          toast.error(message)

          if (options.onError) {
            options.onError(err)
          }
        } finally {
          setIsSubmitting(false)
        }
      }
    },
    [options]
  )

  return { isSubmitting, formError, handleSubmit, clearFormError }
}

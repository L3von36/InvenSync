'use client'

// ============================================
// Reusable Form Fields — Built on React Hook Form + shadcn/ui Form
// ============================================

import * as React from 'react'
import { useFormContext, type FieldPath, type FieldValues, Controller } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ============================================
// Form Input Field — Reusable text/email/password/number/tel input
// ============================================

interface FormInputFieldProps<T extends FieldValues> {
  name: FieldPath<T>
  label?: string
  placeholder?: string
  description?: string
  type?: React.InputHTMLAttributes<HTMLInputElement>['type']
  required?: boolean
  disabled?: boolean
  className?: string
  inputClassName?: string
  autoComplete?: string
  min?: number | string
  max?: number | string
  step?: number | string
  autoFocus?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

export function FormInputField<T extends FieldValues>({
  name,
  label,
  placeholder,
  description,
  type = 'text',
  required,
  disabled,
  className,
  inputClassName,
  autoComplete,
  min,
  max,
  step,
  autoFocus,
  onKeyDown,
}: FormInputFieldProps<T>) {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </FormLabel>
          )}
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              autoComplete={autoComplete}
              min={min}
              max={max}
              step={step}
              autoFocus={autoFocus}
              className={inputClassName}
              onKeyDown={onKeyDown}
              {...field}
              onChange={(e) => {
                if (type === 'number') {
                  // Store as number when possible so form.getValues() returns numbers
                  const raw = e.target.value
                  if (raw === '') {
                    field.onChange('')
                  } else {
                    const num = Number(raw)
                    field.onChange(Number.isNaN(num) ? raw : num)
                  }
                } else {
                  field.onChange(e.target.value)
                }
              }}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// ============================================
// Form Textarea Field
// ============================================

interface FormTextareaFieldProps<T extends FieldValues> {
  name: FieldPath<T>
  label?: string
  placeholder?: string
  description?: string
  required?: boolean
  disabled?: boolean
  className?: string
  rows?: number
}

export function FormTextareaField<T extends FieldValues>({
  name,
  label,
  placeholder,
  description,
  required,
  disabled,
  className,
  rows = 3,
}: FormTextareaFieldProps<T>) {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </FormLabel>
          )}
          <FormControl>
            <Textarea
              placeholder={placeholder}
              disabled={disabled}
              rows={rows}
              {...field}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// ============================================
// Form Select Field
// ============================================

interface SelectOption {
  value: string
  label: string
  icon?: React.ReactNode
}

interface FormSelectFieldProps<T extends FieldValues> {
  name: FieldPath<T>
  label?: string
  placeholder?: string
  description?: string
  required?: boolean
  disabled?: boolean
  className?: string
  options: SelectOption[]
  onValueChange?: (value: string) => void
}

export function FormSelectField<T extends FieldValues>({
  name,
  label,
  placeholder,
  description,
  required,
  disabled,
  className,
  options,
  onValueChange,
}: FormSelectFieldProps<T>) {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </FormLabel>
          )}
          <Select
            value={field.value}
            onValueChange={(val) => {
              field.onChange(val)
              onValueChange?.(val)
            }}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.icon ? (
                    <span className="flex items-center gap-2">
                      {option.icon}
                      {option.label}
                    </span>
                  ) : (
                    option.label
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// ============================================
// Form Switch Field
// ============================================

interface FormSwitchFieldProps<T extends FieldValues> {
  name: FieldPath<T>
  label?: string
  description?: string
  disabled?: boolean
  className?: string
}

export function FormSwitchField<T extends FieldValues>({
  name,
  label,
  description,
  disabled,
  className,
}: FormSwitchFieldProps<T>) {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${className || ''}`}>
          <div className="space-y-0.5">
            {label && <FormLabel className="text-sm font-medium">{label}</FormLabel>}
            {description && <FormDescription>{description}</FormDescription>}
          </div>
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// ============================================
// Form Error Banner — Shows form-level errors
// ============================================

interface FormErrorBannerProps {
  message?: string | null
}

export function FormErrorBanner({ message }: FormErrorBannerProps) {
  if (!message) return null
  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  )
}

// ============================================
// Form Submit Button — Handles loading state with shadcn Button
// ============================================

import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface FormSubmitButtonProps {
  isLoading?: boolean
  loadingText?: string
  children: React.ReactNode
  disabled?: boolean
  className?: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function FormSubmitButton({
  isLoading,
  loadingText = 'Saving...',
  children,
  disabled,
  className,
  variant = 'default',
  size = 'default',
}: FormSubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={isLoading || disabled}
      variant={variant}
      size={size}
      className={className}
      aria-busy={isLoading}
      aria-live="polite"
    >
      {isLoading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </Button>
  )
}

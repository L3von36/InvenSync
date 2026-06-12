// ============================================
// Zod Validation Schemas — React Hook Form integration
// ============================================

import { z } from 'zod'

// ============================================
// Reusable field validators
// ============================================

export const requiredName = z
  .string()
  .min(1, 'Name is required')
  .min(2, 'Name must be at least 2 characters')

export const requiredEmail = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')

export const password = z
  .string()
  .min(1, 'Password is required')
  .min(6, 'Password must be at least 6 characters')

export const ethiopianPhone = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val) return true // optional
      const cleaned = val.replace(/[\s\-()]/g, '')
      return /^(\+?251|0)?[79]\d{8}$/.test(cleaned)
    },
    { message: 'Please enter a valid Ethiopian phone number (e.g. +251912345678)' }
  )

export const optionalEmail = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val.trim() === '') return true
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
    },
    { message: 'Please enter a valid email address' }
  )

export const positiveNumber = z
  .coerce
  .number({ invalid_type_error: 'Must be a valid number' })
  .min(0, 'Must be a positive number')

export const positiveInteger = z
  .coerce
  .number({ invalid_type_error: 'Must be a valid number' })
  .int('Must be a whole number')
  .min(1, 'Must be at least 1')

export const requiredString = (fieldName: string) =>
  z.string().min(1, `${fieldName} is required`)

export const periodFormat = z
  .string()
  .min(1, 'Period is required')
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Period must be in YYYY-MM format')

// ============================================
// Auth Schemas
// ============================================

export const loginSchema = z.object({
  email: requiredEmail,
  password: z.string().min(1, 'Password is required'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const resetPasswordSchema = z.object({
  email: requiredEmail,
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(1, 'New password is required').min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

export const registerSchema = z.object({
  name: requiredName,
  email: requiredEmail,
  password,
  orgName: z
    .string()
    .min(1, 'Business name is required')
    .min(2, 'Business name must be at least 2 characters'),
  businessType: z.string().optional(),
  description: z.string().optional(),
  phone: ethiopianPhone,
  city: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  referralCode: z.string().optional(),
})

export type RegisterFormData = z.infer<typeof registerSchema>

// ============================================
// Customer / Supplier Schemas
// ============================================

export const customerSchema = z.object({
  name: requiredName,
  email: optionalEmail,
  phone: ethiopianPhone,
  address: z.string().optional(),
})

export type CustomerFormData = z.infer<typeof customerSchema>

export const supplierSchema = z.object({
  name: requiredName,
  email: optionalEmail,
  phone: ethiopianPhone,
  address: z.string().optional(),
})

export type SupplierFormData = z.infer<typeof supplierSchema>

// ============================================
// Sales Schema
// ============================================

export const saleItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.coerce.number({ invalid_type_error: 'Quantity is required' }).min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number({ invalid_type_error: 'Price is required' }).min(0, 'Price must be positive'),
})

export const saleSchema = z.object({
  customerId: z.string().optional(),
  newCustomerName: z.string().optional(),
  newCustomerPhone: z.string().optional(),
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
  discount: z.coerce.number().min(0, 'Discount must be positive').optional().default(0),
  tax: z.coerce.number().min(0, 'Tax must be positive').optional().default(0),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  amountPaid: z.coerce.number().min(0, 'Amount paid must be positive').optional().default(0),
  notes: z.string().optional(),
})

export type SaleFormData = z.infer<typeof saleSchema>
export type SaleItemFormData = z.infer<typeof saleItemSchema>

// ============================================
// Product Schema
// ============================================

export const productSchema = z.object({
  productTypeId: z.string().min(1, 'Product type is required'),
  name: requiredName,
  sku: z.string().optional(),
  description: z.string().optional(),
  costPrice: z.coerce.number({ invalid_type_error: 'Cost price is required' }).positive('Cost price must be greater than 0'),
  sellingPrice: z.coerce.number({ invalid_type_error: 'Selling price is required' }).positive('Selling price must be greater than 0'),
  lowStockThreshold: z.coerce.number({ invalid_type_error: 'Threshold is required' }).min(0, 'Threshold must be positive').optional().default(5),
  quantity: z.coerce.number({ invalid_type_error: 'Quantity is required' }).min(0, 'Quantity must be positive').optional(),
})

export type ProductFormData = z.infer<typeof productSchema>

// ============================================
// Product Type Schema
// ============================================

export const attributeSchema = z.object({
  name: z.string().min(1, 'Attribute name is required'),
  fieldType: z.enum(['text', 'number', 'select', 'switch', 'boolean', 'textarea', 'date', 'image']),
  options: z.string().optional(),
  required: z.boolean().optional().default(false),
})

export const productTypeSchema = z.object({
  name: requiredName,
  icon: z.string().optional(),
  attributes: z.array(attributeSchema).optional().default([]),
})

export type ProductTypeFormData = z.infer<typeof productTypeSchema>
export type AttributeFormData = z.infer<typeof attributeSchema>

// ============================================
// Debt Schemas
// ============================================

export const debtSchema = z.object({
  type: z.enum(['customer_debt', 'supplier_debt']),
  entityId: z.string().min(1, 'Please select a customer or supplier'),
  amount: z.coerce.number({ invalid_type_error: 'Amount is required' }).positive('Amount must be greater than 0'),
  dueDate: z.string().optional(),
  description: z.string().optional(),
})

export type DebtFormData = z.infer<typeof debtSchema>

export const debtPaymentSchema = z.object({
  amount: z.coerce.number({ invalid_type_error: 'Payment amount is required' }).positive('Payment amount must be greater than 0'),
  paymentMethod: z.enum(['cash', 'card', 'mobile_money']),
  notes: z.string().optional(),
})

export type DebtPaymentFormData = z.infer<typeof debtPaymentSchema>

// ============================================
// Inventory / Stock Adjustment Schema
// ============================================

export const stockAdjustmentSchema = z.object({
  type: z.enum(['in', 'out', 'adjustment']),
  quantity: positiveInteger,
  reason: z.string().min(1, 'Reason is required'),
})

export type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>

// ============================================
// Service Schemas
// ============================================

export const serviceTypeSchema = z.object({
  name: requiredName,
  description: z.string().optional(),
  duration: z.coerce.number({ invalid_type_error: 'Duration is required' }).min(1, 'Duration must be at least 1 minute').optional(),
  price: z.coerce.number({ invalid_type_error: 'Price is required' }).min(0, 'Price must be positive').optional(),
  imageUrl: z.string().optional(),
})

export type ServiceTypeFormData = z.infer<typeof serviceTypeSchema>

export const bookingSchema = z.object({
  serviceTypeId: z.string().min(1, 'Service type is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: ethiopianPhone,
  bookingDate: z.string().min(1, 'Booking date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().optional(),
  notes: z.string().optional(),
})

export type BookingFormData = z.infer<typeof bookingSchema>

// ============================================
// Organization / Settings Schemas
// ============================================

export const orgSettingsSchema = z.object({
  orgName: z.string().min(1, 'Organization name is required'),
  orgLogoUrl: z.string().optional(),
  orgCurrency: z.string().optional(),
  orgCountry: z.string().optional(),
})

export type OrgSettingsFormData = z.infer<typeof orgSettingsSchema>

export const inviteMemberSchema = z.object({
  email: requiredEmail,
  role: z.enum(['member', 'manager']),
})

export type InviteMemberFormData = z.infer<typeof inviteMemberSchema>

export const shopSchema = z.object({
  name: z.string().min(1, 'Shop name is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: ethiopianPhone,
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
})

export type ShopFormData = z.infer<typeof shopSchema>

// ============================================
// Admin Schemas
// ============================================

export const adminModuleSchema = z.object({
  key: z.string().min(1, 'Module key is required'),
  name: z.string().min(1, 'Display name is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
  category: z.string().optional(),
  priceETB: z.coerce.number({ invalid_type_error: 'Price is required' }).min(0, 'Price must be positive'),
  billingCycle: z.string().optional(),
  isFree: z.boolean().optional().default(true),
  freeTrialDays: z.coerce.number().min(0, 'Trial days must be positive').optional().default(30),
  order: z.coerce.number().min(0).optional().default(0),
})

export type AdminModuleFormData = z.infer<typeof adminModuleSchema>

export const salesRepSchema = z.object({
  name: requiredName,
  email: requiredEmail,
  phone: ethiopianPhone,
  targetCity: z.string().optional(),
  commissionPerReg: z.coerce.number({ invalid_type_error: 'Commission is required' }).min(0, 'Commission must be positive'),
  monthlyTarget: z.coerce.number().min(1, 'Target must be at least 1').optional().default(10),
})

export type SalesRepFormData = z.infer<typeof salesRepSchema>

export const editSalesRepSchema = z.object({
  phone: ethiopianPhone,
  targetCity: z.string().optional(),
  commissionPerReg: z.coerce.number({ invalid_type_error: 'Commission is required' }).min(0, 'Commission must be positive'),
})

export type EditSalesRepFormData = z.infer<typeof editSalesRepSchema>

export const salesGoalSchema = z.object({
  period: periodFormat,
  targetCount: positiveInteger,
  bonusAmount: z.coerce.number({ invalid_type_error: 'Bonus is required' }).min(0, 'Bonus must be positive'),
})

export type SalesGoalFormData = z.infer<typeof salesGoalSchema>

// ============================================
// Sales Rep Dashboard Schemas
// ============================================

export const registerBusinessSchema = z.object({
  name: requiredName,
  email: requiredEmail,
  password,
  organizationName: z.string().min(1, 'Business name is required').min(2, 'Business name must be at least 2 characters'),
  businessType: z.string().optional(),
  city: z.string().optional(),
  phone: ethiopianPhone,
  address: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
})

export type RegisterBusinessFormData = z.infer<typeof registerBusinessSchema>

// ============================================
// AI Product Analysis Schema
// ============================================

export const aiProductAnalysisSchema = z.object({
  editableCategory: z.string().min(1, 'Category / Product type is required'),
  editableName: z.string().min(1, 'Product name is required'),
  editableBrand: z.string().optional(),
  editableDescription: z.string().optional(),
})

export type AIProductAnalysisFormData = z.infer<typeof aiProductAnalysisSchema>

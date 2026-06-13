'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { usePageSearch } from '@/hooks/use-page-search'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Package,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
  ArrowUpDown,
  ArrowLeft,
  MoreHorizontal,
  QrCode,
  FileDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, type Product, type ProductType, type AttributeDefinition, type StockMovement } from '@/lib/api-client'
import { BarcodeDialog } from '@/components/app/products/barcode-dialog'
import { BulkImportDialog } from '@/components/app/products/bulk-import-dialog'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getNetworkErrorMessage } from '@/lib/validation'
import { formatETB, formatDate } from '@/lib/format'
import { productSchema, type ProductFormData } from '@/lib/validations'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { FormInputField, FormTextareaField } from '@/components/shared/form-fields'
import { Form } from '@/components/ui/form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ============================================
// Helpers
// ============================================
function getStockStatus(
  quantity: number,
  lowStockThreshold: number
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (quantity <= 0) return { label: 'Out of Stock', variant: 'destructive' }
  if (quantity <= lowStockThreshold) return { label: 'Low Stock', variant: 'secondary' }
  return { label: 'In Stock', variant: 'default' }
}

/** Safely parse attribute options that may be double-encoded */
function parseAttributeOptions(raw: string | null | undefined): string[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
    } else if (typeof parsed === 'string') {
      // Handle double-encoded: "Red,Blue,Green" instead of ["Red","Blue","Green"]
      return parsed.split(',').map((s: string) => s.trim()).filter(Boolean)
    }
    return null
  } catch {
    // If parsing fails, try splitting by comma
    return raw.split(',').map(s => s.trim()).filter(Boolean)
  }
}

// ============================================
// Create/Edit Product Dialog
// ============================================
function ProductDialog({
  open,
  onOpenChange,
  product,
  productTypes,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  productTypes: ProductType[]
  onSaved: () => void
}) {
  const { currentOrg, currentShop } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({})
  const [attrErrors, setAttrErrors] = useState<Record<string, string>>({})
  const isEditing = !!product

  // Separate state to track selected product type ID reliably
  const [selectedTypeId, setSelectedTypeId] = useState<string>('')

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      productTypeId: '',
      name: '',
      sku: '',
      description: '',
      costPrice: undefined as unknown as number,
      sellingPrice: undefined as unknown as number,
      lowStockThreshold: 10,
      quantity: 0,
    },
  })

  // Watch productTypeId for reactive UI
  const watchedProductTypeId = form.watch('productTypeId')

  // Use selectedTypeId as the source of truth (falls back to form value)
  const activeTypeId = selectedTypeId || watchedProductTypeId
  const selectedType = productTypes.find((pt) => pt.id === activeTypeId)
  const typeAttributes = selectedType?.attributes || []

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setAttrErrors({})
      if (product) {
        const attrVals: Record<string, string> = {}
        product.attributeValues?.forEach((av) => {
          attrVals[av.attributeDefinitionId] = av.value
        })
        setAttributeValues(attrVals)
        setSelectedTypeId(product.productTypeId)
        form.reset({
          productTypeId: product.productTypeId,
          name: product.name,
          sku: product.sku || '',
          description: product.description || '',
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          lowStockThreshold: product.lowStockThreshold,
          quantity: product.quantity,
        })
        setImagePreview(product.imageUrl || null)
      } else {
        setAttributeValues({})
        setSelectedTypeId('')
        form.reset({
          productTypeId: '',
          name: '',
          sku: '',
          description: '',
          costPrice: undefined as unknown as number,
          sellingPrice: undefined as unknown as number,
          lowStockThreshold: 10,
          quantity: 0,
        })
        setImagePreview(null)
      }
    } else {
      // Clean up state when dialog closes
      setSelectedTypeId('')
      setAttributeValues({})
      setAttrErrors({})
      setImagePreview(null)
    }
  }, [open, product, form])

  // Handle product type selection
  const handleSelectType = (typeId: string) => {
    setSelectedTypeId(typeId)
    form.setValue('productTypeId', typeId, { shouldValidate: true, shouldDirty: true, shouldTouch: true })
    // Clear attribute values when switching types
    setAttributeValues({})
    setAttrErrors({})
  }

  const updateAttributeValue = (attrId: string, value: string) => {
    setAttributeValues((prev) => ({ ...prev, [attrId]: value }))
    setAttrErrors((prev) => {
      const next = { ...prev }
      delete next[`attr_${attrId}`]
      return next
    })
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setImagePreview(base64)
      typeAttributes
        .filter((a) => a.fieldType === 'image')
        .forEach((a) => {
          updateAttributeValue(a.id, base64)
        })
    }
    reader.readAsDataURL(file)
  }

  const onSubmit = async (data: ProductFormData) => {
    if (!currentOrg) return

    // Use selectedTypeId as the authoritative source for productTypeId
    const productTypeId = selectedTypeId || data.productTypeId || activeTypeId
    if (!productTypeId) {
      toast.error('Please select a product type')
      return
    }

    // Safely convert form values to numbers (form may store them as strings from input onChange)
    const costPrice = Number(data.costPrice)
    const sellingPrice = Number(data.sellingPrice)
    const lowStockThreshold = Number(data.lowStockThreshold) || 10
    const quantity = Number(data.quantity) || 0

    // Validate converted numbers
    if (!costPrice || Number.isNaN(costPrice) || costPrice <= 0) {
      toast.error('Cost price must be a valid number greater than 0')
      return
    }
    if (!sellingPrice || Number.isNaN(sellingPrice) || sellingPrice <= 0) {
      toast.error('Selling price must be a valid number greater than 0')
      return
    }

    setSaving(true)
    try {
      const attrVals = Object.entries(attributeValues)
        .filter(([, value]) => value.trim() !== '')
        .map(([attributeDefinitionId, value]) => ({
          attributeDefinitionId,
          value,
        }))

      if (isEditing && product) {
        await api.updateProduct(product.id, currentOrg.id, {
          name: data.name.trim(),
          sku: data.sku?.trim() || undefined,
          description: data.description?.trim() || undefined,
          imageUrl: imagePreview || product?.imageUrl || undefined,
          costPrice,
          sellingPrice,
          lowStockThreshold,
          attributeValues: attrVals,
        })
        toast.success('Product updated successfully')
      } else {
        await api.createProduct(currentOrg.id, {
          productTypeId,
          name: data.name.trim(),
          sku: data.sku?.trim() || undefined,
          description: data.description?.trim() || undefined,
          imageUrl: imagePreview || product?.imageUrl || undefined,
          quantity,
          costPrice,
          sellingPrice,
          lowStockThreshold,
          attributeValues: attrVals,
          shopId: currentShop?.id,
        })
        toast.success('Product created successfully')
      }

      onOpenChange(false)
      onSaved()
    } catch (error) {
      toast.error(getNetworkErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveClick = async () => {
    // First validate attributes manually
    const missingRequired = typeAttributes
      .filter((a) => a.required)
      .filter((a) => !attributeValues[a.id] || attributeValues[a.id].trim() === '')
    if (missingRequired.length > 0) {
      const errors: Record<string, string> = {}
      missingRequired.forEach((a) => {
        errors[`attr_${a.id}`] = `${a.name} is required`
      })
      setAttrErrors(errors)
      return
    }

    // Ensure productTypeId is set in form before validation
    if (selectedTypeId) {
      form.setValue('productTypeId', selectedTypeId, { shouldValidate: true, shouldDirty: true })
    }

    // Validate all form fields including productTypeId
    const isValid = await form.trigger(['productTypeId', 'name', 'costPrice', 'sellingPrice', 'lowStockThreshold', 'quantity'])
    if (!isValid) return

    // Final check: ensure we have a productTypeId
    if (!selectedTypeId && !form.getValues('productTypeId')) {
      toast.error('Please select a product type')
      return
    }

    const data = form.getValues()
    onSubmit(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto w-[calc(100%-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Product' : 'Add Product'}</DialogTitle>
          <DialogDescription>Fill in the product details below.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <div className="space-y-6">
            {/* Section 1: Product Type Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Product Type *</Label>
              {productTypes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <Package className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No product types available.</p>
                  <p className="text-xs mt-1">Create a product type first.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {productTypes.map((pt) => (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => handleSelectType(pt.id)}
                        className={`p-3 sm:p-4 rounded-lg border-2 text-center transition-all cursor-pointer ${
                          activeTypeId === pt.id
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="text-2xl mb-1">{pt.icon || '📦'}</div>
                        <div className="text-sm font-medium">{pt.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {pt.attributes?.length || 0} attributes
                        </div>
                      </button>
                    ))}
                  </div>
                  {form.formState.errors.productTypeId && (
                    <p className="text-sm text-destructive">{form.formState.errors.productTypeId.message}</p>
                  )}
                </>
              )}
            </div>

            {/* Section 2: Basic Information — shown only after a type is selected */}
            {activeTypeId && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Basic Information</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInputField
                    name="name"
                    label="Product Name"
                    placeholder='e.g., Samsung 55" 4K Smart TV'
                    required
                    className="sm:col-span-2"
                  />

                  <FormInputField
                    name="sku"
                    label="SKU"
                    placeholder="e.g., TV-SAM-55"
                  />

                  <FormTextareaField
                    name="description"
                    label="Description"
                    placeholder="Product description..."
                    rows={2}
                  />

                  <FormInputField
                    name="costPrice"
                    label="Cost Price (ETB)"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="e.g. 5000"
                    required
                  />

                  <FormInputField
                    name="sellingPrice"
                    label="Selling Price (ETB)"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="e.g. 8000"
                    required
                  />

                  <FormInputField
                    name="lowStockThreshold"
                    label="Low Stock Threshold"
                    type="number"
                    min="0"
                  />

                  {!isEditing && (
                    <FormInputField
                      name="quantity"
                      label="Initial Quantity"
                      type="number"
                      min="0"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Section 3: Custom Attributes — shown only when type has attributes */}
            {activeTypeId && typeAttributes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Custom Attributes</Label>
                <div className="space-y-4">
                  {typeAttributes.map((attr) => {
                    const options = parseAttributeOptions(attr.options)
                    return (
                      <div key={attr.id} className="space-y-2">
                        <Label className="flex items-center gap-1">
                          {attr.name}
                          {attr.required && <span className="text-destructive">*</span>}
                        </Label>

                        {(attr.fieldType === 'text' || attr.fieldType === 'textarea') && (
                          <Input
                            placeholder={`Enter ${attr.name.toLowerCase()}`}
                            value={attributeValues[attr.id] || ''}
                            onChange={(e) => updateAttributeValue(attr.id, e.target.value)}
                          />
                        )}

                        {attr.fieldType === 'number' && (
                          <Input
                            type="number"
                            step="any"
                            placeholder={`Enter ${attr.name.toLowerCase()}`}
                            value={attributeValues[attr.id] || ''}
                            onChange={(e) => updateAttributeValue(attr.id, e.target.value)}
                          />
                        )}

                        {(attr.fieldType === 'boolean' || attr.fieldType === 'switch') && (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={attributeValues[attr.id] === 'true'}
                              onCheckedChange={(checked) =>
                                updateAttributeValue(attr.id, checked ? 'true' : 'false')
                              }
                            />
                            <span className="text-sm text-muted-foreground">
                              {attributeValues[attr.id] === 'true' ? 'Yes' : 'No'}
                            </span>
                          </div>
                        )}

                        {attr.fieldType === 'select' && options && (
                          <Select
                            value={attributeValues[attr.id] || ''}
                            onValueChange={(v) => updateAttributeValue(attr.id, v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${attr.name.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {options.map((opt: string) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {attr.fieldType === 'image' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() =>
                                  document.getElementById(`img-upload-${attr.id}`)?.click()
                                }
                              >
                                <Upload className="size-3.5" />
                                Upload Image
                              </Button>
                              {attributeValues[attr.id] && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    updateAttributeValue(attr.id, '')
                                    setImagePreview(null)
                                  }}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              )}
                            </div>
                            <input
                              id={`img-upload-${attr.id}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageUpload}
                            />
                            {(attributeValues[attr.id] || imagePreview) && (
                              <div className="size-20 rounded-lg border overflow-hidden">
                                <img
                                  src={attributeValues[attr.id] || imagePreview || ''}
                                  alt="Preview"
                                  className="size-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {attr.fieldType === 'date' && (
                          <Input
                            type="date"
                            value={attributeValues[attr.id] || ''}
                            onChange={(e) => updateAttributeValue(attr.id, e.target.value)}
                          />
                        )}

                        {attrErrors[`attr_${attr.id}`] && (
                          <p className="text-sm text-destructive">{attrErrors[`attr_${attr.id}`]}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} type="button">
            Cancel
          </Button>
          <Button onClick={handleSaveClick} disabled={saving || !activeTypeId} type="button">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Product')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Product Detail View
// ============================================
function ProductDetailView({
  product,
  onClose,
  onEdit,
}: {
  product: Product & {
    stockMovements?: StockMovement[]
    productType?: {
      id: string
      name: string
      icon?: string | null
      attributes?: AttributeDefinition[]
    }
  }
  onClose: () => void
  onEdit: (product: Product) => void
}) {
  const { currentOrg, currentShop } = useAuthStore()
  const [adjusting, setAdjusting] = useState(false)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustType, setAdjustType] = useState<'in' | 'out'>('in')
  const [currentProduct, setCurrentProduct] = useState(product)

  const stockStatus = getStockStatus(currentProduct.quantity, currentProduct.lowStockThreshold)

  const handleStockAdjust = async () => {
    if (!currentOrg || !adjustQty) return
    const qty = parseInt(adjustQty)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity')
      return
    }
    setAdjusting(true)
    try {
      const result = await api.addStockMovement(currentOrg.id, {
        productId: currentProduct.id,
        type: adjustType,
        quantity: qty,
        reason: `${adjustType === 'in' ? 'Stock in' : 'Stock out'} (manual adjustment)`,
        shopId: currentShop?.id,
      })
      setCurrentProduct((prev) => ({
        ...prev,
        quantity: result.movement.newStock,
      }))
      setAdjustQty('')
      toast.success(`Stock ${adjustType === 'in' ? 'added' : 'removed'} successfully`)
    } catch (error) {
      toast.error(getNetworkErrorMessage(error))
    } finally {
      setAdjusting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onClose} className="gap-1">
        <ArrowLeft className="size-4" />
        Back to Products
      </Button>

      {/* Product Header */}
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="size-24 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">
          {currentProduct.imageUrl ? (
            <img
              src={currentProduct.imageUrl}
              alt={currentProduct.name}
              className="size-full rounded-xl object-cover"
              loading="lazy"
            />
          ) : (
            currentProduct.productType?.icon || '📦'
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">{currentProduct.name}</h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span>{currentProduct.productType?.name}</span>
                {currentProduct.sku && (
                  <>
                    <span>•</span>
                    <span>SKU: {currentProduct.sku}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => onEdit(currentProduct)}
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </div>
          </div>
          {currentProduct.description && (
            <p className="text-muted-foreground mt-2 text-sm">{currentProduct.description}</p>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Current Stock</div>
            <div className="text-xl sm:text-2xl font-bold mt-1">{currentProduct.quantity}</div>
            <Badge variant={stockStatus.variant} className="mt-1 text-xs">
              {stockStatus.label}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Cost Price</div>
            <div className="text-xl sm:text-2xl font-bold mt-1">
              {formatETB(currentProduct.costPrice)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Selling Price</div>
            <div className="text-xl sm:text-2xl font-bold mt-1">
              {formatETB(currentProduct.sellingPrice)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Value</div>
            <div className="text-xl sm:text-2xl font-bold mt-1">
              {formatETB(currentProduct.quantity * currentProduct.sellingPrice)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stock Adjustment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Quick Stock Adjustment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 sm:gap-4 flex-wrap">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={adjustType}
                onValueChange={(v) => setAdjustType(v as 'in' | 'out')}
              >
                <SelectTrigger className="w-28 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Stock In</SelectItem>
                  <SelectItem value="out">Stock Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity</Label>
              <Input
                type="number"
                min="1"
                placeholder="Qty"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="w-24 h-9"
              />
            </div>
            <Button onClick={handleStockAdjust} disabled={adjusting} size="sm" className="h-9">
              {adjusting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUpDown className="size-4" />
              )}
              {adjusting ? 'Adjusting...' : 'Adjust'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Attributes */}
      {(currentProduct.attributeValues?.length || 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Attributes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentProduct.attributeValues?.map((av) => (
                <div
                  key={av.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <span className="text-sm text-muted-foreground">
                    {av.attributeDefinition?.name}
                  </span>
                  <span className="text-sm font-medium">
                    {av.attributeDefinition?.fieldType === 'boolean' || av.attributeDefinition?.fieldType === 'switch'
                      ? av.value === 'true'
                        ? 'Yes'
                        : 'No'
                      : av.attributeDefinition?.fieldType === 'image'
                      ? '📷 Image'
                      : av.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock Movements History */}
      {currentProduct.stockMovements && currentProduct.stockMovements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Stock History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {currentProduct.stockMovements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        movement.type === 'in'
                          ? 'default'
                          : movement.type === 'out'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="text-xs"
                    >
                      {movement.type.toUpperCase()}
                    </Badge>
                    <span className="text-muted-foreground">
                      {movement.reason || 'No reason'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      {movement.type === 'in' ? '+' : '-'}
                      {movement.quantity}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(movement.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================
// Loading Skeletons
// ============================================
function ProductsLoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-40" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ============================================
// Main Products Page
// ============================================
export function ProductsPage() {
  const { currentOrg, currentShop } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [loading, setLoading] = useState(true)
  const { search, setSearch, debouncedSearch } = usePageSearch()
  const [filterType, setFilterType] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Barcode dialog state
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null)
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false)

  // Bulk import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  // Detail view state
  const [viewingProduct, setViewingProduct] = useState<
    (Product & { stockMovements?: StockMovement[]; productType?: { id: string; name: string; icon?: string | null; attributes?: AttributeDefinition[] } }) | null
  >(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)
    setFetchError(null)
    try {
      const data = await api.getProducts(currentOrg.id, {
        productTypeId: filterType !== 'all' ? filterType : undefined,
        search: debouncedSearch || undefined,
        page,
        limit,
        shopId: currentShop?.id,
      })
      setProducts(data.products)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (error) {
      setFetchError(getNetworkErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [currentOrg, currentShop?.id, filterType, debouncedSearch, page, limit])

  const fetchProductTypes = useCallback(async () => {
    if (!currentOrg) return
    try {
      const data = await api.getProductTypes(currentOrg.id, currentShop?.id)
      setProductTypes(data.productTypes)
    } catch {
      // Silent fail for types - not critical
    }
  }, [currentOrg])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    fetchProductTypes()
  }, [fetchProductTypes])

  // Reset page when search/filter changes
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, filterType])

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setDialogOpen(true)
  }

  const handleViewDetail = async (product: Product) => {
    if (!currentOrg) return
    setLoadingDetail(true)
    try {
      // Fetch detailed product with stock movements
      const detailedProduct = await authFetch(`/api/products/${product.id}?orgId=${currentOrg.id}${currentShop ? `&shopId=${currentShop.id}` : ''}`)
        .then((r) => r.json())
      setViewingProduct(detailedProduct.product)
    } catch {
      // Fallback: show the product data we already have
      setViewingProduct(product)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleDelete = async () => {
    if (!currentOrg || !deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteProduct(deleteTarget.id, currentOrg.id)
      toast.success('Product deleted')
      setDeleteTarget(null)
      fetchProducts()
    } catch (error) {
      toast.error(getNetworkErrorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open)
    if (!open) setEditingProduct(null)
  }

  // If viewing a product detail, show the detail view
  if (viewingProduct) {
    return (
      <ProductDetailView
        product={viewingProduct}
        onClose={() => setViewingProduct(null)}
        onEdit={(product) => {
          setViewingProduct(null)
          handleEdit(product)
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your product catalog • {total} product{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setImportDialogOpen(true)}
            className="gap-2"
          >
            <FileDown className="size-4" />
            Import CSV
          </Button>
          <Button
            onClick={() => {
              setEditingProduct(null)
              setDialogOpen(true)
            }}
            className="gap-2"
          >
            <Plus className="size-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU..."
            aria-label="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {productTypes.map((pt) => (
              <SelectItem key={pt.id} value={pt.id}>
                {pt.icon || '📦'} {pt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Table */}
      {loading ? (
        <ProductsLoadingSkeleton />
      ) : fetchError ? (
        <ErrorState title="Failed to load products" message={fetchError} onRetry={fetchProducts} />
      ) : products.length === 0 ? (
        <EmptyState
          title={search || filterType !== 'all' ? 'No matching products' : 'No products yet'}
          message={search || filterType !== 'all'
            ? 'Try adjusting your search or filter.'
            : 'Add your first product to start managing your inventory.'}
          icon={<Package className="size-7 text-muted-foreground" />}
          action={!search && filterType === 'all' ? {
            label: 'Add Product',
            onClick: () => {
              setEditingProduct(null)
              setDialogOpen(true)
            },
          } : undefined}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const stockStatus = getStockStatus(
                    product.quantity,
                    product.lowStockThreshold
                  )
                  return (
                    <TableRow
                      key={product.id}
                      className="cursor-pointer"
                      onClick={() => handleViewDetail(product)}
                    >
                      <TableCell>
                        <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-lg overflow-hidden">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="size-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            product.productType?.icon || '📦'
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.sku || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">
                          {product.productType?.icon && (
                            <span className="mr-1">{product.productType.icon}</span>
                          )}
                          {product.productType?.name || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatETB(product.sellingPrice)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {product.quantity}
                      </TableCell>
                      <TableCell>
                        <Badge variant={stockStatus.variant} className="text-xs">
                          {stockStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 h-9 w-9 sm:h-8 sm:w-8"
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Actions for ${product.name}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewDetail(product)
                              }}
                            >
                              <Eye className="size-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                setBarcodeProduct(product)
                                setBarcodeDialogOpen(true)
                              }}
                            >
                              <QrCode className="size-4 mr-2" />
                              Barcode / QR Code
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEdit(product)
                              }}
                            >
                              <Pencil className="size-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteTarget(product)
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {products.map((product) => {
              const stockStatus = getStockStatus(product.quantity, product.lowStockThreshold)
              return (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleViewDetail(product)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="size-12 rounded-lg bg-muted flex items-center justify-center text-xl shrink-0 overflow-hidden">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          product.productType?.icon || '📦'
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{product.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {product.productType?.name}
                          {product.sku ? ` • ${product.sku}` : ''}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold">
                            {formatETB(product.sellingPrice)}
                          </span>
                          <Badge variant={stockStatus.variant} className="text-xs">
                            {product.quantity} in stock
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} • {total} results
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Barcode/QR Dialog */}
      <BarcodeDialog
        open={barcodeDialogOpen}
        onOpenChange={setBarcodeDialogOpen}
        product={barcodeProduct}
      />

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        productTypes={productTypes}
        onImportComplete={fetchProducts}
      />

      {/* Create/Edit Dialog — key forces fresh mount for add vs edit */}
      <ProductDialog
        key={editingProduct ? `edit-${editingProduct.id}` : 'add-new'}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        product={editingProduct}
        productTypes={productTypes}
        onSaved={fetchProducts}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>&quot;{deleteTarget?.name}&quot;</strong>?
              This action cannot be undone. The product and all its data will be permanently deleted,
              including stock history and attribute values.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

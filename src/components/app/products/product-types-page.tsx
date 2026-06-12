'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  Package,
  Layers,
  Loader2,
  MoreVertical,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, type ProductType } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getNetworkErrorMessage } from '@/lib/validation'
import { productTypeSchema, type ProductTypeFormData, type AttributeFormData } from '@/lib/validations'
import { ErrorState } from '@/components/shared/error-states'
import { FormInputField, FormSelectField, FormSwitchField, FormSubmitButton } from '@/components/shared/form-fields'
import { Form } from '@/components/ui/form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'


// ============================================
// Predefined Icons
// ============================================
const PREDEFINED_ICONS = [
  '📺', '📱', '💻', '🖥️', '⌚', '🎮', '📷', '🔊',
  '🖨️', '⌨️', '🖱️', '🎧', '🎤', '🔌', '🔋', '💡',
  '📦', '🛒', '👕', '👟', '🍔', '☕', '🧴', '💊',
  '🪑', '🛋️', '🔧', '🧰', '🚗', '🚲', '📚', '✏️',
]

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'image', label: 'Image' },
]

// ============================================
// Create/Edit Product Type Dialog
// ============================================
function ProductTypeDialog({
  open,
  onOpenChange,
  productType,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  productType: ProductType | null
  onSaved: () => void
}) {
  const { currentOrg } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)

  const isEditing = !!productType

  const form = useForm<ProductTypeFormData>({
    resolver: zodResolver(productTypeSchema),
    defaultValues: {
      name: '',
      icon: '',
      attributes: [],
    },
  })

  const { fields, append, remove, swap } = useFieldArray({
    control: form.control,
    name: 'attributes',
  })

  // Watch icon for reactive UI
  const watchedIcon = form.watch('icon')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (productType) {
        form.reset({
          name: productType.name,
          icon: productType.icon || '',
          attributes: (productType.attributes || []).map((attr) => {
            let parsedOptions: string[] | string | null = null
            if (attr.options) {
              try {
                parsedOptions = JSON.parse(attr.options)
              } catch {
                parsedOptions = null
              }
            }
            return {
              name: attr.name,
              fieldType: attr.fieldType as AttributeFormData['fieldType'],
              options: parsedOptions
                ? (Array.isArray(parsedOptions)
                  ? parsedOptions.join(',')
                  : String(parsedOptions))
                : '',
              required: attr.required,
            }
          }),
        })
      } else {
        form.reset({
          name: '',
          icon: '',
          attributes: [],
        })
      }
      setShowIconPicker(false)
    }
  }, [open, productType])

  const moveAttribute = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === fields.length - 1) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    swap(index, targetIndex)
  }

  const onSubmit = async (data: ProductTypeFormData) => {
    if (!currentOrg) return

    setSaving(true)
    try {
      const payload: {
        name: string
        icon?: string
        attributes?: Array<{
          name: string
          fieldType: string
          options?: string
          required?: boolean
        }>
      } = {
        name: data.name.trim(),
        icon: data.icon || undefined,
        attributes: data.attributes?.map((a) => ({
          name: a.name.trim(),
          fieldType: a.fieldType,
          options: a.fieldType === 'select' && a.options ? a.options : undefined,
          required: a.required,
        })),
      }

      if (isEditing && productType) {
        await api.updateProductType(productType.id, currentOrg.id, payload)
        toast.success('Product type updated successfully')
      } else {
        await api.createProductType(currentOrg.id, payload)
        toast.success('Product type created successfully')
      }

      onOpenChange(false)
      onSaved()
    } catch (error) {
      toast.error(getNetworkErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100%-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Product Type' : 'Create Product Type'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the product type details and attributes.'
              : 'Define a new product type with custom attributes.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-2">
            {/* Name & Icon */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
              <FormInputField
                name="name"
                label="Name"
                placeholder="e.g., TV, Phone, Laptop"
                required
              />
              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="relative">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 text-xl"
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    type="button"
                  >
                    {watchedIcon || '🏷️'}
                  </Button>
                  {showIconPicker && (
                    <div className="absolute top-12 right-0 z-50 bg-popover border rounded-lg shadow-lg p-3 w-64">
                      <div className="grid grid-cols-8 gap-1">
                        {PREDEFINED_ICONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="h-10 w-10 flex items-center justify-center text-lg hover:bg-accent rounded cursor-pointer"
                            onClick={() => {
                              form.setValue('icon', emoji)
                              setShowIconPicker(false)
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      {watchedIcon && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 w-full"
                          onClick={() => {
                            form.setValue('icon', '')
                            setShowIconPicker(false)
                          }}
                          type="button"
                        >
                          Remove Icon
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Attributes Builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Attributes</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: '', fieldType: 'text', options: '', required: false })}
                  className="gap-1"
                >
                  <Plus className="size-3.5" />
                  Add Attribute
                </Button>
              </div>

              {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <Layers className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No attributes defined yet.</p>
                  <p className="text-xs mt-1">Click &quot;Add Attribute&quot; to define custom fields for this product type.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="border rounded-lg p-3 space-y-3 bg-card"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col gap-0.5 pt-1">
                          <button
                            type="button"
                            onClick={() => moveAttribute(index, 'up')}
                            disabled={index === 0}
                            className="p-2 hover:bg-accent rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed min-w-9 min-h-9 flex items-center justify-center"
                          >
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveAttribute(index, 'down')}
                            disabled={index === fields.length - 1}
                            className="p-2 hover:bg-accent rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed min-w-9 min-h-9 flex items-center justify-center"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                        </div>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <FormInputField
                            name={`attributes.${index}.name` as const}
                            label="Name"
                            placeholder="e.g., inch, brand"
                            inputClassName="h-9"
                          />
                          <FormSelectField
                            name={`attributes.${index}.fieldType` as const}
                            label="Field Type"
                            options={FIELD_TYPES.map((ft) => ({ value: ft.value, label: ft.label }))}
                          />
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 mt-5"
                          onClick={() => remove(index)}
                        >
                          <X className="size-4 text-destructive" />
                        </Button>
                      </div>

                      {/* Options for Select type */}
                      {form.watch(`attributes.${index}.fieldType`) === 'select' && (
                        <div className="pl-8">
                          <FormInputField
                            name={`attributes.${index}.options` as const}
                            label="Options (comma-separated)"
                            placeholder="e.g., 4K, 1080p, 720p"
                            inputClassName="h-9"
                          />
                        </div>
                      )}

                      {/* Required toggle */}
                      <div className="flex items-center gap-2 pl-8">
                        <FormSwitchField
                          name={`attributes.${index}.required` as const}
                          label="Required"
                          className="border-0 p-0 gap-2"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} type="button">
                Cancel
              </Button>
              <FormSubmitButton isLoading={saving} loadingText="Saving...">
                {isEditing ? 'Save Changes' : 'Create'}
              </FormSubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Product Type Card
// ============================================
function ProductTypeCard({
  productType,
  onEdit,
  onDelete,
}: {
  productType: ProductType
  onEdit: (pt: ProductType) => void
  onDelete: (pt: ProductType) => void
}) {
  const attrCount = productType.attributes?.length || 0
  const productCount = productType._count?.products || 0

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl">
              {productType.icon || '📦'}
            </div>
            <div>
              <CardTitle className="text-base">{productType.name}</CardTitle>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{attrCount} {attrCount === 1 ? 'attribute' : 'attributes'}</span>
                <span className="text-border">•</span>
                <span>{productCount} {productCount === 1 ? 'product' : 'products'}</span>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 md:size-8 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(productType)}>
                <Pencil className="size-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(productType)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      {attrCount > 0 && (
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1.5">
            {productType.attributes?.map((attr) => (
              <Badge key={attr.id} variant="secondary" className="text-xs font-normal">
                {attr.name}
                <span className="ml-1 text-muted-foreground">
                  ({FIELD_TYPES.find((f) => f.value === attr.fieldType)?.label || attr.fieldType})
                </span>
                {attr.required && <span className="ml-0.5 text-red-500">*</span>}
              </Badge>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ============================================
// Loading Skeletons
// ============================================
function ProductTypesLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-14" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================
// Main Product Types Page
// ============================================
export function ProductTypesPage() {
  const { currentOrg, currentShop } = useAuthStore()
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<ProductType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductType | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchProductTypes = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)
    setFetchError(null)
    try {
      const data = await api.getProductTypes(currentOrg.id, currentShop?.id)
      setProductTypes(data.productTypes)
    } catch (error) {
      setFetchError(getNetworkErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [currentOrg, currentShop])

  useEffect(() => {
    fetchProductTypes()
  }, [fetchProductTypes])

  const filteredTypes = productTypes.filter(
    (pt) =>
      pt.name.toLowerCase().includes(search.toLowerCase()) ||
      pt.attributes?.some((a) =>
        a.name.toLowerCase().includes(search.toLowerCase())
      )
  )

  const handleEdit = (pt: ProductType) => {
    setEditingType(pt)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!currentOrg || !deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteProductType(deleteTarget.id, currentOrg.id)
      toast.success('Product type deleted')
      setDeleteTarget(null)
      fetchProductTypes()
    } catch (error) {
      toast.error(getNetworkErrorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Product Types</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Define product categories with custom attributes
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingType(null)
            setDialogOpen(true)
          }}
          className="gap-2"
        >
          <Plus className="size-4" />
          Add Product Type
        </Button>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search product types..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Product Types Grid */}
      {loading ? (
        <ProductTypesLoadingSkeleton />
      ) : fetchError ? (
        <ErrorState title="Failed to load product types" message={fetchError} onRetry={fetchProductTypes} />
      ) : filteredTypes.length === 0 ? (
        <div className="text-center py-16">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Package className="size-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">
            {search ? 'No matching product types' : 'No product types yet'}
          </h3>
          <p className="text-muted-foreground mt-1 max-w-md mx-auto text-sm">
            {search
              ? 'Try a different search term.'
              : 'Create your first product type to start organizing your inventory.'}
          </p>
          {!search && (
            <Button
              className="mt-4 gap-2"
              onClick={() => {
                setEditingType(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="size-4" />
              Add Product Type
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTypes.map((pt) => (
            <ProductTypeCard
              key={pt.id}
              productType={pt}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <ProductTypeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productType={editingType}
        onSaved={fetchProductTypes}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>&quot;{deleteTarget?.name}&quot;</strong>?
              This action cannot be undone. The product type and all its attribute definitions will be permanently deleted.
              {(deleteTarget?._count?.products || 0) > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ This product type has {deleteTarget?._count?.products} associated product(s).
                  Deleting it may affect those products.
                </span>
              )}
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

'use client'

import { useState, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  Upload,
  Loader2,
  Sparkles,
  X,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Image as ImageIcon,
  Package,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useAppStore } from '@/lib/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { getNetworkErrorMessage } from '@/lib/validation'
import { aiProductAnalysisSchema, type AIProductAnalysisFormData } from '@/lib/validations'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { FormInputField, FormTextareaField } from '@/components/shared/form-fields'

// ============================================
// Types
// ============================================
interface Attribute {
  key: string
  value: string
}

interface AnalysisResult {
  category: string
  suggestedName: string
  brand: string
  description: string
  attributes: Attribute[]
  confidence?: string
}

// ============================================
// AI Inventory Assistant Page
// ============================================
export function AIInventoryPage() {
  const { currentOrg, currentShop } = useAuthStore()
  const { setPage } = useAppStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Analysis results
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [editableAttributes, setEditableAttributes] = useState<Attribute[]>([])
  const [showResults, setShowResults] = useState(false)

  // Form for editable base fields
  const form = useForm<AIProductAnalysisFormData>({
    resolver: zodResolver(aiProductAnalysisSchema),
    defaultValues: {
      editableCategory: '',
      editableName: '',
      editableBrand: '',
      editableDescription: '',
    },
  })

  // Product types for matching
  const [productTypes, setProductTypes] = useState<Array<{ id: string; name: string; icon?: string | null }>>([])
  const [matchedTypeId, setMatchedTypeId] = useState<string | null>(null)

  // Load product types for category matching
  const loadProductTypes = useCallback(async () => {
    if (!currentOrg) return
    try {
      const data = await api.getProductTypes(currentOrg.id, currentShop?.id)
      setProductTypes(data.productTypes.map(pt => ({ id: pt.id, name: pt.name, icon: pt.icon })))
    } catch {
      // Silent fail for product type loading
    }
  }, [currentOrg, currentShop?.id])

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WEBP)')
      toast.error('Please select an image file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB')
      toast.error('Image must be less than 10MB')
      return
    }

    setSelectedFile(file)
    setError(null)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.onerror = () => {
      setError('Failed to read the image file. Please try another file.')
      setSelectedFile(null)
      setImagePreview(null)
    }
    reader.readAsDataURL(file)
  }, [])

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  // Analyze image
  const handleAnalyze = useCallback(async () => {
    if (!selectedFile || !currentOrg) return

    setIsAnalyzing(true)
    setError(null)

    try {
      const data = await api.analyzeProductImage(currentOrg.id, selectedFile)

      // Parse the actual API response - it returns { productInfo: {...} }
      const rawData = data as Record<string, unknown>
      const info = (rawData.productInfo || rawData.analysis || data) as Record<string, unknown>

      // Build attributes from the response
      let attrs: Attribute[] = []
      if (info.attributes) {
        if (Array.isArray(info.attributes)) {
          attrs = (info.attributes as Array<Record<string, string>>).map((a) => ({
            key: a.key || '',
            value: String(a.value || ''),
          }))
        } else if (typeof info.attributes === 'object') {
          attrs = Object.entries(info.attributes as Record<string, unknown>).map(([key, value]) => ({
            key,
            value: String(value || ''),
          }))
        }
      }

      // Add brand and model as attributes if present
      if (info.brand && !attrs.find(a => a.key.toLowerCase() === 'brand')) {
        attrs.unshift({ key: 'Brand', value: String(info.brand) })
      }
      if (info.model && !attrs.find(a => a.key.toLowerCase() === 'model')) {
        attrs.unshift({ key: 'Model', value: String(info.model) })
      }
      if (info.color && !attrs.find(a => a.key.toLowerCase() === 'color')) {
        attrs.push({ key: 'Color', value: String(info.color) })
      }

      const result: AnalysisResult = {
        category: String(info.category || ''),
        suggestedName: String(info.suggestedName || info.productName || ''),
        brand: String(info.brand || ''),
        description: String(info.description || ''),
        attributes: attrs,
        confidence: String(info.confidence || 'medium'),
      }

      form.reset({
        editableCategory: result.category,
        editableName: result.suggestedName,
        editableBrand: result.brand,
        editableDescription: result.description,
      })
      setAnalysisResult(result)

      // Load product types and try to match category
      await loadProductTypes()
      setShowResults(true)
    } catch (err) {
      const message = getNetworkErrorMessage(err)
      setError(message)
      toast.error('Analysis failed', { description: message })
    } finally {
      setIsAnalyzing(false)
    }
  }, [selectedFile, currentOrg, loadProductTypes])

  // Watch category for matching
  const watchedCategory = form.watch('editableCategory')

  // Match category to existing product type
  const matchCategoryToType = useCallback((category: string) => {
    if (!category || productTypes.length === 0) return null
    const lowerCat = category.toLowerCase().trim()
    const match = productTypes.find(pt => pt.name.toLowerCase() === lowerCat)
    return match?.id || null
  }, [productTypes])

  // Update matched type when category changes
  const handleCategoryChange = useCallback((value: string) => {
    const matchId = matchCategoryToType(value)
    setMatchedTypeId(matchId)
  }, [matchCategoryToType])

  // Attribute management
  const addAttribute = useCallback(() => {
    setEditableAttributes(prev => [...prev, { key: '', value: '' }])
  }, [])

  const removeAttribute = useCallback((index: number) => {
    setEditableAttributes(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateAttribute = useCallback((index: number, field: 'key' | 'value', val: string) => {
    setEditableAttributes(prev => prev.map((attr, i) =>
      i === index ? { ...attr, [field]: val } : attr
    ))
  }, [])

  // Save as product
  const handleSaveAsProduct = useCallback(() => {
    const currentCategory = form.getValues('editableCategory')
    const currentName = form.getValues('editableName')
    const currentDescription = form.getValues('editableDescription')

    // Validate form first
    const result = form.trigger()
    if (!result) {
      // form.trigger is async, but we use it below
    }

    // We'll validate and proceed
    void form.trigger().then((isValid) => {
      if (!isValid) {
        toast.error('Please fill in the required fields')
        return
      }

      if (!currentCategory) {
        toast.error('Please specify a category/product type')
        return
      }

      // Check if category matches existing product type
      const matchId = matchCategoryToType(currentCategory)

      if (matchId) {
        // Navigate to product creation with pre-filled data and matched type
        setPage('products', {
          mode: 'create',
          prefill: {
            productTypeId: matchId,
            name: currentName,
            description: currentDescription,
            attributes: editableAttributes.filter(a => a.key && a.value),
          },
        })
      } else {
        // Offer to create new product type
        setPage('product-types', {
          mode: 'create',
          prefill: {
            name: currentCategory,
            attributes: editableAttributes
              .filter(a => a.key && a.value)
              .map(a => ({ name: a.key, fieldType: 'text', required: false })),
          },
          returnTo: 'products',
          returnPrefill: {
            name: currentName,
            description: currentDescription,
            attributes: editableAttributes.filter(a => a.key && a.value),
          },
        })
        toast.info('No matching product type found', {
          description: `Creating a new "${currentCategory}" product type. You can then add the product.`,
        })
      }
    })
  }, [form, matchCategoryToType, editableAttributes, setPage])

  // Reset / Analyze another
  const handleReset = useCallback(() => {
    setSelectedFile(null)
    setImagePreview(null)
    setAnalysisResult(null)
    setShowResults(false)
    setError(null)
    form.reset({
      editableCategory: '',
      editableName: '',
      editableBrand: '',
      editableDescription: '',
    })
    setEditableAttributes([])
    setMatchedTypeId(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [form])

  // Example images (placeholder descriptions - clicking triggers a demo flow)
  const exampleProducts = [
    { name: 'Electronics', emoji: '📱', color: 'bg-blue-100 dark:bg-blue-950' },
    { name: 'Clothing', emoji: '👕', color: 'bg-purple-100 dark:bg-purple-950' },
    { name: 'Furniture', emoji: '🪑', color: 'bg-amber-100 dark:bg-amber-950' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="size-6 text-primary" />
            AI Inventory Assistant
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Upload a product image and let AI identify it, suggest details, and auto-fill product information.
          </p>
        </div>
        {showResults && (
          <Button variant="outline" size="sm" onClick={handleReset} className="shrink-0">
            <RotateCcw className="size-4 mr-1" />
            Analyze Another
          </Button>
        )}
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Left Panel: Upload Area */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upload Product Image</CardTitle>
              <CardDescription>Drag and drop or click to select an image of your product</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop zone */}
              {!imagePreview ? (
                <div
                  className={`
                    relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                    transition-all duration-200
                    ${isDragging
                      ? 'border-primary bg-brand-50 dark:bg-brand-900/20 scale-[1.02]'
                      : 'border-muted-foreground/25 hover:border-primary/60 hover:bg-brand-50/50 dark:hover:bg-brand-900/10'
                    }
                  `}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-16 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                      {isDragging ? (
                        <Upload className="size-8 text-primary animate-bounce" />
                      ) : (
                        <Camera className="size-8 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {isDragging ? 'Drop image here' : 'Click to upload or drag & drop'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        PNG, JPG, WEBP up to 10MB
                      </p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileSelect(file)
                    }}
                  />
                </div>
              ) : (
                <div className="relative group">
                  <div className="rounded-xl overflow-hidden border bg-muted/30">
                    <img
                      src={imagePreview}
                      alt="Product preview"
                      className="w-full h-64 object-contain bg-background"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 size-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleReset}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}

              {/* Analyze button */}
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                size="lg"
                disabled={!selectedFile || isAnalyzing}
                onClick={handleAnalyze}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="size-5 mr-2 animate-spin" />
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-5 mr-2" />
                    Analyze with AI
                  </>
                )}
              </Button>

              {/* Error display */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                >
                  <AlertCircle className="size-5 text-red-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">Analysis Failed</p>
                    <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={handleAnalyze}
                  >
                    Retry
                  </Button>
                </motion.div>
              )}

              {/* Loading animation */}
              {isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/30">
                    <Loader2 className="size-5 text-primary animate-spin" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        AI is analyzing your image...
                      </p>
                      <p className="text-xs text-primary">
                        Identifying product category, brand, and attributes
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 8, ease: 'easeInOut' }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Example images section */}
              {!showResults && !isAnalyzing && (
                <div className="pt-2">
                  <Separator className="mb-4" />
                  <p className="text-sm text-muted-foreground mb-3">Try with a sample:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {exampleProducts.map((example) => (
                      <button
                        key={example.name}
                        className={`
                          flex flex-col items-center gap-2 p-3 rounded-lg border
                          hover:border-primary/60 hover:bg-brand-50/50 dark:hover:bg-brand-900/10
                          transition-colors cursor-pointer
                          ${example.color}
                        `}
                        onClick={() => {
                          toast.info('Demo mode', {
                            description: `Upload a real ${example.name.toLowerCase()} image to see AI analysis in action!`,
                          })
                        }}
                      >
                        <span className="text-2xl">{example.emoji}</span>
                        <span className="text-xs font-medium">{example.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Results */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {showResults && analysisResult ? (
              <motion.div
                key="results"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Confidence indicator */}
                {analysisResult?.confidence && (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        analysisResult.confidence === 'high'
                          ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400'
                          : analysisResult.confidence === 'medium'
                            ? 'border-amber-500 text-amber-700 dark:text-amber-400'
                            : 'border-red-500 text-red-700 dark:text-red-400'
                      }
                    >
                      <CheckCircle2 className="size-3 mr-1" />
                      {analysisResult.confidence.charAt(0).toUpperCase() + analysisResult.confidence.slice(1)} confidence
                    </Badge>
                  </div>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="size-5 text-primary" />
                      AI Analysis Results
                    </CardTitle>
                    <CardDescription>
                      Review and edit the AI-suggested product details before saving
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <Form {...form}>
                      <form className="space-y-5">
                        {/* Category / Product Type */}
                        <div className="space-y-2">
                          <FormLabel>Category / Product Type</FormLabel>
                          {productTypes.length > 0 ? (
                            <FormField
                              name="editableCategory"
                              render={({ field }) => (
                                <FormItem>
                                  <Select value={matchedTypeId || '__custom__'} onValueChange={(val) => {
                                    if (val === '__custom__') {
                                      setMatchedTypeId(null)
                                      form.setValue('editableCategory', '')
                                    } else {
                                      const pt = productTypes.find(t => t.id === val)
                                      if (pt) {
                                        form.setValue('editableCategory', pt.name)
                                        setMatchedTypeId(val)
                                      }
                                    }
                                  }}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select or type a category" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {productTypes.map(pt => (
                                        <SelectItem key={pt.id} value={pt.id}>
                                          {pt.icon && <span className="mr-1">{pt.icon}</span>}
                                          {pt.name}
                                        </SelectItem>
                                      ))}
                                      <SelectItem value="__custom__">
                                        <span className="text-muted-foreground">Custom category...</span>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ) : null}
                          {(matchedTypeId === null || !matchedTypeId) && (
                            <FormInputField name="editableCategory" placeholder="e.g., Shoes, Electronics, Clothing" required />
                          )}
                          {matchedTypeId && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="size-3" />
                              Matched existing product type
                            </p>
                          )}
                          {!matchedTypeId && watchedCategory && productTypes.length > 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertCircle className="size-3" />
                              No matching product type — a new one will be created
                            </p>
                          )}
                        </div>

                        {/* Suggested Name */}
                        <FormInputField name="editableName" label="Suggested Name" placeholder="Product name" required />

                        {/* Brand */}
                        <FormInputField name="editableBrand" label="Brand" placeholder="Brand name" />

                        {/* Description */}
                        <FormTextareaField name="editableDescription" label="Description" placeholder="Product description" rows={3} />

                        {/* Detected Attributes */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <FormLabel>Detected Attributes</FormLabel>
                            <Button type="button" variant="outline" size="sm" onClick={addAttribute}>
                              <Plus className="size-3.5 mr-1" />
                              Add
                            </Button>
                          </div>

                          {editableAttributes.length === 0 ? (
                            <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                              No attributes detected. Click &quot;Add&quot; to create custom attributes.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <AnimatePresence>
                                {editableAttributes.map((attr, index) => (
                                  <motion.div
                                    key={index}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-center gap-3"
                                  >
                                    <Input
                                      value={attr.key}
                                      onChange={(e) => updateAttribute(index, 'key', e.target.value)}
                                      placeholder="Attribute name"
                                      className="flex-1"
                                    />
                                    <Input
                                      value={attr.value}
                                      onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                                      placeholder="Value"
                                      className="flex-1"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => removeAttribute(index)}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>

                        <Separator />

                        {/* Action buttons */}
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button
                            type="button"
                            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                            onClick={handleSaveAsProduct}
                            disabled={!watchedCategory}
                          >
                            <Save className="size-4 mr-2" />
                            Save as Product
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleReset}
                          >
                            <RotateCcw className="size-4 mr-2" />
                            Analyze Another
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </motion.div>
            ) : !isAnalyzing ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <ImageIcon className="size-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-base font-semibold">No Analysis Yet</h3>
                    <p className="text-muted-foreground mt-2 max-w-sm">
                      Upload a product image on the left and click &quot;Analyze with AI&quot; to get started. The AI will identify the product and suggest details.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

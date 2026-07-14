'use client'

import { useState, useRef } from 'react'
import {
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, type ProductType } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getNetworkErrorMessage } from '@/lib/validation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productTypes: ProductType[]
  onImportComplete: () => void
}

interface ParsedRow {
  name: string
  sku: string
  productType: string
  costPrice: string
  sellingPrice: string
  quantity: string
  lowStockThreshold: string
}

interface ImportResult {
  successCount: number
  failureCount: number
  errors: Array<{ row: number; field: string; message: string }>
  totalAttempted: number
}

const CSV_TEMPLATE = `name,sku,productType,costPrice,sellingPrice,quantity,lowStockThreshold
Samsung TV 55",TV-SAM-55,Electronics,5000,8000,10,5
Wireless Mouse,MOUSE-WL-01,Accessories,200,500,50,10
USB-C Cable,CABLE-USB-C,Accessories,50,150,100,20`

function parseCSV(csvText: string): ParsedRow[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  // Parse header
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())

  // Required columns
  const requiredCols = ['name', 'costprice', 'sellingprice']
  const hasRequired = requiredCols.every((col) =>
    header.some((h) => h.replace(/[\s_-]/g, '') === col.replace(/[\s_-]/g, ''))
  )

  if (!hasRequired) {
    toast.error('CSV must contain at least: name, costPrice, sellingPrice columns')
    return []
  }

  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Simple CSV parsing (handles quoted values)
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())

    // Map values to columns
    const row: ParsedRow = {
      name: '',
      sku: '',
      productType: '',
      costPrice: '',
      sellingPrice: '',
      quantity: '',
      lowStockThreshold: '',
    }

    header.forEach((col, idx) => {
      const normalizedCol = col.replace(/[\s_-]/g, '')
      const value = values[idx] || ''

      if (normalizedCol === 'name') row.name = value
      else if (normalizedCol === 'sku') row.sku = value
      else if (normalizedCol === 'producttype') row.productType = value
      else if (normalizedCol === 'costprice') row.costPrice = value
      else if (normalizedCol === 'sellingprice') row.sellingPrice = value
      else if (normalizedCol === 'quantity') row.quantity = value
      else if (normalizedCol === 'lowstockthreshold') row.lowStockThreshold = value
    })

    rows.push(row)
  }

  return rows
}

export function BulkImportDialog({
  open,
  onOpenChange,
  productTypes,
  onImportComplete,
}: BulkImportDialogProps) {
  const { currentOrg, currentShop } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'results'>('upload')
  const [csvText, setCsvText] = useState('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importProgress, setImportProgress] = useState(0)

  const resetState = () => {
    setStep('upload')
    setCsvText('')
    setParsedRows([])
    setImportResult(null)
    setImportProgress(0)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      toast.error('Please upload a CSV file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvText(text)
      const rows = parseCSV(text)
      if (rows.length > 0) {
        setParsedRows(rows)
        setStep('preview')
      }
    }
    reader.readAsText(file)
  }

  const handlePasteText = () => {
    if (!csvText.trim()) {
      toast.error('Please paste CSV content first')
      return
    }
    const rows = parseCSV(csvText)
    if (rows.length > 0) {
      setParsedRows(rows)
      setStep('preview')
    }
  }

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'product-import-template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Template downloaded')
  }

  const handleImport = async () => {
    if (!currentOrg || parsedRows.length === 0) return

    setStep('importing')
    setImportProgress(0)

    try {
      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 10, 90))
      }, 500)

      const result = await api.importProducts(currentOrg.id, {
        shopId: currentShop?.id,
        products: parsedRows.map((row) => ({
          name: row.name,
          sku: row.sku || undefined,
          productType: row.productType || undefined,
          costPrice: Number(row.costPrice) || 0,
          sellingPrice: Number(row.sellingPrice) || 0,
          quantity: Number(row.quantity) || 0,
          lowStockThreshold: Number(row.lowStockThreshold) || 10,
        })),
      })

      clearInterval(progressInterval)
      setImportProgress(100)

      setImportResult(result)
      setStep('results')

      if (result.successCount > 0) {
        onImportComplete()
      }
    } catch (error) {
      toast.error(getNetworkErrorMessage(error))
      setStep('preview')
    }
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState()
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto w-[calc(100%-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle>Import Products from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file or paste CSV text to import products in bulk
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* File Upload */}
            <Card>
              <CardContent className="p-6">
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload CSV file</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports .csv files up to 5MB
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Paste CSV */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Paste CSV Text</label>
              <textarea
                className="w-full min-h-[9.231rem] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={`Paste CSV content here...\nname,sku,productType,costPrice,sellingPrice,quantity,lowStockThreshold\nSamsung TV,TV-001,Electronics,5000,8000,10,5`}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handlePasteText}
                disabled={!csvText.trim()}
              >
                Parse CSV
              </Button>
            </div>

            {/* Download Template */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadTemplate}
                className="text-xs gap-1"
              >
                <Download className="size-3.5" />
                Download CSV Template
              </Button>
            </div>

            {/* Column reference */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <p className="text-xs font-medium mb-2">Required CSV Columns:</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="default" className="text-xs">name *</Badge>
                  <Badge variant="outline" className="text-xs">sku</Badge>
                  <Badge variant="outline" className="text-xs">productType</Badge>
                  <Badge variant="default" className="text-xs">costPrice *</Badge>
                  <Badge variant="default" className="text-xs">sellingPrice *</Badge>
                  <Badge variant="outline" className="text-xs">quantity</Badge>
                  <Badge variant="outline" className="text-xs">lowStockThreshold</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Available product types: {productTypes.length > 0 ? productTypes.map((pt) => pt.name).join(', ') : 'None (create one first)'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-primary" />
                <span className="text-sm font-medium">
                  {parsedRows.length} product{parsedRows.length !== 1 ? 's' : ''} found
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep('upload')
                  setParsedRows([])
                }}
                className="text-xs"
              >
                Back to Upload
              </Button>
            </div>

            {/* Preview Table */}
            <div className="border rounded-lg overflow-x-auto max-h-[30.769rem] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, idx) => {
                    const hasErrors =
                      !row.name.trim() ||
                      !row.costPrice ||
                      !row.sellingPrice ||
                      Number(row.sellingPrice) <= 0
                    return (
                      <TableRow key={idx} className={hasErrors ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium text-sm">
                          {row.name || <span className="text-destructive">Missing</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.sku || '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.productType || <span className="text-muted-foreground">Default</span>}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {row.costPrice || <span className="text-destructive text-xs">Missing</span>}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {row.sellingPrice || <span className="text-destructive text-xs">Missing</span>}
                        </TableCell>
                        <TableCell className="text-right text-sm">{row.quantity || '0'}</TableCell>
                        <TableCell className="text-right text-sm">{row.lowStockThreshold || '10'}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <Loader2 className="size-10 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm font-medium">Importing products...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please wait while we process your data
              </p>
            </div>
            <Progress value={importProgress} className="h-2" />
            <p className="text-center text-xs text-muted-foreground">{importProgress}% complete</p>
          </div>
        )}

        {/* Step: Results */}
        {step === 'results' && importResult && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{importResult.totalAttempted}</div>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 dark:border-emerald-900/50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {importResult.successCount}
                  </div>
                  <p className="text-xs text-muted-foreground">Imported</p>
                </CardContent>
              </Card>
              <Card className={importResult.failureCount > 0 ? 'border-red-200 dark:border-red-900/50' : ''}>
                <CardContent className="p-4 text-center">
                  <div className={`text-2xl font-bold ${importResult.failureCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {importResult.failureCount}
                  </div>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </CardContent>
              </Card>
            </div>

            {/* Success Message */}
            {importResult.successCount > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  {importResult.successCount} product{importResult.successCount !== 1 ? 's' : ''} imported successfully!
                </p>
              </div>
            )}

            {/* Errors */}
            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  <p className="text-sm font-medium">
                    {importResult.errors.length} error{importResult.errors.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="max-h-[15.385rem] overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead className="w-28">Field</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.errors.map((err, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-mono">{err.row}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {err.field}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-destructive">{err.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === 'preview' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('upload')
                  setParsedRows([])
                }}
                className="w-full sm:w-auto"
              >
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={parsedRows.length === 0}
                className="w-full sm:w-auto gap-2"
              >
                <Upload className="size-4" />
                Import {parsedRows.length} Product{parsedRows.length !== 1 ? 's' : ''}
              </Button>
            </>
          )}
          {step === 'results' && (
            <Button onClick={() => handleClose(false)} className="w-full sm:w-auto">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

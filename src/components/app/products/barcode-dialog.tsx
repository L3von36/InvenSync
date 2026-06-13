'use client'

import { useState, useMemo } from 'react'
import { Download, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { api, type Product } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getNetworkErrorMessage } from '@/lib/validation'
import { generateProductBarcode } from '@/lib/barcode'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface BarcodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}

import { formatETB } from '@/lib/format'

export function BarcodeDialog({ open, onOpenChange, product }: BarcodeDialogProps) {
  const { currentOrg } = useAuthStore()
  // Generate barcode data when dialog opens
  const barcodeData = useMemo(() => {
    if (!open || !product) return null
    return generateProductBarcode({
      id: product.id,
      name: product.name,
      sku: product.sku,
    })
  }, [open, product])

  const [loading] = useState(false)
  const [printing, setPrinting] = useState(false)

  const handleDownload = (dataUrl: string, filename: string) => {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`${filename} downloaded`)
  }

  const handlePrint = () => {
    if (!product || !barcodeData) return
    setPrinting(true)

    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) {
      toast.error('Could not open print window. Please allow popups.')
      setPrinting(false)
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Product Label - ${product.name}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            margin: 0;
          }
          .label {
            border: 2px dashed #ccc;
            padding: 20px;
            text-align: center;
            max-width: 300px;
          }
          .product-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 8px;
          }
          .sku {
            font-size: 12px;
            color: #666;
            margin-bottom: 12px;
          }
          .price {
            font-size: 18px;
            font-weight: bold;
            color: #ea580c;
            margin-bottom: 12px;
          }
          .barcode-img, .qr-img {
            max-width: 250px;
            margin: 8px auto;
          }
          .code-label {
            font-size: 10px;
            color: #999;
            margin-top: 4px;
          }
          @media print {
            body { padding: 0; }
            .label { border: 1px solid #000; }
          }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="product-name">${product.name}</div>
          ${product.sku ? `<div class="sku">SKU: ${product.sku}</div>` : ''}
          <div class="price">${formatETB(product.sellingPrice)}</div>
          <img class="barcode-img" src="${barcodeData.barcode}" alt="Barcode" />
          <div class="code-label">Barcode${product.sku ? `: ${product.sku}` : `: ${product.id}`}</div>
          <hr style="margin: 12px 0; border-color: #eee;" />
          <img class="qr-img" src="${barcodeData.qr}" alt="QR Code" />
          <div class="code-label">QR Code</div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.close();
          }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()

    setTimeout(() => setPrinting(false), 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto w-[calc(100%-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle>Product Barcode & QR Code</DialogTitle>
          <DialogDescription>
            Generate and print barcodes for product labeling
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : product && barcodeData ? (
          <div className="space-y-4">
            {/* Product Info */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{product.name}</p>
                    {product.sku && (
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        SKU: {product.sku}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {formatETB(product.sellingPrice)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Barcode */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Barcode
              </div>
              <div className="flex items-center justify-center bg-white border rounded-lg p-4">
                <img
                  src={barcodeData.barcode}
                  alt={`Barcode for ${product.name}`}
                  className="max-w-full h-auto"
                  style={{ maxWidth: '300px' }}
                  loading="lazy"
                />
              </div>
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() =>
                    handleDownload(
                      barcodeData.barcode,
                      `${product.sku || product.id}-barcode.svg`
                    )
                  }
                >
                  <Download className="size-3.5 mr-1" />
                  Download Barcode
                </Button>
              </div>
            </div>

            <Separator />

            {/* QR Code */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                QR Code
              </div>
              <div className="flex items-center justify-center bg-white border rounded-lg p-4">
                <img
                  src={barcodeData.qr}
                  alt={`QR code for ${product.name}`}
                  className="max-w-full h-auto"
                  style={{ maxWidth: '200px' }}
                  loading="lazy"
                />
              </div>
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() =>
                    handleDownload(
                      barcodeData.qr,
                      `${product.sku || product.id}-qrcode.svg`
                    )
                  }
                >
                  <Download className="size-3.5 mr-1" />
                  Download QR Code
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No product selected
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
          <Button
            onClick={handlePrint}
            disabled={!barcodeData || printing}
            className="w-full sm:w-auto gap-2"
          >
            {printing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Printer className="size-4" />
            )}
            Print Label
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

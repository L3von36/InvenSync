import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyOrgAccess } from '@/lib/auth'
import { isDatabaseError } from '@/lib/api-error'

function formatETB(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' ETB'
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function paymentMethodLabel(method: string): string {
  switch (method) {
    case 'cash': return 'Cash'
    case 'card': return 'Card'
    case 'mobile_money': return 'Mobile Money'
    case 'credit': return 'Credit'
    default: return method
  }
}

// GET /api/sales/[id]/receipt?orgId=xxx
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const hasAccess = await verifyOrgAccess(user, orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sale = await db.sale.findFirst({
      where: { id, organizationId: orgId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true, address: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true }
            }
          }
        },
        organization: {
          select: { id: true, name: true, phone: true, address: true, city: true, logoUrl: true }
        },
        shop: {
          select: { id: true, name: true, phone: true, address: true, city: true }
        }
      }
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    const org = sale.organization
    const shop = sale.shop
    const saleDate = new Date(sale.saleDate)

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${sale.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      body { background: white; }
      .no-print { display: none !important; }
      .receipt-wrapper { box-shadow: none; margin: 0; max-width: 100%; }
    }
    .receipt-wrapper {
      max-width: 400px;
      margin: 20px auto;
      background: white;
      padding: 24px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }
    .header {
      text-align: center;
      border-bottom: 2px dashed #ccc;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .business-name {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .business-info {
      font-size: 11px;
      color: #666;
      line-height: 1.4;
    }
    .receipt-title {
      text-align: center;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 12px 0 8px;
      color: #555;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      padding: 3px 0;
      color: #444;
    }
    .meta-row .label { color: #888; }
    .divider {
      border: none;
      border-top: 1px dashed #ccc;
      margin: 10px 0;
    }
    .items-header {
      display: grid;
      grid-template-columns: 1fr 40px 70px 70px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      padding: 6px 0;
      border-bottom: 1px solid #ddd;
    }
    .item-row {
      display: grid;
      grid-template-columns: 1fr 40px 70px 70px;
      font-size: 11px;
      padding: 6px 0;
      border-bottom: 1px dotted #eee;
    }
    .item-name { font-weight: 500; }
    .item-sku { font-size: 9px; color: #999; }
    .item-right { text-align: right; }
    .totals-section {
      margin-top: 8px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      padding: 3px 0;
      color: #444;
    }
    .total-row.grand {
      font-size: 15px;
      font-weight: 700;
      padding: 8px 0;
      border-top: 2px solid #1a1a1a;
      margin-top: 6px;
      color: #1a1a1a;
    }
    .total-row.paid {
      color: #16a34a;
      font-weight: 500;
    }
    .footer {
      text-align: center;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 2px dashed #ccc;
    }
    .footer p {
      font-size: 10px;
      color: #999;
      line-height: 1.6;
    }
    .footer .thank-you {
      font-size: 12px;
      font-weight: 600;
      color: #555;
      margin-bottom: 4px;
    }
    .print-btn-wrapper {
      text-align: center;
      margin: 20px auto;
      max-width: 400px;
    }
    .print-btn {
      background: #0f172a;
      color: white;
      border: none;
      padding: 10px 24px;
      font-size: 13px;
      border-radius: 6px;
      cursor: pointer;
    }
    .print-btn:hover { background: #1e293b; }
  </style>
</head>
<body>
  <div class="print-btn-wrapper no-print">
    <button class="print-btn" onclick="window.print()">Print Receipt</button>
  </div>
  <div class="receipt-wrapper">
    <div class="header">
      <div class="business-name">${org.name}</div>
      <div class="business-info">
        ${shop ? `${shop.name}<br>` : ''}
        ${org.address || ''}${org.city ? `, ${org.city}` : ''}<br>
        ${org.phone ? `Tel: ${org.phone}` : ''}
      </div>
    </div>

    <div class="receipt-title">Receipt</div>

    <div class="meta-row">
      <span><span class="label">Receipt #:</span> ${sale.invoiceNumber}</span>
      <span><span class="label">Date:</span> ${formatDate(saleDate)}</span>
    </div>

    ${sale.customer ? `
    <div class="meta-row">
      <span><span class="label">Customer:</span> ${sale.customer.name}</span>
    </div>
    ${sale.customer.phone ? `<div class="meta-row"><span><span class="label">Phone:</span> ${sale.customer.phone}</span></div>` : ''}
    ` : `
    <div class="meta-row">
      <span><span class="label">Customer:</span> Walk-in</span>
    </div>
    `}

    <hr class="divider">

    <div class="items-header">
      <span>Item</span>
      <span style="text-align:right">Qty</span>
      <span style="text-align:right">Price</span>
      <span style="text-align:right">Total</span>
    </div>

    ${sale.items.map(item => `
    <div class="item-row">
      <div>
        <div class="item-name">${item.product?.name || 'Unknown'}</div>
        ${item.product?.sku ? `<div class="item-sku">${item.product.sku}</div>` : ''}
      </div>
      <div class="item-right">${item.quantity}</div>
      <div class="item-right">${formatETB(item.unitPrice)}</div>
      <div class="item-right">${formatETB(item.total)}</div>
    </div>
    `).join('')}

    <hr class="divider">

    <div class="totals-section">
      <div class="total-row">
        <span>Subtotal</span>
        <span>${formatETB(sale.subtotal)}</span>
      </div>
      ${sale.discount > 0 ? `
      <div class="total-row">
        <span>Discount</span>
        <span style="color:#dc2626">-${formatETB(sale.discount)}</span>
      </div>
      ` : ''}
      ${sale.tax > 0 ? `
      <div class="total-row">
        <span>Tax</span>
        <span>${formatETB(sale.tax)}</span>
      </div>
      ` : ''}
      <div class="total-row grand">
        <span>Total</span>
        <span>${formatETB(sale.total)}</span>
      </div>
      <div class="total-row paid">
        <span>Paid (${paymentMethodLabel(sale.paymentMethod)})</span>
        <span>${formatETB(sale.amountPaid)}</span>
      </div>
      ${sale.total - sale.amountPaid > 0.01 ? `
      <div class="total-row" style="color:#dc2626">
        <span>Balance Due</span>
        <span>${formatETB(sale.total - sale.amountPaid)}</span>
      </div>
      ` : ''}
    </div>

    ${sale.notes ? `
    <hr class="divider">
    <div style="font-size:10px;color:#888;">
      <strong>Notes:</strong> ${sale.notes}
    </div>
    ` : ''}

    <div class="footer">
      <div class="thank-you">Thank you for your purchase!</div>
      <p>Powered by InvenSync</p>
    </div>
  </div>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'DB_UNREACHABLE' },
        { status: 503 }
      )
    }
    console.error('Receipt generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

// GET /api/sales/[id]/invoice?orgId=xxx
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
          select: { id: true, name: true, phone: true, address: true, city: true, country: true, email: true, logoUrl: true }
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
    const dueDate = new Date(saleDate)
    dueDate.setDate(dueDate.getDate() + 30)

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice - ${sale.invoiceNumber}</title>
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
      .invoice-wrapper { box-shadow: none; margin: 0; max-width: 100%; }
    }
    .invoice-wrapper {
      max-width: 800px;
      margin: 20px auto;
      background: white;
      padding: 40px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
    }
    .business-info h1 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 4px;
      color: #0f172a;
    }
    .business-info p {
      font-size: 12px;
      color: #666;
      line-height: 1.5;
    }
    .invoice-badge {
      text-align: right;
    }
    .invoice-badge .title {
      font-size: 28px;
      font-weight: 300;
      color: #0f172a;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .invoice-badge .number {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      margin-top: 4px;
    }
    .invoice-details {
      display: flex;
      justify-content: space-between;
      margin-bottom: 32px;
      gap: 24px;
    }
    .detail-block {
      flex: 1;
    }
    .detail-block h3 {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #999;
      margin-bottom: 8px;
    }
    .detail-block p {
      font-size: 12px;
      line-height: 1.6;
      color: #444;
    }
    .detail-block .name {
      font-weight: 600;
      color: #1a1a1a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    thead th {
      background: #0f172a;
      color: white;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      text-align: left;
    }
    thead th.right { text-align: right; }
    tbody td {
      padding: 10px 12px;
      font-size: 12px;
      border-bottom: 1px solid #eee;
      color: #444;
    }
    tbody td.right { text-align: right; }
    tbody td.name-cell {
      font-weight: 500;
      color: #1a1a1a;
    }
    tbody td.sku {
      font-size: 10px;
      color: #999;
      font-weight: 400;
    }
    tbody tr:last-child td { border-bottom: none; }
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }
    .totals-table {
      width: 280px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 12px;
      color: #666;
    }
    .total-row.grand {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      padding: 10px 0 6px;
      border-top: 2px solid #0f172a;
      margin-top: 8px;
    }
    .total-row.paid {
      color: #16a34a;
      font-weight: 600;
    }
    .total-row.balance {
      color: #dc2626;
      font-weight: 600;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-completed { background: #dcfce7; color: #16a34a; }
    .status-pending { background: #fef3c7; color: #d97706; }
    .status-cancelled { background: #fee2e2; color: #dc2626; }
    .status-refunded { background: #dbeafe; color: #2563eb; }
    .footer-section {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .footer-section .notes {
      max-width: 50%;
    }
    .footer-section .notes h4 {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #999;
      margin-bottom: 4px;
    }
    .footer-section .notes p {
      font-size: 11px;
      color: #666;
      line-height: 1.5;
    }
    .footer-section .branding {
      text-align: right;
      font-size: 10px;
      color: #bbb;
    }
    .print-btn-wrapper {
      text-align: center;
      margin: 20px auto;
      max-width: 800px;
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
    <button class="print-btn" onclick="window.print()">Print Invoice</button>
  </div>
  <div class="invoice-wrapper">
    <div class="invoice-header">
      <div class="business-info">
        <h1>${org.name}</h1>
        <p>
          ${org.address || ''}${org.city ? `, ${org.city}` : ''}${org.country ? `, ${org.country}` : ''}<br>
          ${org.phone ? `Tel: ${org.phone}` : ''}
          ${org.email ? `<br>Email: ${org.email}` : ''}
        </p>
      </div>
      <div class="invoice-badge">
        <div class="title">Invoice</div>
        <div class="number">${sale.invoiceNumber}</div>
        <span class="status-badge status-${sale.status}">${sale.status}</span>
      </div>
    </div>

    <div class="invoice-details">
      <div class="detail-block">
        <h3>Bill To</h3>
        ${sale.customer ? `
        <p>
          <span class="name">${sale.customer.name}</span><br>
          ${sale.customer.address ? `${sale.customer.address}<br>` : ''}
          ${sale.customer.phone ? `Tel: ${sale.customer.phone}<br>` : ''}
          ${sale.customer.email ? `Email: ${sale.customer.email}` : ''}
        </p>
        ` : `
        <p><span class="name">Walk-in Customer</span></p>
        `}
      </div>
      <div class="detail-block">
        <h3>Invoice Details</h3>
        <p>
          <strong>Date:</strong> ${formatDate(saleDate)}<br>
          <strong>Due Date:</strong> ${formatDate(dueDate)}<br>
          ${shop ? `<strong>Location:</strong> ${shop.name}${shop.city ? `, ${shop.city}` : ''}<br>` : ''}
          <strong>Payment:</strong> ${paymentMethodLabel(sale.paymentMethod)}
        </p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:40%">Description</th>
          <th class="right" style="width:10%">Qty</th>
          <th class="right" style="width:17%">Unit Price</th>
          <th class="right" style="width:17%">Discount</th>
          <th class="right" style="width:16%">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${sale.items.map(item => `
        <tr>
          <td class="name-cell">
            ${item.product?.name || 'Unknown'}
            ${item.product?.sku ? `<br><span class="sku">SKU: ${item.product.sku}</span>` : ''}
          </td>
          <td class="right">${item.quantity}</td>
          <td class="right">${formatETB(item.unitPrice)}</td>
          <td class="right">—</td>
          <td class="right" style="font-weight:500">${formatETB(item.total)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals-section">
      <div class="totals-table">
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
          <span>Amount Paid</span>
          <span>${formatETB(sale.amountPaid)}</span>
        </div>
        ${sale.total - sale.amountPaid > 0.01 ? `
        <div class="total-row balance">
          <span>Balance Due</span>
          <span>${formatETB(sale.total - sale.amountPaid)}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="footer-section">
      <div class="notes">
        ${sale.notes ? `
        <h4>Notes</h4>
        <p>${sale.notes}</p>
        ` : `
        <h4>Terms</h4>
        <p>Payment is due within 30 days. Please reference invoice number on your payment.</p>
        `}
      </div>
      <div class="branding">
        Powered by InvenSync
      </div>
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
    console.error('Invoice generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

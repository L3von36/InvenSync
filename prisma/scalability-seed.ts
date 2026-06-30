/**
 * Scalability Seed Data Generator for InvenSync
 * 
 * Generates realistic test data at different scales:
 *   npx tsx prisma/scalability-seed.ts --scale 1
 *   npx tsx prisma/scalability-seed.ts --scale 10
 *   npx tsx prisma/scalability-seed.ts --scale 100
 *   npx tsx prisma/scalability-seed.ts --scale 1000
 *   npx tsx prisma/scalability-seed.ts --scale 5000
 *   npx tsx prisma/scalability-seed.ts --scale 10000
 * 
 * Options:
 *   --scale N       Number of records per entity (default: 100)
 *   --clean         Clean scalability data before seeding
 *   --org-only      Only seed for a specific orgId
 *   --batch-size N  Insert batch size (default: 500 for SQLite)
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient({
  log: ['error'],
})

// ============================================
// Ethiopian Business Data for Realistic Seeds
// ============================================

const ETHIOPIAN_FIRST_NAMES = [
  'Abebe', 'Tadesse', 'Mulugeta', 'Kebede', 'Assefa', 'Demeke', 'Worku', 'Hailu',
  'Girma', 'Bekele', 'Alemu', 'Tesfaye', 'Dinkesa', 'Mekonnen', 'Fikru', 'Shiferaw',
  'Wondimu', 'Teshome', 'Ayalew', 'Bogale', 'Dagne', 'Gashaw', 'Moges', 'Seifu',
  'Selamawit', 'Meron', 'Hana', 'Tigist', 'Aster', 'Frehiwot', 'Hiwot', 'Bizunesh',
  'Mastewal', 'Eleni', 'Genet', 'Abera', 'Yeshi', 'Wubalem', 'Sosina', 'Lidya',
  'Daniel', 'Yonas', 'Bereket', 'Natnael', 'Samuel', 'Ermias', 'Biniyam', 'Feven',
  'Helen', 'Sara', 'Marta', 'Kidist', 'Mahlet', 'Tiruwork', 'Zewditu', 'Worknesh',
]

const ETHIOPIAN_LAST_NAMES = [
  'Tadesse', 'Bekele', 'Kebede', 'Alemu', 'Girma', 'Worku', 'Hailu', 'Assefa',
  'Demeke', 'Mekonnen', 'Tesfaye', 'Fikru', 'Shiferaw', 'Wondimu', 'Ayalew',
  'Gebremariam', 'Abate', 'Dessalegn', 'Tsegaye', 'Mulugeta', 'Wolde', 'Gebre',
  'Teshome', 'Bogale', 'Dagne', 'Zewde', 'Mengistu', 'Adera', 'Fisseha', 'Woldeyesus',
]

const PRODUCT_PREFIXES = [
  'Addis', 'Sheger', 'Ethio', 'Habesha', 'Lalibela', 'Axum', 'Gondar', 'Bahir Dar',
  'Harar', 'Jimma', 'Dire', 'Adama', 'Hawassa', 'Mekelle', 'Debre', 'Shashamane',
  'Arbaminch', 'Wolkite', 'Nekemte', 'Jijiga',
]

const PRODUCT_CATEGORIES = {
  Electronics: [
    'Smartphone', 'Laptop', 'Tablet', 'Headphones', 'Speaker', 'Charger', 'Cable',
    'Power Bank', 'Mouse', 'Keyboard', 'Monitor', 'Printer', 'Camera', 'USB Drive',
    'Earbuds', 'Smartwatch', 'Router', 'Hard Drive', 'SSD', 'RAM Module',
  ],
  Clothing: [
    'T-Shirt', 'Shirt', 'Trousers', 'Dress', 'Jacket', 'Sweater', 'Scarf',
    'Shoes', 'Socks', 'Hat', 'Belt', 'Tie', 'Skirt', 'Coat', 'Jeans',
  ],
  Food: [
    'Coffee Beans', 'Teff Flour', 'Injera', 'Berbere Spice', 'Shiro Powder',
    'Niter Kibbeh', 'Honey', 'Lentils', 'Chickpeas', 'Sesame Oil', 'Pepper',
    'Wheat Flour', 'Sugar', 'Rice', 'Pasta',
  ],
  'Home & Garden': [
    'Chair', 'Table', 'Lamp', 'Carpet', 'Curtain', 'Pillow', 'Blanket',
    'Vase', 'Picture Frame', 'Clock', 'Mirror', 'Shelf', 'Basket', 'Mat', 'Rug',
  ],
  'Beauty & Health': [
    'Soap', 'Shampoo', 'Lotion', 'Perfume', 'Lipstick', 'Mascara', 'Nail Polish',
    'Face Cream', 'Body Oil', 'Hair Oil', 'Toothpaste', 'Deodorant', 'Sunscreen',
  ],
  'Office Supplies': [
    'Pen', 'Notebook', 'Stapler', 'Paper Clip', 'Folder', 'Binder', 'Envelope',
    'Calculator', 'Scissors', 'Tape', 'Glue', 'Marker', 'Ruler', 'Eraser',
  ],
  'Construction': [
    'Cement', 'Rebar', 'Nails', 'Paint', 'Brush', 'Pipe', 'Wire',
    'Switch', 'Socket', 'Tile', 'Glass', 'Door', 'Window', 'Lock', 'Hinge',
  ],
}

const EXPENSE_CATEGORIES = ['rent', 'salary', 'utilities', 'marketing', 'supplies', 'transport', 'other']

const PAYMENT_METHODS = ['cash', 'card', 'mobile_money', 'credit']

const CITIES = [
  'Addis Ababa', 'Adama', 'Hawassa', 'Bahir Dar', 'Mekelle', 'Jimma',
  'Gondar', 'Dire Dawa', 'Harar', 'Shashamane', 'Nekemte', 'Jijiga',
]

const STREETS = [
  'Bole Road', 'Mexico Square', 'Merkato', 'Piassa', 'Kazanchis', 'CMC Road',
  'Sarbet', 'Kolfe', 'Lideta', 'Kirkos', 'Yeka', 'Gulele',
  'Chat Share', 'Saris', 'Jemmo', 'Gotera', 'Megenagna', 'Kotebe',
]

// ============================================
// Helper Functions
// ============================================

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

function randomPhone(): string {
  return `+2519${randomInt(10000000, 99999999)}`
}

function randomEmail(name: string, idx: number): string {
  const clean = name.toLowerCase().replace(/[^a-z]/g, '')
  return `${clean}${idx}@example.et`
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

function randomProductName(): string {
  const prefix = randomFrom(PRODUCT_PREFIXES)
  const category = randomFrom(Object.keys(PRODUCT_CATEGORIES))
  const item = randomFrom(PRODUCT_CATEGORIES[category as keyof typeof PRODUCT_CATEGORIES])
  return `${prefix} ${item}`
}

// ============================================
// Parse CLI Arguments
// ============================================

function parseArgs() {
  const args = process.argv.slice(2)
  let scale = 100
  let clean = false
  let orgOnly: string | null = null
  let batchSize = 500

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scale' && args[i + 1]) {
      scale = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--clean') {
      clean = true
    } else if (args[i] === '--org-only' && args[i + 1]) {
      orgOnly = args[i + 1]
      i++
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      batchSize = parseInt(args[i + 1], 10)
      i++
    }
  }

  return { scale, clean, orgOnly, batchSize }
}

// ============================================
// Main Seed Function
// ============================================

async function main() {
  const { scale, clean, orgOnly, batchSize } = parseArgs()
  
  console.log(`\n🚀 Scalability Seed Generator`)
  console.log(`   Scale: ${scale} records per entity`)
  console.log(`   Batch size: ${batchSize}`)
  console.log(`   Clean: ${clean}`)
  console.log(`   Org only: ${orgOnly || 'all scalability orgs'}`)
  console.log('')

  const startTime = Date.now()

  // Create or find the scalability test organization and user
  const passwordHash = await hash('scalability123', 12)
  
  let testUser = await prisma.user.findUnique({ where: { email: 'scalability@invensync.com' } })
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: 'scalability@invensync.com',
        name: 'Scalability Test User',
        passwordHash,
        role: 'user',
      }
    })
    console.log('✅ Created scalability test user')
  }

  // Create test organization
  const orgSlug = `scalability-test-${scale}`
  let testOrg = await prisma.organization.findUnique({ where: { slug: orgSlug } })
  
  if (testOrg && clean) {
    console.log('🧹 Cleaning existing scalability data...')
    await cleanScalabilityData(testOrg.id)
    testOrg = null
  }

  if (!testOrg) {
    testOrg = await prisma.organization.create({
      data: {
        name: `Scalability Test Org (${scale} records)`,
        slug: orgSlug,
        currency: 'ETB',
        country: 'Ethiopia',
        businessType: 'retail',
        description: `Test organization with ${scale} records per entity for scalability testing`,
        address: `${randomFrom(STREETS)}, ${randomFrom(CITIES)}`,
        city: 'Addis Ababa',
        phone: '+251111111111',
        subscriptionPlan: 'professional',
        subscriptionStatus: 'active',
      }
    })
    console.log(`✅ Created test organization: ${testOrg.name}`)
  }

  // Add user as org member
  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: testUser.id, organizationId: testOrg.id } },
    create: { userId: testUser.id, organizationId: testOrg.id, role: 'owner' },
    update: {},
  })

  if (orgOnly && orgOnly !== testOrg.id) {
    console.log('Skipping - org-only specified and does not match')
    return
  }

  const orgId = testOrg.id

  // Create shops
  const numShops = Math.min(Math.max(1, Math.ceil(scale / 50)), 10)
  console.log(`\n📦 Creating ${numShops} shops...`)
  const shops: { id: string; name: string }[] = []
  for (let i = 0; i < numShops; i++) {
    const city = CITIES[i % CITIES.length]
    const shop = await prisma.shop.create({
      data: {
        organizationId: orgId,
        name: `${city} Branch ${i + 1}`,
        address: `${randomFrom(STREETS)}, ${city}`,
        city,
        phone: randomPhone(),
      }
    })
    shops.push(shop)
  }

  // Ensure inventory module is active
  const inventoryModule = await prisma.module.findFirst({ where: { key: 'inventory' } })
  if (inventoryModule) {
    await prisma.organizationModule.upsert({
      where: { organizationId_moduleId: { organizationId: orgId, moduleId: inventoryModule.id } },
      create: { organizationId: orgId, moduleId: inventoryModule.id, status: 'active', priceAtActivation: 0 },
      update: { status: 'active' },
    })
  }
  const salesModule = await prisma.module.findFirst({ where: { key: 'sales' } })
  if (salesModule) {
    await prisma.organizationModule.upsert({
      where: { organizationId_moduleId: { organizationId: orgId, moduleId: salesModule.id } },
      create: { organizationId: orgId, moduleId: salesModule.id, status: 'active', priceAtActivation: 0 },
      update: { status: 'active' },
    })
  }
  const customersModule = await prisma.module.findFirst({ where: { key: 'customers' } })
  if (customersModule) {
    await prisma.organizationModule.upsert({
      where: { organizationId_moduleId: { organizationId: orgId, moduleId: customersModule.id } },
      create: { organizationId: orgId, moduleId: customersModule.id, status: 'active', priceAtActivation: 0 },
      update: { status: 'active' },
    })
  }
  const debtsModule = await prisma.module.findFirst({ where: { key: 'debts' } })
  if (debtsModule) {
    await prisma.organizationModule.upsert({
      where: { organizationId_moduleId: { organizationId: orgId, moduleId: debtsModule.id } },
      create: { organizationId: orgId, moduleId: debtsModule.id, status: 'active', priceAtActivation: 0 },
      update: { status: 'active' },
    })
  }

  // Create product types
  console.log(`\n📂 Creating product types...`)
  const productTypes: { id: string; name: string }[] = []
  const categories = Object.keys(PRODUCT_CATEGORIES)
  for (const category of categories) {
    const pt = await prisma.productType.create({
      data: {
        organizationId: orgId,
        name: category,
        icon: 'Package',
      }
    })
    productTypes.push(pt)
  }

  // ============================================
  // BATCH INSERT: Products
  // ============================================
  console.log(`\n📦 Creating ${scale} products (batch size: ${batchSize})...`)
  const productStartTime = Date.now()
  const products: { id: string; name: string; costPrice: number; sellingPrice: number; quantity: number; shopId: string | null }[] = []
  
  for (let i = 0; i < scale; i += batchSize) {
    const batch = Math.min(batchSize, scale - i)
    const productData: Prisma.ProductCreateManyInput[] = []
    
    for (let j = 0; j < batch; j++) {
      const idx = i + j
      const pt = productTypes[idx % productTypes.length]
      const costPrice = randomFloat(50, 50000)
      const sellingPrice = randomFloat(costPrice * 1.1, costPrice * 2.5)
      const shop = shops[idx % shops.length]
      
      productData.push({
        productTypeId: pt.id,
        organizationId: orgId,
        shopId: idx % 3 === 0 ? null : shop.id, // 1/3 shared products
        sku: `SKU-${String(idx + 1).padStart(6, '0')}`,
        name: randomProductName(),
        description: `Product ${idx + 1} for scalability testing`,
        quantity: randomInt(0, 500),
        costPrice,
        sellingPrice,
        lowStockThreshold: randomInt(5, 50),
        isActive: Math.random() > 0.05, // 95% active
      })
    }

    const created = await prisma.product.createMany({ data: productData })
    // Fetch back the created products (we need IDs)
    const newProducts = await prisma.product.findMany({
      where: {
        organizationId: orgId,
        sku: { in: productData.map(p => p.sku!) },
      },
      select: { id: true, name: true, costPrice: true, sellingPrice: true, quantity: true, shopId: true },
    })
    products.push(...newProducts)
    
    process.stdout.write(`\r   Products: ${Math.min(i + batchSize, scale)}/${scale}`)
  }
  console.log(`\n   ✅ Products created in ${Date.now() - productStartTime}ms`)

  // ============================================
  // BATCH INSERT: Suppliers
  // ============================================
  const numSuppliers = Math.min(scale, 500)
  console.log(`\n🏭 Creating ${numSuppliers} suppliers...`)
  const supplierStartTime = Date.now()
  const suppliers: { id: string }[] = []
  
  for (let i = 0; i < numSuppliers; i += batchSize) {
    const batch = Math.min(batchSize, numSuppliers - i)
    const supplierData: Prisma.SupplierCreateManyInput[] = []
    for (let j = 0; j < batch; j++) {
      const idx = i + j
      const name = `${randomFrom(PRODUCT_PREFIXES)} ${randomFrom(['Trading', 'Import', 'Export', 'Supply', 'Wholesale', 'Enterprise', 'Group', 'Industries'])}`
      supplierData.push({
        organizationId: orgId,
        shopId: shops[idx % shops.length].id,
        name,
        email: randomEmail(name.split(' ')[0], idx),
        phone: randomPhone(),
        address: `${randomFrom(STREETS)}, ${randomFrom(CITIES)}`,
      })
    }
    await prisma.supplier.createMany({ data: supplierData })
    const newSuppliers = await prisma.supplier.findMany({
      where: { organizationId: orgId },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: numSuppliers,
    })
    suppliers.push(...newSuppliers)
  }
  console.log(`   ✅ Suppliers created in ${Date.now() - supplierStartTime}ms`)

  // ============================================
  // BATCH INSERT: Customers
  // ============================================
  console.log(`\n👥 Creating ${scale} customers...`)
  const customerStartTime = Date.now()
  const customers: { id: string }[] = []
  
  for (let i = 0; i < scale; i += batchSize) {
    const batch = Math.min(batchSize, scale - i)
    const customerData: Prisma.CustomerCreateManyInput[] = []
    for (let j = 0; j < batch; j++) {
      const idx = i + j
      const firstName = randomFrom(ETHIOPIAN_FIRST_NAMES)
      const lastName = randomFrom(ETHIOPIAN_LAST_NAMES)
      customerData.push({
        organizationId: orgId,
        shopId: shops[idx % shops.length].id,
        name: `${firstName} ${lastName}`,
        email: randomEmail(firstName.toLowerCase(), idx),
        phone: randomPhone(),
        address: `${randomFrom(STREETS)}, ${randomFrom(CITIES)}`,
      })
    }
    await prisma.customer.createMany({ data: customerData })
    const newCustomers = await prisma.customer.findMany({
      where: { organizationId: orgId },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: scale,
    })
    customers.push(...newCustomers)
  }
  console.log(`   ✅ Customers created in ${Date.now() - customerStartTime}ms`)

  // ============================================
  // BATCH INSERT: Sales with SaleItems
  // ============================================
  const numSales = Math.min(scale, 10000) // Cap at 10K sales to keep it reasonable
  console.log(`\n💰 Creating ${numSales} sales with line items...`)
  const salesStartTime = Date.now()
  const sales: { id: string }[] = []
  
  for (let i = 0; i < numSales; i += batchSize) {
    const batch = Math.min(batchSize, numSales - i)
    
    for (let j = 0; j < batch; j++) {
      const idx = i + j
      const customer = customers[idx % customers.length]
      const shop = shops[idx % shops.length]
      const paymentMethod = randomFrom(PAYMENT_METHODS)
      const numItems = randomInt(1, 5)
      
      // Pick random products for items
      const saleProducts: typeof products = []
      for (let k = 0; k < numItems; k++) {
        saleProducts.push(products[Math.floor(Math.random() * products.length)])
      }
      
      const discount = Math.random() > 0.7 ? randomFloat(0, 500) : 0
      const tax = Math.random() > 0.8 ? randomFloat(0, 200) : 0
      
      const subtotal = saleProducts.reduce((sum, p) => sum + p.sellingPrice * randomInt(1, 3), 0)
      const total = subtotal - discount + tax
      const amountPaid = paymentMethod === 'credit' 
        ? randomFloat(0, total * 0.5) 
        : total

      const saleDate = randomDate(new Date('2024-01-01'), new Date('2025-12-31'))

      try {
        const sale = await prisma.sale.create({
          data: {
            organizationId: orgId,
            shopId: shop.id,
            customerId: customer.id,
            invoiceNumber: `INV-SCALE-${String(idx + 1).padStart(6, '0')}`,
            status: Math.random() > 0.05 ? 'completed' : 'pending',
            paymentMethod,
            subtotal,
            discount,
            tax,
            total,
            amountPaid,
            notes: null,
            saleDate,
          }
        })
        sales.push(sale)

        // Create sale items
        for (const product of saleProducts) {
          const qty = randomInt(1, 3)
          await prisma.saleItem.create({
            data: {
              saleId: sale.id,
              productId: product.id,
              quantity: qty,
              unitPrice: product.sellingPrice,
              costPrice: product.costPrice,
              total: product.sellingPrice * qty,
            }
          })
        }

        // Create stock movements for completed sales
        if (sale.status === 'completed') {
          for (const product of saleProducts) {
            const qty = randomInt(1, 3)
            await prisma.stockMovement.create({
              data: {
                organizationId: orgId,
                shopId: shop.id,
                productId: product.id,
                type: 'out',
                quantity: qty,
                previousStock: product.quantity + qty,
                newStock: product.quantity,
                reason: 'Sale',
                reference: sale.invoiceNumber,
              }
            })
          }
        }
      } catch (err) {
        // Skip individual sale failures gracefully
      }

      process.stdout.write(`\r   Sales: ${Math.min(idx + 1, numSales)}/${numSales}`)
    }
  }
  console.log(`\n   ✅ Sales created in ${Date.now() - salesStartTime}ms`)

  // ============================================
  // BATCH INSERT: Expenses
  // ============================================
  const numExpenses = Math.min(scale, 5000)
  console.log(`\n💸 Creating ${numExpenses} expenses...`)
  const expenseStartTime = Date.now()
  
  for (let i = 0; i < numExpenses; i += batchSize) {
    const batch = Math.min(batchSize, numExpenses - i)
    const expenseData: Prisma.ExpenseCreateManyInput[] = []
    for (let j = 0; j < batch; j++) {
      const idx = i + j
      expenseData.push({
        organizationId: orgId,
        shopId: shops[idx % shops.length].id,
        category: randomFrom(EXPENSE_CATEGORIES),
        amount: randomFloat(100, 50000),
        description: `${randomFrom(EXPENSE_CATEGORIES)} expense #${idx + 1}`,
        expenseDate: randomDate(new Date('2024-01-01'), new Date('2025-12-31')),
        isRecurring: Math.random() > 0.8,
        recurringPeriod: Math.random() > 0.8 ? randomFrom(['monthly', 'weekly', 'yearly']) : null,
      })
    }
    await prisma.expense.createMany({ data: expenseData })
    process.stdout.write(`\r   Expenses: ${Math.min(i + batchSize, numExpenses)}/${numExpenses}`)
  }
  console.log(`\n   ✅ Expenses created in ${Date.now() - expenseStartTime}ms`)

  // ============================================
  // BATCH INSERT: Debts
  // ============================================
  const numDebts = Math.min(scale, 3000)
  console.log(`\n💳 Creating ${numDebts} debts...`)
  const debtStartTime = Date.now()
  
  for (let i = 0; i < numDebts; i += batchSize) {
    const batch = Math.min(batchSize, numDebts - i)
    const debtData: Prisma.DebtCreateManyInput[] = []
    for (let j = 0; j < batch; j++) {
      const idx = i + j
      const isCustomer = Math.random() > 0.3
      const amount = randomFloat(500, 100000)
      const paidAmount = Math.random() > 0.5 ? randomFloat(0, amount * 0.8) : 0
      
      debtData.push({
        organizationId: orgId,
        shopId: shops[idx % shops.length].id,
        customerId: isCustomer ? customers[idx % customers.length].id : null,
        supplierId: !isCustomer ? suppliers[idx % suppliers.length].id : null,
        type: isCustomer ? 'customer_debt' : 'supplier_debt',
        amount,
        paidAmount,
        dueDate: randomDate(new Date('2025-01-01'), new Date('2025-12-31')),
        status: paidAmount >= amount ? 'paid' : paidAmount > 0 ? 'partial' : 'pending',
        description: `${isCustomer ? 'Customer' : 'Supplier'} debt #${idx + 1}`,
      })
    }
    await prisma.debt.createMany({ data: debtData })
    process.stdout.write(`\r   Debts: ${Math.min(i + batchSize, numDebts)}/${numDebts}`)
  }
  console.log(`\n   ✅ Debts created in ${Date.now() - debtStartTime}ms`)

  // ============================================
  // BATCH INSERT: Stock Movements (additional)
  // ============================================
  const numMovements = Math.min(scale, 5000)
  console.log(`\n📦 Creating ${numMovements} additional stock movements...`)
  const movementStartTime = Date.now()
  
  for (let i = 0; i < numMovements; i += batchSize) {
    const batch = Math.min(batchSize, numMovements - i)
    const movementData: Prisma.StockMovementCreateManyInput[] = []
    for (let j = 0; j < batch; j++) {
      const idx = i + j
      const product = products[idx % products.length]
      const type = randomFrom(['in', 'out', 'adjustment'])
      const qty = randomInt(1, 100)
      
      movementData.push({
        organizationId: orgId,
        shopId: shops[idx % shops.length].id,
        productId: product.id,
        type,
        quantity: qty,
        previousStock: product.quantity,
        newStock: type === 'out' ? Math.max(0, product.quantity - qty) : product.quantity + qty,
        reason: randomFrom(['Restock', 'Adjustment', 'Transfer', 'Damaged', 'Return']),
      })
    }
    await prisma.stockMovement.createMany({ data: movementData })
    process.stdout.write(`\r   Movements: ${Math.min(i + batchSize, numMovements)}/${numMovements}`)
  }
  console.log(`\n   ✅ Stock movements created in ${Date.now() - movementStartTime}ms`)

  // ============================================
  // Print Summary
  // ============================================
  const totalTime = Date.now() - startTime
  console.log('\n' + '='.repeat(60))
  console.log('📊 SEED SUMMARY')
  console.log('='.repeat(60))
  console.log(`  Scale: ${scale} records per entity`)
  console.log(`  Organization ID: ${orgId}`)
  console.log(`  Organization Slug: ${orgSlug}`)
  console.log(`  User Email: scalability@invensync.com`)
  console.log(`  User Password: scalability123`)
  console.log(`  Products: ${products.length}`)
  console.log(`  Customers: ${customers.length}`)
  console.log(`  Suppliers: ${suppliers.length}`)
  console.log(`  Sales: ${sales.length}`)
  console.log(`  Expenses: ${numExpenses}`)
  console.log(`  Debts: ${numDebts}`)
  console.log(`  Stock Movements: ${numMovements}`)
  console.log(`  Shops: ${shops.length}`)
  console.log(`  Product Types: ${productTypes.length}`)
  console.log(`  Total Time: ${(totalTime / 1000).toFixed(2)}s`)
  console.log('='.repeat(60))
  console.log(`\n  📋 Use these values for benchmarking:`)
  console.log(`     ORG_ID=${orgId}`)
  console.log(`     ORG_SLUG=${orgSlug}`)
}

async function cleanScalabilityData(orgId: string) {
  console.log('  Cleaning stock movements...')
  await prisma.stockMovement.deleteMany({ where: { organizationId: orgId } })
  console.log('  Cleaning sale items...')
  await prisma.saleItem.deleteMany({ where: { sale: { organizationId: orgId } } })
  console.log('  Cleaning sales...')
  await prisma.sale.deleteMany({ where: { organizationId: orgId } })
  console.log('  Cleaning debt payments...')
  await prisma.debtPayment.deleteMany({ where: { debt: { organizationId: orgId } } })
  console.log('  Cleaning debts...')
  await prisma.debt.deleteMany({ where: { organizationId: orgId } })
  console.log('  Cleaning expenses...')
  await prisma.expense.deleteMany({ where: { organizationId: orgId } })
  console.log('  Cleaning product attribute values...')
  await prisma.productAttributeValue.deleteMany({ where: { product: { organizationId: orgId } } })
  console.log('  Cleaning products...')
  await prisma.product.deleteMany({ where: { organizationId: orgId } })
  console.log('  Cleaning product types...')
  await prisma.productType.deleteMany({ where: { organizationId: orgId } })
  console.log('  Cleaning customers...')
  await prisma.customer.deleteMany({ where: { organizationId: orgId } })
  console.log('  Cleaning suppliers...')
  await prisma.supplier.deleteMany({ where: { organizationId: orgId } })
  console.log('  Cleaning shop members...')
  await prisma.shopMember.deleteMany({ where: { shop: { organizationId: orgId } } })
  console.log('  Cleaning shops...')
  await prisma.shop.deleteMany({ where: { organizationId: orgId } })
  console.log('  Cleaning organization modules...')
  await prisma.organizationModule.deleteMany({ where: { organizationId: orgId } })
  console.log('  Cleaning organization...')
  await prisma.organization.deleteMany({ where: { id: orgId } })
  console.log('  ✅ Clean completed')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

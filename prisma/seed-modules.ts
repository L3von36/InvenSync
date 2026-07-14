import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================
// Module definitions - everything is a module!
// Free modules: always available, no cost
// Paid modules: 30-day free trial on signup, then must purchase
// Keys MUST match what's in the database (seed.ts) and what
// the module-guard.ts ROUTE_MODULE_MAP references.
// ============================================
const modules = [
  // CORE - These are the basic modules that come free
  {
    key: 'inventory',
    name: 'Inventory Management',
    description: 'Track products, stock levels, and inventory movements across all your shops',
    icon: 'Package',
    category: 'core',
    priceETB: 0,
    isFree: true,
    freeTrialDays: 0,
    billingCycle: 'monthly',
    order: 0,
  },
  {
    key: 'sales',
    name: 'Sales & POS',
    description: 'Process sales, manage invoices, and track revenue with point-of-sale functionality',
    icon: 'ShoppingCart',
    category: 'core',
    priceETB: 0,
    isFree: true,
    freeTrialDays: 0,
    billingCycle: 'monthly',
    order: 1,
  },
  {
    key: 'debts',
    name: 'Debt & Credit Tracking',
    description: 'Track customer and supplier debts, manage credit and payment plans',
    icon: 'HandCoins',
    category: 'core',
    priceETB: 0,
    isFree: true,
    freeTrialDays: 0,
    billingCycle: 'monthly',
    order: 2,
  },
  {
    key: 'customers',
    name: 'Customer Management',
    description: 'Manage customer relationships, purchase history, and loyalty tracking',
    icon: 'Users',
    category: 'core',
    priceETB: 0,
    isFree: true,
    freeTrialDays: 0,
    billingCycle: 'monthly',
    order: 3,
  },
  {
    key: 'suppliers',
    name: 'Supplier Management',
    description: 'Manage supplier relationships, purchase orders, and supply chain tracking',
    icon: 'Truck',
    category: 'core',
    priceETB: 0,
    isFree: true,
    freeTrialDays: 0,
    billingCycle: 'monthly',
    order: 4,
  },
  {
    key: 'multi-shop',
    name: 'Multi-Shop Management',
    description: 'Manage multiple shop locations, assign staff, and track performance per shop',
    icon: 'Store',
    category: 'core',
    priceETB: 0,
    isFree: true,
    freeTrialDays: 0,
    billingCycle: 'monthly',
    order: 5,
  },
  // PAID - Service booking (trial for 30 days)
  {
    key: 'services',
    name: 'Service Booking',
    description: 'Book appointments, manage service schedules, and track service revenue',
    icon: 'Wrench',
    category: 'core',
    priceETB: 75,
    isFree: false,
    freeTrialDays: 30,
    billingCycle: 'monthly',
    order: 6,
  },
  // PAID - Analytics modules (trial for 30 days)
  {
    key: 'reports',
    name: 'Reports & Analytics',
    description: 'Advanced sales reports, profit analysis, and inventory insights with visual charts',
    icon: 'BarChart3',
    category: 'analytics',
    priceETB: 50,
    isFree: false,
    freeTrialDays: 30,
    billingCycle: 'monthly',
    order: 6,
  },
  {
    key: 'low-stock-alerts',
    name: 'Low Stock Alerts',
    description: 'Get automatic notifications when products fall below threshold levels',
    icon: 'AlertTriangle',
    category: 'analytics',
    priceETB: 30,
    isFree: false,
    freeTrialDays: 30,
    billingCycle: 'monthly',
    order: 7,
  },
  {
    key: 'demand-forecast',
    name: 'Demand Forecasting',
    description: 'AI-powered demand prediction based on historical sales data and trends',
    icon: 'TrendingUp',
    category: 'analytics',
    priceETB: 100,
    isFree: false,
    freeTrialDays: 30,
    billingCycle: 'monthly',
    order: 8,
  },
  // AI modules - Premium tier
  {
    key: 'ai-business-assistant',
    name: 'AI Business Assistant',
    description: 'Ask questions about your business data and get AI-powered insights and recommendations',
    icon: 'Brain',
    category: 'ai',
    priceETB: 75,
    isFree: false,
    freeTrialDays: 30,
    billingCycle: 'monthly',
    order: 9,
  },
  {
    key: 'ai-inventory-assistant',
    name: 'AI Inventory Assistant',
    description: 'Scan product images to auto-fill product details using AI vision technology',
    icon: 'ScanSearch',
    category: 'ai',
    priceETB: 75,
    isFree: false,
    freeTrialDays: 30,
    billingCycle: 'monthly',
    order: 10,
  },
  // FINANCE - Ethiopian tax assistance (Proclamation 1395/2025 aware)
  {
    key: 'tax-assistant',
    name: 'Tax Assistant',
    description: 'Estimate your Ethiopian taxes from your sales records: Category A/B classification, live tax estimates, VAT threshold warnings, and filing deadline reminders',
    icon: 'Calculator',
    category: 'analytics',
    priceETB: 60,
    isFree: false,
    freeTrialDays: 30,
    billingCycle: 'monthly',
    order: 13,
  },
  // Integration modules
  {
    key: 'telegram-bot',
    name: 'Telegram Bot',
    description: 'Get inventory updates and sales reports directly through your Telegram bot',
    icon: 'Send',
    category: 'integration',
    priceETB: 40,
    isFree: false,
    freeTrialDays: 30,
    billingCycle: 'monthly',
    order: 11,
  },
  {
    key: 'whatsapp-business',
    name: 'WhatsApp Business',
    description: 'Send notifications and receive orders via WhatsApp Business API integration',
    icon: 'MessageSquare',
    category: 'integration',
    priceETB: 60,
    isFree: false,
    freeTrialDays: 30,
    billingCycle: 'monthly',
    order: 12,
  },
]

async function main() {
  console.log('🌱 Seeding modules with pricing...')

  // Seed modules (upsert to avoid duplicates)
  for (const moduleData of modules) {
    await prisma.module.upsert({
      where: { key: moduleData.key },
      update: {
        name: moduleData.name,
        description: moduleData.description,
        icon: moduleData.icon,
        category: moduleData.category,
        priceETB: moduleData.priceETB,
        isFree: moduleData.isFree,
        freeTrialDays: moduleData.freeTrialDays,
        billingCycle: moduleData.billingCycle,
        order: moduleData.order,
        isActive: true,
      },
      create: {
        key: moduleData.key,
        name: moduleData.name,
        description: moduleData.description,
        icon: moduleData.icon,
        category: moduleData.category,
        priceETB: moduleData.priceETB,
        isFree: moduleData.isFree,
        freeTrialDays: moduleData.freeTrialDays,
        billingCycle: moduleData.billingCycle,
        order: moduleData.order,
        isActive: true,
      }
    })
    console.log(`  ✅ Upserted module: ${moduleData.key} (${moduleData.isFree ? 'FREE' : `${moduleData.priceETB} ETB/mo`})`)
  }

  // Create default "Main Shop" for each existing organization that doesn't have any shops
  const organizations = await prisma.organization.findMany()
  let shopsCreated = 0

  for (const org of organizations) {
    const existingShops = await prisma.shop.findMany({
      where: { organizationId: org.id }
    })

    if (existingShops.length === 0) {
      const shop = await prisma.shop.create({
        data: {
          organizationId: org.id,
          name: 'Main Shop',
          address: org.address,
          city: org.city,
          latitude: org.latitude,
          longitude: org.longitude,
          phone: org.phone,
        }
      })

      // Get all org members and assign them to the main shop
      const orgMembers = await prisma.organizationMember.findMany({
        where: { organizationId: org.id }
      })

      for (const member of orgMembers) {
        await prisma.shopMember.create({
          data: {
            userId: member.userId,
            shopId: shop.id,
            role: member.role === 'owner' ? 'manager' : 'cashier',
          }
        })
      }

      shopsCreated++
      console.log(`  ✅ Created "Main Shop" for: ${org.name}`)
    }
  }

  // Activate modules for all organizations
  // Free modules: permanent active status
  // Paid modules: 30-day trial status
  const now = new Date()

  for (const org of organizations) {
    for (const modData of modules) {
      const mod = await prisma.module.findUnique({ where: { key: modData.key } })
      if (!mod) continue

      const existing = await prisma.organizationModule.findUnique({
        where: {
          organizationId_moduleId: {
            organizationId: org.id,
            moduleId: mod.id,
          }
        }
      })

      if (existing) {
        // Update existing: set proper status and fields
        await prisma.organizationModule.update({
          where: { id: existing.id },
          data: {
            status: mod.isFree ? 'active' : 'trial',
            isActive: true,
            priceAtActivation: mod.priceETB,
            expiresAt: mod.isFree ? null : new Date(now.getTime() + mod.freeTrialDays * 24 * 60 * 60 * 1000),
          }
        })
      } else {
        // Create new
        await prisma.organizationModule.create({
          data: {
            organizationId: org.id,
            moduleId: mod.id,
            status: mod.isFree ? 'active' : 'trial',
            isActive: true,
            priceAtActivation: mod.priceETB,
            expiresAt: mod.isFree ? null : new Date(now.getTime() + mod.freeTrialDays * 24 * 60 * 60 * 1000),
          }
        })
      }
    }
    console.log(`  ✅ Set up modules for: ${org.name}`)
  }

  console.log('')
  console.log(`🎉 Module seeding complete!`)
  console.log(`  - ${modules.length} modules seeded`)
  console.log(`  - ${shopsCreated} main shops created`)
  console.log(`  - ${organizations.length} organizations configured`)
  console.log(`  - Free modules: ${modules.filter(m => m.isFree).map(m => m.key).join(', ')}`)
  console.log(`  - Paid modules: ${modules.filter(m => !m.isFree).map(m => `${m.key} (${m.priceETB} ETB/mo)`).join(', ')}`)
}

main()
  .catch((e) => {
    console.error('Seed modules error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

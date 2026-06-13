/**
 * Migration Script: Supabase → Neon
 * 
 * This script reads data exported from Supabase (via REST API)
 * and imports it into a Neon PostgreSQL database.
 * 
 * Usage: DATABASE_URL="postgresql://..." npx tsx prisma/migrate-to-neon.ts
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'

const prisma = new PrismaClient()

// Read the exported Supabase data
const exportPath = process.env.EXPORT_PATH || '/tmp/supabase-export.json'
const exportData = JSON.parse(readFileSync(exportPath, 'utf8'))

async function main() {
  console.log('🚀 Migrating Supabase data to Neon...')
  console.log('')

  // Import order matters for foreign key relationships
  const importOrder = [
    'Region',
    'Module', 
    'User',
    'Organization',
    'OrganizationMember',
    'Shop',
    'ShopMember',
    'OrganizationModule',
    'ProductType',
    'AttributeDefinition',
    'Product',
    'ProductAttributeValue',
    'Customer',
    'Supplier',
    'SalesRep',
    'Sale',
    'SaleItem',
    'StockMovement',
    'Debt',
    'DebtPayment',
    'ServiceType',
    'ServiceBooking',
    'Expense',
    'Notification',
    'SalesGoal',
    'SalesCommission',
    'AuditLog',
    'LoyaltyAccount',
    'LoyaltyTransaction',
    'CreditLimit',
    'StockTransfer',
    'PurchaseOrder',
    'PurchaseOrderItem',
    'UserDevice',
    'ScheduledReport',
    'IntegrationConfig',
    'Session',
  ]

  const modelMap: Record<string, string> = {
    'Region': 'region',
    'Module': 'module',
    'User': 'user',
    'Organization': 'organization',
    'OrganizationMember': 'organizationMember',
    'Shop': 'shop',
    'ShopMember': 'shopMember',
    'OrganizationModule': 'organizationModule',
    'ProductType': 'productType',
    'AttributeDefinition': 'attributeDefinition',
    'Product': 'product',
    'ProductAttributeValue': 'productAttributeValue',
    'Customer': 'customer',
    'Supplier': 'supplier',
    'SalesRep': 'salesRep',
    'Sale': 'sale',
    'SaleItem': 'saleItem',
    'StockMovement': 'stockMovement',
    'Debt': 'debt',
    'DebtPayment': 'debtPayment',
    'ServiceType': 'serviceType',
    'ServiceBooking': 'serviceBooking',
    'Expense': 'expense',
    'Notification': 'notification',
    'SalesGoal': 'salesGoal',
    'SalesCommission': 'salesCommission',
    'AuditLog': 'auditLog',
    'LoyaltyAccount': 'loyaltyAccount',
    'LoyaltyTransaction': 'loyaltyTransaction',
    'CreditLimit': 'creditLimit',
    'StockTransfer': 'stockTransfer',
    'PurchaseOrder': 'purchaseOrder',
    'PurchaseOrderItem': 'purchaseOrderItem',
    'UserDevice': 'userDevice',
    'ScheduledReport': 'scheduledReport',
    'IntegrationConfig': 'integrationConfig',
    'Session': 'session',
  }

  let totalImported = 0
  let totalSkipped = 0

  for (const tableName of importOrder) {
    const data = exportData[tableName]
    if (!data || data.length === 0) {
      console.log(`  ⏭️  ${tableName}: no data to import`)
      continue
    }

    const modelName = modelMap[tableName]
    if (!modelName) {
      console.log(`  ⚠️  ${tableName}: no Prisma model mapping`)
      totalSkipped += data.length
      continue
    }

    let imported = 0
    let errors = 0

    for (const row of data) {
      try {
        // Parse date strings back to Date objects
        const processed = processRow(row)
        await (prisma as any)[modelName].create({
          data: processed,
        })
        imported++
      } catch (e: any) {
        // Skip duplicate key errors (data already exists)
        if (e.code === 'P2002') {
          errors++
        } else {
          console.log(`    ❌ Error in ${tableName}: ${e.message?.substring(0, 100)}`)
          errors++
        }
      }
    }

    totalImported += imported
    totalSkipped += errors
    console.log(`  ✅ ${tableName}: ${imported} imported, ${errors} skipped (duplicates)`)
  }

  console.log('')
  console.log(`🎉 Migration complete! ${totalImported} rows imported, ${totalSkipped} skipped.`)
}

function processRow(row: Record<string, any>): Record<string, any> {
  const processed: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(row)) {
    // Convert ISO date strings to Date objects
    if (typeof value === 'string' && isISODateString(value)) {
      processed[key] = new Date(value)
    } else {
      processed[key] = value
    }
  }
  
  return processed
}

function isISODateString(value: string): boolean {
  // Match ISO 8601 date strings like "2024-01-15T10:30:00.000Z"
  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
  return isoPattern.test(value) && !isNaN(Date.parse(value))
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

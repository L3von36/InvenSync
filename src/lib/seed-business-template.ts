// ============================================
// Business Template Seeding Service
// ============================================
// Seeds default product types, attributes, and inventory structures
// for a newly registered organization based on their business type.

import { db } from '@/lib/db'
import { getBusinessTemplate, mapLegacyBusinessType, type BusinessTypeKey } from '@/lib/business-templates'

/**
 * Seed business template data for an organization.
 * This creates:
 * - Product types with their attribute definitions
 * - All based on the industry template
 *
 * This is designed to be called inside an existing Prisma transaction
 * (to keep it atomic with org creation).
 *
 * @param tx - Prisma transaction client
 * @param organizationId - The org to seed templates for
 * @param businessType - The business type key (e.g., 'shoe_store')
 */
export async function seedBusinessTemplate(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  organizationId: string,
  businessType: string,
): Promise<{ productTypeCount: number; attributeCount: number }> {
  // Resolve template — map legacy types if needed
  const templateKey: BusinessTypeKey = isValidKey(businessType) ? businessType : mapLegacyBusinessType(businessType)
  const template = getBusinessTemplate(templateKey)

  if (!template) {
    // No template found — skip seeding (not an error, just no defaults)
    console.warn(`No business template found for "${businessType}", skipping seed`)
    return { productTypeCount: 0, attributeCount: 0 }
  }

  let productTypeCount = 0
  let attributeCount = 0

  for (const pt of template.productTypes) {
    // Create the product type
    const productType = await tx.productType.create({
      data: {
        organizationId,
        name: pt.name,
        icon: pt.icon,
      },
    })
    productTypeCount++

    // Create attribute definitions for this product type
    for (let i = 0; i < pt.attributes.length; i++) {
      const attr = pt.attributes[i]
      await tx.attributeDefinition.create({
        data: {
          productTypeId: productType.id,
          name: attr.name,
          fieldType: attr.fieldType,
          options: attr.options ? JSON.stringify(attr.options) : null,
          required: attr.required ?? false,
          order: i,
        },
      })
      attributeCount++
    }
  }

  return { productTypeCount, attributeCount }
}

/**
 * Seed a business template outside of a transaction (standalone).
 * Used for migrating existing organizations.
 */
export async function seedBusinessTemplateStandalone(
  organizationId: string,
  businessType: string,
): Promise<{ productTypeCount: number; attributeCount: number }> {
  return db.$transaction(async (tx) => {
    // Check if org already has product types (don't duplicate)
    const existingCount = await tx.productType.count({
      where: { organizationId },
    })

    if (existingCount > 0) {
      // Org already has custom product types — skip seeding
      return { productTypeCount: 0, attributeCount: 0 }
    }

    return seedBusinessTemplate(tx, organizationId, businessType)
  })
}

function isValidKey(value: string): value is BusinessTypeKey {
  return [
    'shoe_store', 'clothing_store', 'mobile_phone_shop', 'grocery_minimart',
    'cosmetics_shop', 'hardware_store', 'restaurant_cafe', 'electronics_store',
    'pharmacy', 'general_retail',
  ].includes(value)
}

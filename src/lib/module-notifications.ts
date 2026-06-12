// ============================================
// Module Expiry & Low Stock Notification Utilities
// ============================================
// Provides idempotent notification generation for module expiry
// thresholds and low stock alerts. Safe to call repeatedly —
// duplicate checks prevent notification spam.

import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpiringOrgModule {
  id: string
  organizationId: string
  moduleId: string
  status: string
  isActive: boolean
  expiresAt: Date
  module: { id: string; key: string; name: string }
}

interface LowStockProduct {
  id: string
  organizationId: string
  name: string
  quantity: number
  lowStockThreshold: number
}

// ---------------------------------------------------------------------------
// Helper – check whether a notification of a given type / moduleKey already
// exists for an organisation within the last N days.
// ---------------------------------------------------------------------------

async function hasRecentNotification(params: {
  organizationId: string
  type: string
  metadataKey: string // the JSON key inside metadata to match, e.g. "moduleKey" or "productId"
  metadataValue: string
  withinDays: number
}): Promise<boolean> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - params.withinDays)

  // We store metadata as a JSON string; use string-contains matching so that
  // we don't need to pull every notification into JS memory.
  const count = await db.notification.count({
    where: {
      organizationId: params.organizationId,
      type: params.type,
      createdAt: { gte: cutoff },
      metadata: { contains: params.metadataValue },
    },
  })

  return count > 0
}

// ---------------------------------------------------------------------------
// 1. checkAndNotifyExpiringModules
// ---------------------------------------------------------------------------

export async function checkAndNotifyExpiringModules(): Promise<number> {
  const now = new Date()

  // Fetch all org-modules that are trial/active, still marked active, and
  // have an expiry date set.
  const orgModules = await db.organizationModule.findMany({
    where: {
      status: { in: ['trial', 'active'] },
      isActive: true,
      expiresAt: { not: null },
    },
    include: {
      module: { select: { id: true, key: true, name: true } },
    },
  }) as unknown as ExpiringOrgModule[]

  let notificationsCreated = 0

  for (const om of orgModules) {
    if (!om.expiresAt) continue

    const msUntilExpiry = om.expiresAt.getTime() - now.getTime()
    const daysUntilExpiry = Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24))

    // Determine which threshold we hit (only the tightest one)
    type Threshold = {
      days: number
      type: 'module_expiry' | 'module_expired'
      title: string
      message: string
    }

    let threshold: Threshold | null = null

    if (daysUntilExpiry <= 0) {
      threshold = {
        days: 0,
        type: 'module_expired',
        title: 'Module Expired',
        message: `${om.module.name} has expired. Renew to restore access.`,
      }
    } else if (daysUntilExpiry <= 1) {
      threshold = {
        days: 1,
        type: 'module_expiry',
        title: 'Module Expires Tomorrow!',
        message: `${om.module.name} expires tomorrow! Renew now to keep your data and access.`,
      }
    } else if (daysUntilExpiry <= 3) {
      threshold = {
        days: 3,
        type: 'module_expiry',
        title: 'Module Expiring in 3 Days',
        message: `${om.module.name} will expire in 3 days! Renew now to avoid losing access.`,
      }
    } else if (daysUntilExpiry <= 7) {
      threshold = {
        days: 7,
        type: 'module_expiry',
        title: 'Module Expiring Soon',
        message: `${om.module.name} will expire in 7 days. Renew now to avoid interruption.`,
      }
    }

    if (!threshold) continue

    // Idempotency: skip if a notification of this type for this module
    // already exists within the last 2 days.
    const alreadyNotified = await hasRecentNotification({
      organizationId: om.organizationId,
      type: threshold.type,
      metadataKey: 'moduleKey',
      metadataValue: om.module.key,
      withinDays: 2,
    })

    if (alreadyNotified) continue

    // Create the notification
    await db.notification.create({
      data: {
        organizationId: om.organizationId,
        type: threshold.type,
        title: threshold.title,
        message: threshold.message,
        actionUrl: '/modules',
        metadata: JSON.stringify({
          moduleKey: om.module.key,
          moduleId: om.moduleId,
          daysUntilExpiry,
        }),
      },
    })

    notificationsCreated++

    // If the module has expired, also update the org-module record
    if (threshold.type === 'module_expired') {
      await db.organizationModule.update({
        where: { id: om.id },
        data: {
          status: 'expired',
          isActive: false,
        },
      })
    }
  }

  return notificationsCreated
}

// ---------------------------------------------------------------------------
// 2. checkAndNotifyLowStock
// ---------------------------------------------------------------------------

export async function checkAndNotifyLowStock(orgId: string): Promise<number> {
  // Prisma does not support comparing two columns in a where clause,
  // so we fetch active products for the org and filter in JS.
  const allProducts = await db.product.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      quantity: true,
      lowStockThreshold: true,
    },
  })

  const products = allProducts.filter(
    (p) => p.quantity <= p.lowStockThreshold,
  ) as unknown as LowStockProduct[]

  let notificationsCreated = 0

  for (const product of products) {
    // Idempotency: skip if a low_stock notification for this product
    // already exists within the last 7 days.
    const alreadyNotified = await hasRecentNotification({
      organizationId: product.organizationId,
      type: 'low_stock',
      metadataKey: 'productId',
      metadataValue: product.id,
      withinDays: 7,
    })

    if (alreadyNotified) continue

    await db.notification.create({
      data: {
        organizationId: product.organizationId,
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${product.name} is running low (${product.quantity} remaining). Restock soon.`,
        actionUrl: '/inventory',
        metadata: JSON.stringify({
          productId: product.id,
          quantity: product.quantity,
          lowStockThreshold: product.lowStockThreshold,
        }),
      },
    })

    notificationsCreated++
  }

  return notificationsCreated
}

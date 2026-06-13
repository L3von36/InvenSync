// ============================================
// Module Guard - API route protection based on module access
// ============================================
// Use this in API routes to check if an organization has access
// to a specific module before allowing the request.

import { db } from '@/lib/db'
import { getCachedModules, setCachedModules, batchExpireTrials } from '@/lib/module-cache'
import { NextResponse } from 'next/server'

// Map of API route prefixes to their required module keys
export const ROUTE_MODULE_MAP: Record<string, string> = {
  'inventory': 'inventory',
  'products': 'inventory',
  'product-types': 'inventory',
  'sales': 'sales',
  'customers': 'customers',
  'suppliers': 'suppliers',
  'debts': 'debts',
  'reports': 'reports',
  'expenses': 'expenses',
  'service-types': 'services',
  'service-bookings': 'services',
  'ai/inventory-assistant': 'ai-inventory-assistant',
  'ai/business-assistant': 'ai-business-assistant',
  'shops': 'multi-shop',
}

// Check if an org has access to a specific module
// Uses cache for fast lookups, falls back to DB
export async function checkModuleAccess(
  orgId: string,
  moduleKey: string
): Promise<{ hasAccess: boolean; status: string | null }> {
  // Try cache first
  const cached = getCachedModules(orgId)
  if (cached !== null) {
    return {
      hasAccess: cached.includes(moduleKey),
      status: cached.includes(moduleKey) ? 'active' : null,
    }
  }

  // Batch auto-expire trials before checking (keeps data fresh)
  try {
    await batchExpireTrials(db)
  } catch {
    // Don't block on expiry errors
  }

  // Query DB for org's active modules — wrap in try/catch for resilience
  try {
    const orgModules = await db.organizationModule.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        status: { in: ['trial', 'active'] },
      },
      include: {
        module: {
          select: { key: true },
        },
      },
    })

    const activeModuleKeys = orgModules
      .filter(om => {
        // Also check trial hasn't expired
        if (om.status === 'trial' && om.expiresAt && om.expiresAt < new Date()) {
          return false
        }
        return true
      })
      .map(om => om.module.key)

    // Update cache
    setCachedModules(orgId, activeModuleKeys)

    const hasAccess = activeModuleKeys.includes(moduleKey)
    const orgModule = orgModules.find(om => om.module.key === moduleKey)

    return {
      hasAccess,
      status: orgModule?.status || null,
    }
  } catch (dbError) {
    // If the database query fails (connection timeout, etc.), don't block the request.
    // Allow access through with a warning — transient DB errors should not cause 403s.
    console.warn(
      `[module-guard] DB error while checking module "${moduleKey}" for org ${orgId}. Allowing access as fallback:`,
      dbError instanceof Error ? dbError.message : dbError
    )
    return {
      hasAccess: true,
      status: null,
    }
  }
}

// Create a 403 response for missing module access
export function moduleAccessDenied(moduleKey: string): NextResponse {
  return NextResponse.json(
    {
      error: `Module "${moduleKey}" is not active for your organization. Please contact support to activate this feature.`,
      moduleRequired: moduleKey,
    },
    { status: 403 }
  )
}

// Known free module keys — these modules should always be accessible.
// If an org doesn't have an OrganizationModule record for a free module,
// we auto-create one so the org can use it immediately.
const FREE_MODULE_KEYS = new Set([
  'inventory',
  'sales',
  'debts',
  'customers',
  'suppliers',
  'multi-shop',
  'reports',
  'expenses',
])

// Auto-activate a free module for an org.
// Returns true if the module was activated (or already active), false if it couldn't be.
async function autoActivateFreeModule(orgId: string, moduleKey: string): Promise<boolean> {
  try {
    // Look up the Module record by key
    const mod = await db.module.findUnique({ where: { key: moduleKey } })
    if (!mod) {
      console.warn(`[module-guard] Cannot auto-activate module "${moduleKey}": Module record not found in database.`)
      return false
    }

    // Double-check the module is actually free (defensive — in case the set above is stale)
    if (!mod.isFree && mod.priceETB > 0) {
      console.warn(`[module-guard] Module "${moduleKey}" is not free (price: ${mod.priceETB}). Skipping auto-activation.`)
      return false
    }

    // Upsert the OrganizationModule record
    await db.organizationModule.upsert({
      where: {
        organizationId_moduleId: {
          organizationId: orgId,
          moduleId: mod.id,
        },
      },
      update: {
        status: 'active',
        isActive: true,
        expiresAt: null,
      },
      create: {
        organizationId: orgId,
        moduleId: mod.id,
        status: 'active',
        isActive: true,
        expiresAt: null,
        priceAtActivation: mod.priceETB,
        autoRenew: false,
      },
    })

    // Invalidate cache so the next check picks up the new module
    const { invalidateModuleCache } = await import('@/lib/module-cache')
    invalidateModuleCache(orgId)

    console.log(`[module-guard] Auto-activated free module "${moduleKey}" for org ${orgId}`)
    return true
  } catch (err) {
    console.error(`[module-guard] Failed to auto-activate free module "${moduleKey}" for org ${orgId}:`, err instanceof Error ? err.message : err)
    return false
  }
}

// Convenience function: check module access and return error response if denied
// Returns null if access is granted, or a NextResponse if denied
// For free modules, auto-activates if the org doesn't have access yet
// Free modules ALWAYS get access — auto-activation is best-effort for DB records only
export async function requireModule(
  orgId: string,
  moduleKey: string
): Promise<NextResponse | null> {
  // Free modules are ALWAYS accessible, regardless of database state.
  // Auto-activation is best-effort to keep the DB in sync, but should never block access.
  if (FREE_MODULE_KEYS.has(moduleKey)) {
    // Best-effort auto-activation (don't await the result to block)
    const { hasAccess } = await checkModuleAccess(orgId, moduleKey)
    if (!hasAccess) {
      // Try auto-activation in the background — don't block on failure
      autoActivateFreeModule(orgId, moduleKey).catch(() => {})
    }
    return null // Always grant access for free modules
  }

  const { hasAccess } = await checkModuleAccess(orgId, moduleKey)
  if (!hasAccess) {
    return moduleAccessDenied(moduleKey)
  }
  return null
}

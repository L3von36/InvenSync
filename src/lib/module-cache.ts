// ============================================
// Module Cache - In-memory cache for fast module lookups
// ============================================
// Ensures API performance stays fast regardless of business count.
// Cache is invalidated when modules are modified.

import type { PrismaClient } from '@prisma/client'

interface CachedOrgModules {
  activeModuleKeys: string[]
  expiresAt: number // cache TTL
}

// Cache: orgId -> active module keys
const moduleCache = new Map<string, CachedOrgModules>()

// Cache TTL: 2 minutes (balances freshness vs performance)
const CACHE_TTL_MS = 2 * 60 * 1000

// Track when modules were last modified globally
let globalModuleVersion = Date.now()

export function getGlobalModuleVersion(): number {
  return globalModuleVersion
}

export function invalidateModuleCache(orgId?: string): void {
  globalModuleVersion = Date.now()
  if (orgId) {
    moduleCache.delete(orgId)
  } else {
    moduleCache.clear()
  }
}

export function getCachedModules(orgId: string): string[] | null {
  const cached = moduleCache.get(orgId)
  if (!cached) return null
  if (Date.now() > cached.expiresAt) {
    moduleCache.delete(orgId)
    return null
  }
  return cached.activeModuleKeys
}

export function setCachedModules(orgId: string, activeModuleKeys: string[]): void {
  moduleCache.set(orgId, {
    activeModuleKeys,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

// Batch auto-expire: expire all trial modules whose time has passed
// Returns the number of modules expired
export async function batchExpireTrials(prisma: PrismaClient): Promise<number> {
  const now = new Date()

  // Find all trial modules that should be expired
  const expired = await prisma.organizationModule.findMany({
    where: {
      status: 'trial',
      expiresAt: { lt: now },
      isActive: true,
    },
    select: { id: true },
  })

  if (expired.length === 0) return 0

  // Batch update all expired modules
  const result = await prisma.organizationModule.updateMany({
    where: {
      id: { in: expired.map(e => e.id) },
    },
    data: {
      status: 'expired',
      isActive: false,
    },
  })

  // Invalidate entire cache since multiple orgs may be affected
  moduleCache.clear()

  return result.count
}

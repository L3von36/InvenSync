// ============================================
// Role-restricted sync entities
// ============================================
// These entities carry org-level financial data (expense records, supplier
// purchase terms, purchase-order cost prices). Their API endpoints are
// restricted to org owners/managers server-side, so employees must skip
// them during bootstrap and delta sync — the requests would 403 anyway,
// and the data must never land in an employee's IndexedDB.

export const OWNER_MANAGER_ENTITIES: ReadonlySet<string> = new Set([
  'expenses',
  'suppliers',
  'purchaseOrders',
])

export function isEntityAllowedForRole(
  entity: string,
  orgRole: string | null | undefined
): boolean {
  if (!OWNER_MANAGER_ENTITIES.has(entity)) return true
  return orgRole === 'owner' || orgRole === 'manager'
}

// ============================================
// Tombstones — deletion records for offline delta sync
// ============================================
// Hard deletes are invisible to clients that pull with ?updatedSince=...
// DELETE endpoints call recordTombstone() after a successful delete, and
// list endpoints append getTombstones() results as { id, _deleted: true }
// entries, which the client sync engine turns into local deletions.

import { db } from '@/lib/prisma'

/**
 * Records that an entity row was deleted, so offline clients can learn
 * about it on their next delta pull. Fire-and-forget safe: a tombstone
 * failure must never fail the delete itself.
 */
export async function recordTombstone(
  entity: string,
  recordId: string,
  organizationId: string
): Promise<void> {
  try {
    await db.deletedRecord.create({
      data: { entity, recordId, organizationId },
    })
  } catch (err) {
    console.error(`[Tombstones] Failed to record ${entity}/${recordId}:`, err)
  }
}

/**
 * Returns tombstone entries for records of `entity` deleted after
 * `updatedSince`, in the shape the client sync engine expects.
 */
export async function getTombstones(
  entity: string,
  organizationId: string,
  updatedSince: string
): Promise<Array<{ id: string; _deleted: true }>> {
  try {
    const since = new Date(updatedSince)
    if (isNaN(since.getTime())) return []

    const rows = await db.deletedRecord.findMany({
      where: { entity, organizationId, deletedAt: { gt: since } },
      select: { recordId: true },
    })
    return rows.map((row) => ({ id: row.recordId, _deleted: true as const }))
  } catch (err) {
    console.error(`[Tombstones] Failed to read tombstones for ${entity}:`, err)
    return []
  }
}

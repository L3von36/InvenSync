import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Build a Prisma where clause that matches records where a nullable field
 * equals a specific value OR is null.
 *
 * Prisma does NOT support `{ in: [value, null] }` for nullable fields.
 * Instead, use: `shopIdFilter('shop123')` → `{ OR: [{ shopId: 'shop123' }, { shopId: null }] }`
 *
 * @param field - The field name (e.g. 'shopId')
 * @param value - The value to match alongside null
 * @returns A Prisma where fragment, or undefined if no value is provided
 */
export function nullableFieldInFilter<T extends string>(
  field: T,
  value: string | null | undefined
): { OR: Array<Record<T, string | null>> } | undefined {
  if (!value) return undefined
  return {
    OR: [
      { [field]: value } as Record<T, string>,
      { [field]: null } as Record<T, null>,
    ],
  }
}

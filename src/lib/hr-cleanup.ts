type ReferenceCount = { count: number | null; error: unknown };

/** Only remove an original after both reference queries succeeded and found no owner. */
export function canRemoveHrOriginal(hr: ReferenceCount, tender: ReferenceCount): boolean {
  return !hr.error && !tender.error && hr.count === 0 && tender.count === 0;
}
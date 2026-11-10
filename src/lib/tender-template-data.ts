import { normKey, type MappingLike } from './template-values';

/** Verified names used by the tender Word templates; never infer from example values. */
const SOURCES: Record<string, string> = {
  tengoithau: 'Ten_goi_thau', cvchutruong: 'Numb_CVCT',
  datechutruong: 'Date_CVCT', numpvcv: 'Numb_SOW',
};
export function tenderSourceKey(key: string) { return SOURCES[normKey(key)] ?? key; }
export function tenderMappings(mappings: MappingLike[]) {
  return mappings.map(m => ({ ...m, source_field: m.source_field ?? (SOURCES[normKey(m.placeholder)] || null) }));
}

/** Current document (including deliberate empty values) wins; fallback never reads other tenders. */
export function tenderExportData(shared: Record<string, string>, fields: { field_key: string; value: string | null }[]) {
  const out: Record<string, string> = { ...shared };
  for (const field of fields) {
    const key = tenderSourceKey(field.field_key);
    if (key === field.field_key || field.value?.trim()) out[key] = field.value?.trim() ?? '';
  }
  // Exact user-entered alias fields remain available as distinct values.
  for (const field of fields) out[field.field_key] = field.value?.trim() ?? '';
  out['tenders.name'] = out.Ten_goi_thau ?? '';
  return out;
}

export function reorderedRows<T extends { id: string; sort_order: number }>(rows: T[], from: number, to: number): T[] {
  if (from < 0 || from >= rows.length || to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  const [item] = next.splice(from, 1);
  if (!item) return rows;
  next.splice(to, 0, item);
  return next.map((row, i) => ({ ...row, sort_order: i + 1 }));
}
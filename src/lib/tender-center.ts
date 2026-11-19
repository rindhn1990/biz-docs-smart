import { normKey, type MappingLike } from './template-values';
import { tenderMappings, tenderSourceKey } from './tender-template-data';

const CENTER_SOURCES: Record<string, string> = {
  Ten_goi_thau: 'ten_goi_thau', Gia_goi_thau_numb: 'gia_goi_thau',
  Gia_goi_thau_text: 'gia_bang_chu', Nguon_von: 'nguon_von',
  Numb_CVCT: 'so_van_ban_chu_truong', Date_CVCT: 'ngay_van_ban_chu_truong',
  Duration_Contract: 'thoi_gian_thuc_hien', Loai_HD: 'loai_hop_dong',
};
/** Only the selected tender's procurement method supplies templates and editable regions. */
export function centerTemplatesForMethod<T extends { method: string | null }>(templates: readonly T[], method: string | null) {
  return method ? templates.filter(template => template.method === method) : [];
}
export function centerKey(source: string) {
  const canonical = tenderSourceKey(source);
  return Object.entries(CENTER_SOURCES).find(([key]) => normKey(key) === normKey(canonical))?.[1] ?? canonical;
}
/** Template list order first, region order second; first shared source wins. */
export function orderCenterMappings<T extends { template_id: string; sort_order?: number | null }>(mappings: readonly T[], templates: readonly { id: string }[]): T[] {
  const positions = new Map(templates.map((template, index) => [template.id, index]));
  return mappings.map((mapping, index) => ({ mapping, index }))
    .filter(item => positions.has(item.mapping.template_id))
    .sort((a, b) => (positions.get(a.mapping.template_id) ?? 0) - (positions.get(b.mapping.template_id) ?? 0)
      || (a.mapping.sort_order ?? 0) - (b.mapping.sort_order ?? 0) || a.index - b.index)
    .map(item => item.mapping);
}
export function centerFields(mappings: MappingLike[], inherited: Map<string, string>, known: readonly { key: string; label: string }[]) {
  const seen = new Set<string>();
  return tenderMappings(mappings).flatMap(m => {
    const source = m.source_field || inherited.get(normKey(m.placeholder)) || tenderSourceKey(m.placeholder);
    const key = centerKey(source);
    if (seen.has(normKey(key))) return [];
    seen.add(normKey(key));
    return [{ key, label: known.find(f => normKey(f.key) === normKey(source))?.label || m.label || m.placeholder }];
  });
}
/** Explicit blanks are intentional: metadata fallback is only for absent keys. */
export function centerExportValues(values: Record<string, string>) {
  const out = { ...values };
  for (const [source, key] of Object.entries(CENTER_SOURCES)) {
    if (Object.hasOwn(values, key)) out[source] = values[key] ?? '';
  }
  for (const [key, value] of Object.entries(values)) out[tenderSourceKey(key)] ??= value;
  out['tenders.name'] = out['Ten_goi_thau'] ?? '';
  return out;
}
export function resetCenterValues(values: Record<string, string>, fields: readonly { key: string }[]) {
  const out = { ...values };
  for (const field of fields) out[field.key] = '';
  return out;
}

export type CenterFieldOrder = { method: string; field_key: string; sort_order: number };
export function sortCenterFields<T extends { key: string }>(fields: readonly T[], rows: readonly CenterFieldOrder[], method: string | null): T[] {
  const positions = new Map(rows.filter(r => r.method === method).map(r => [normKey(r.field_key), r.sort_order]));
  return fields.map((field,index) => ({field,index})).sort((a,b) =>
    (positions.get(normKey(a.field.key)) ?? Number.MAX_SAFE_INTEGER) - (positions.get(normKey(b.field.key)) ?? Number.MAX_SAFE_INTEGER) || a.index-b.index
  ).map(r=>r.field);
}
export function centerOrderRows(method: string, keys: readonly string[], userId: string | null) {
  return [...new Set(keys.map(normKey))].map((field_key,index)=>({method,field_key,sort_order:index+1,updated_by:userId}));
}
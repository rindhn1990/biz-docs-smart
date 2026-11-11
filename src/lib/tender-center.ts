import { normKey, type MappingLike } from './template-values';
import { tenderMappings, tenderSourceKey } from './tender-template-data';

const CENTER_SOURCES: Record<string, string> = {
  Ten_goi_thau: 'ten_goi_thau', Gia_goi_thau_numb: 'gia_goi_thau',
  Gia_goi_thau_text: 'gia_bang_chu', Nguon_von: 'nguon_von',
  Numb_CVCT: 'so_van_ban_chu_truong', Date_CVCT: 'ngay_van_ban_chu_truong',
  Duration_Contract: 'thoi_gian_thuc_hien', Loai_HD: 'loai_hop_dong',
};
export function centerKey(source: string) {
  const canonical = tenderSourceKey(source);
  return Object.entries(CENTER_SOURCES).find(([key]) => normKey(key) === normKey(canonical))?.[1] ?? canonical;
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
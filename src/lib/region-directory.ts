import { normKey } from './template-values';
export type DirectoryTemplate = { id: string; module: string; method?: string | null };
export type DirectoryRegion = { id: string; template_id: string; placeholder: string; source_field: string | null; label?: string | null; date_format?: string | null; value?: string | null; updated_at?: string };

/** Group configuration by normalized symbol, never implicitly across procurement methods. */
export function scopeRegionTemplates<T extends DirectoryTemplate>(templates: readonly T[], module: string, method: string | null, allModule = false): T[] {
  return templates.filter(t => t.module === module && (module !== 'tender' || allModule || t.method === method));
}
export function groupRegions<T extends DirectoryRegion>(regions: readonly T[], templates: readonly DirectoryTemplate[]) {
  const ids = new Set(templates.map(t => t.id));
  const groups = new Map<string, T[]>();
  for (const region of regions) {
    if (!ids.has(region.template_id)) continue;
    const key = normKey(region.placeholder);
    const group = groups.get(key) ?? [];
    group.push(region);
    groups.set(key, group);
  }
  return [...groups].map(([key, rows]) => ({ key, rows,
    sourceConflict: new Set(rows.map(r => r.source_field ?? '')).size > 1,
    conflict: ['source_field','label','date_format','value'].some(field => new Set(rows.map(r => r[field as keyof T] ?? '')).size > 1),
  }));
}
export type RegionPatch = { label?: string; source_field?: string | null; date_format?: string | null; value?: string | null };
export function regionGroupChanges(rows: readonly DirectoryRegion[], templates: readonly DirectoryTemplate[], symbol: string, patch: RegionPatch) {
  const ids = new Set(templates.map(t => t.id));
  return rows.filter(r => ids.has(r.template_id) && normKey(r.placeholder) === normKey(symbol)).map(r => ({
    id: r.id, template_id: r.template_id, expected_updated_at: r.updated_at ?? '', ...patch,
  }));
}
export function orderedWordFields<T extends { key: string }>(fields: readonly T[], keys: readonly string[]): T[] {
  const positions = new Map(keys.map((key, index) => [key, index]));
  return fields.map((field, index) => ({ field, index })).sort((a, b) =>
    (positions.get(a.field.key) ?? keys.length + a.index) - (positions.get(b.field.key) ?? keys.length + b.index)
  ).map(item => item.field);
}
/** Keep hidden fields' positions when reordering a selected template's subset. */
export function reorderWordFields(all: readonly string[], visible: readonly string[], key: string, target: string): string[] {
  const next = [...visible];
  const from = next.indexOf(key), to = next.indexOf(target);
  if (from < 0 || to < 0 || from === to) return [...all];
  next.splice(from, 1); next.splice(to, 0, key);
  const shown = new Set(visible);
  let index = 0;
  return all.map(value => shown.has(value) ? next[index++] ?? value : value);
}
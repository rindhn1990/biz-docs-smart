export type DirectoryTemplate = { id: string; module: string; method?: string | null };
export type DirectoryRegion = { id: string; template_id: string; placeholder: string; source_field: string | null };

/** Exact Word symbols only; never merge different case or different methods implicitly. */
export function scopeRegionTemplates<T extends DirectoryTemplate>(templates: readonly T[], module: string, method: string | null, allModule = false): T[] {
  return templates.filter(t => t.module === module && (module !== 'tender' || allModule || t.method === method));
}
export function groupRegions<T extends DirectoryRegion>(regions: readonly T[], templates: readonly DirectoryTemplate[]) {
  const ids = new Set(templates.map(t => t.id));
  const groups = new Map<string, T[]>();
  for (const region of regions) {
    if (!ids.has(region.template_id)) continue;
    const group = groups.get(region.placeholder) ?? [];
    group.push(region);
    groups.set(region.placeholder, group);
  }
  return [...groups].map(([key, rows]) => ({ key, rows, sourceConflict: new Set(rows.map(r => r.source_field ?? '')).size > 1 }));
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
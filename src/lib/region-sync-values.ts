import { normKey, type MappingLike } from './template-values';
import { centerFields, centerKey } from './tender-center';
import { tenderSourceKey } from './tender-template-data';
import { DATA_CENTER_GROUPS } from './tender';
import { SIGNER_FIELDS } from './tender-controls';
import { KHLCNT_FIELDS } from './khlcnt';
import { methodLabel } from './methods';

export type SyncRegion = MappingLike & { template_id: string; created_at?: string };
export function effectiveRegionSource(region: MappingLike, inherited: Map<string,string>) {
  // Match tenderMappings/centerFields precedence, including verified Word aliases.
  return region.source_field || (tenderSourceKey(region.placeholder) !== region.placeholder ? tenderSourceKey(region.placeholder) : inherited.get(normKey(region.placeholder))) || region.placeholder;
}
export function fixedRegionGroup(source: string) {
  const key = normKey(centerKey(source));
  return DATA_CENTER_GROUPS.find(g => g.fields.some(f => normKey(f.key) === key))?.title
    ?? (SIGNER_FIELDS.some(f => normKey(f.key) === key) ? 'Người ký – uỷ quyền' : null);
}
export function regionDestination(region: SyncRegion, rows: SyncRegion[], inherited: Map<string,string>, method: string | null) {
  const source = effectiveRegionSource(region,inherited), key = centerKey(source);
  const fixed = fixedRegionGroup(source);
  const fields = centerFields(rows,inherited,KHLCNT_FIELDS);
  const label = fields.find(f => normKey(f.key) === normKey(key))?.label ?? region.label ?? region.placeholder;
  if (fixed) return `Dữ liệu nằm ở nhóm '${fixed}' của Dữ liệu chung`;
  const related = rows.filter(r => normKey(centerKey(effectiveRegionSource(r,inherited))) === normKey(key));
  const symbols = new Set(related.map(r => normKey(r.placeholder))).size;
  if (related.some(r => r !== region && (r.template_id !== region.template_id || r.placeholder !== region.placeholder))) return `Vùng dùng chung dữ liệu với trường '${label}' (đã có ở Dữ liệu chung; xuất hiện ở ${symbols} ký hiệu)`;
  return `Đã thêm trường mới '${label}' vào Dữ liệu chung của gói thầu hình thức ${methodLabel(method)}`;
}
export type SyncDocument = { id: string; tender_id: string | null; method: string | null };
export type ExistingField = { document_id: string; field_key: string; field_group: string | null; sort_order: number };
export function planRegionFields(regions: SyncRegion[], documents: SyncDocument[], existing: ExistingField[], inherited: Map<string,string>, method: string | null) {
  if (!method) return [];
  const result: {document_id:string;field_key:string;label:string;value:null;confidence:number;needs_review:boolean;field_group:string;sort_order:number}[]=[];
  for (const doc of documents) {
    if (!doc.tender_id || doc.method !== method) continue;
    const have = existing.filter(f => f.document_id === doc.id);
    const keys = new Set(have.map(f => normKey(f.field_key)));
    const last = new Map<string,number>();
    for (const f of have) last.set(f.field_group ?? 'Khác',Math.max(last.get(f.field_group ?? 'Khác') ?? 0,f.sort_order));
    for (const region of regions) {
      const source=effectiveRegionSource(region,inherited);
      if (fixedRegionGroup(source) || keys.has(normKey(source))) continue;
      const known=KHLCNT_FIELDS.find(f=>normKey(f.key)===normKey(source));
      const group=known?.group ?? 'Khác', sort=(last.get(group) ?? 0)+1;
      result.push({document_id:doc.id,field_key:known?.key ?? source,label:known?.label ?? region.label ?? region.placeholder,value:null,confidence:0.3,needs_review:true,field_group:group,sort_order:sort});
      last.set(group,sort); keys.add(normKey(source));
    }
  }
  return result;
}
export function centerFieldUsage(key: string, regions: SyncRegion[], inherited: Map<string,string>, now: number) {
  const rows=regions.filter(r=>normKey(centerKey(effectiveRegionSource(r,inherited)))===normKey(key));
  return { rows, symbols:new Set(rows.map(r=>normKey(r.placeholder))).size, templates:new Set(rows.map(r=>r.template_id)).size,
    isNew:rows.some(r=>{const created=Date.parse(r.created_at ?? '');return Number.isFinite(created) && created<=now && created>=now-3*86400000;}) };
}
import { supabase } from '@/integrations/supabase/client';
import { regionGroupChanges, scopeRegionTemplates, type DirectoryRegion, type RegionPatch } from './region-directory';
import { syncRegionToData, refreshRegionData } from './region-sync';
import type { QueryClient } from '@tanstack/react-query';

export const REGION_COLUMNS = 'id,template_id,placeholder,label,source_field,date_format,value,sort_order,created_at,updated_at' as const;
export async function loadRegionGroup(module: string, method: string | null, symbol: string, allModule: boolean, onlyTemplate?: string) {
  const [templates, mappings]=await Promise.all([
    supabase.from('templates').select('id,name,module,method').eq('module',module),
    supabase.from('template_mappings').select(`${REGION_COLUMNS},templates!inner(module)`).eq('templates.module',module).limit(5000),
  ]);
  if(templates.error) throw templates.error; if(mappings.error) throw mappings.error;
  const scope=scopeRegionTemplates(templates.data ?? [],module,method,allModule).filter(t=>!onlyTemplate || t.id===onlyTemplate);
  const changes=regionGroupChanges(mappings.data ?? [],scope,symbol,{});
  const ids=new Set(changes.map(c=>c.id));
  return { rows:(mappings.data ?? []).filter(r=>ids.has(r.id)), templates:scope.filter(t=>changes.some(c=>c.template_id===t.id)) };
}
export async function applyRegionGroup(rows: DirectoryRegion[], patch: RegionPatch, client: QueryClient) {
  const changes=rows.map(r=>({id:r.id,template_id:r.template_id,expected_updated_at:r.updated_at ?? '',...patch}));
  const result=await supabase.rpc('update_template_region_group',{_changes:changes});
  if(result.error) throw result.error;
  const destinations:string[]=[];
  let syncError:unknown;
  try {
    for(const id of new Set(rows.map(r=>r.template_id))) destinations.push(...await syncRegionToData(id,rows.filter(r=>r.template_id===id).map(r=>r.placeholder)));
  } catch(error) {syncError=error;}
  await refreshRegionData(client);
  return { destinations:[...new Set(destinations)], syncError };
}
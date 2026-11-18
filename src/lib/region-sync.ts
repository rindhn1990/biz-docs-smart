import { supabase } from '@/integrations/supabase/client';
import { loadInheritedSources } from './template-resolve';
import { planRegionFields, regionDestination, type SyncRegion } from './region-sync-values';
import { type QueryClient } from '@tanstack/react-query';

export async function refreshRegionData(client: QueryClient) {
  await Promise.all(['template_mappings','templates','document_fields','tender_data','template_custom_fields','template_field_examples'].map(key=>client.invalidateQueries({queryKey:[key]})));
}
/** All tender configuration mutations use this entry; it never overwrites/deletes existing fields. */
export async function syncRegionToData(templateId: string, symbols?: string[]) {
  const tpl=await supabase.from('templates').select('module,method').eq('id',templateId).single();
  if(tpl.error) throw tpl.error;
  if(tpl.data.module!=='tender') return [];
  const method=tpl.data.method;
  const [mappings,inherited]=await Promise.all([
    supabase.from('template_mappings').select('template_id,placeholder,label,source_field,value,date_format,created_at,templates!inner(module,method)').eq('templates.module','tender').limit(5000),
    loadInheritedSources('tender'),
  ]);
  if(mappings.error) throw mappings.error;
  const rows=(mappings.data ?? []).filter(r=>r.templates.method===method);
  const changed=rows.filter(r=>r.template_id===templateId && (!symbols || symbols.includes(r.placeholder)));
  if(method) {
    const docs=await supabase.from('documents').select('id,tender_id,tenders!inner(method)').eq('tenders.method',method).not('tender_id','is',null).limit(5000);
    if(docs.error) throw docs.error;
    // Range reads avoid PostgREST's default 1000-row cap for dense document inputs.
    for(const doc of docs.data ?? []) {
      const have=[];
      for(let offset=0;;offset+=1000) {
        const page=await supabase.from('document_fields').select('document_id,field_key,field_group,sort_order').eq('document_id',doc.id).order('id').range(offset,offset+999);
        if(page.error) throw page.error;
        have.push(...(page.data ?? [])); if((page.data?.length ?? 0)<1000) break;
      }
      const additions=planRegionFields(changed,[{id:doc.id,tender_id:doc.tender_id,method:doc.tenders.method}],have,inherited,method);
      if(additions.length) { const inserted=await supabase.from('document_fields').insert(additions); if(inserted.error) throw inserted.error; }
    }
  }
  return changed.map(r=>regionDestination(r,rows as SyncRegion[],inherited,method));
}
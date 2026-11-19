import { supabase } from '@/integrations/supabase/client';
import { loadInheritedSources } from './template-resolve';
import { cleanupCandidates } from './tender-field-cleanup';

export async function loadCleanupPreview() {
  const fields=[];
  for(let offset=0;;offset+=1000) {
    const page=await supabase.from('document_fields').select('id,document_id,field_key,label,value,needs_review,field_group,sort_order,created_at,updated_at').order('id').range(offset,offset+999);
    if(page.error)throw page.error; fields.push(...page.data??[]);if((page.data?.length??0)<1000)break;
  }
  const [docs,regions,inherited]=await Promise.all([
    supabase.from('documents').select('id,file_name,tender_id,tenders(name,method)').limit(10000),
    supabase.from('template_mappings').select('template_id,placeholder,label,source_field,value,date_format,templates!inner(module,method)').eq('templates.module','tender').limit(5000),
    loadInheritedSources('tender'),
  ]);
  if(docs.error)throw docs.error;if(regions.error)throw regions.error;
  return cleanupCandidates(fields,(docs.data??[]).map(d=>({id:d.id,file_name:d.file_name,tender_id:d.tender_id,method:d.tenders?.method??null,tender_name:d.tenders?.name??null})),(regions.data??[]).map(r=>({...r,method:r.templates.method})),inherited);
}
import { normKey } from './template-values';
import { KHLCNT_FIELDS } from './khlcnt';
import { effectiveRegionSource, type SyncRegion } from './region-sync-values';

export type CleanupField = { id:string;document_id:string;field_key:string;label:string;value:string|null;needs_review:boolean;field_group:string|null;sort_order:number;created_at:string;updated_at:string };
export type CleanupDoc = {id:string;file_name:string;tender_id:string|null;method:string|null;tender_name:string|null};
export type CleanupRegion = SyncRegion & {method:string|null};
export type CleanupCandidate = {field:CleanupField;doc:CleanupDoc;group:'legacy'|'duplicate';reason:string;keeper?:CleanupField};
export function cleanupCandidates(fields:CleanupField[],docs:CleanupDoc[],regions:CleanupRegion[],inherited:Map<string,string>) {
  const candidates=new Map<string,CleanupCandidate>();
  const manual:{doc:CleanupDoc;key:string;fields:CleanupField[]}[]=[];
  let duplicatePairs=0;
  const valued=(f:CleanupField)=>!!f.value?.trim();
  const safe=(f:CleanupField)=>!valued(f)&&f.needs_review;
  for(const doc of docs) {
    const rows=fields.filter(f=>f.document_id===doc.id),groups=new Map<string,CleanupField[]>();
    for(const field of rows){const key=normKey(field.field_key);groups.set(key,[...(groups.get(key)??[]),field]);}
    for(const [key,group] of groups) {
      if(group.length<2)continue;
      duplicatePairs+=group.length*(group.length-1)/2;
      const withValues=group.filter(valued);
      if(new Set(withValues.map(f=>f.value?.trim())).size>1){manual.push({doc,key,fields:withValues});continue;}
      const canonical=KHLCNT_FIELDS.find(f=>normKey(f.key)===key)?.key;
      // Preserve confirmed rows as well as valued rows, preferring canonical spelling then oldest.
      const keep=[...group].sort((a,b)=>Number(valued(b))-Number(valued(a))||Number(!b.needs_review)-Number(!a.needs_review)||Number(b.field_key===canonical)-Number(a.field_key===canonical)||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id))[0];
      if (!keep) continue;
      for(const field of group)if(field!==keep&&safe(field))candidates.set(field.id,{field,doc,group:'duplicate',keeper:keep,reason:withValues.length?'Trùng khoá khác hoa thường; giữ dòng có dữ liệu':'Trùng khoá khác hoa thường; giữ dòng chuẩn hoặc cũ nhất'});
    }
    for(const field of rows) {
      if(!safe(field)||field.field_group!=='Khác'||field.sort_order!==999||candidates.has(field.id))continue;
      const same=rows.filter(f=>normKey(f.field_key)===normKey(field.field_key));
      // Never select the keeper or any row in a conflicting-value group via the legacy path.
      if(same.length>1)continue;
      const related=regions.filter(r=>normKey(r.placeholder)===normKey(field.field_key)||normKey(effectiveRegionSource(r,inherited))===normKey(field.field_key));
      const sourceRedirect=related.some(r=>normKey(r.placeholder)===normKey(field.field_key)&&normKey(effectiveRegionSource(r,inherited))!==normKey(field.field_key));
      const mismatched=related.length>0&&!related.some(r=>r.method===doc.method);
      const reason=sourceRedirect?'Vùng đã dùng nguồn dữ liệu khác':!doc.tender_id?'Hồ sơ chưa gắn gói thầu':mismatched?'Hình thức gói thầu không khớp mẫu chứa vùng':null;
      if(reason)candidates.set(field.id,{field,doc,group:'legacy',reason});
    }
  }
  return {candidates:[...candidates.values()],manual,duplicatePairs,legacyEmpty:fields.filter(f=>!valued(f)&&f.field_group==='Khác'&&f.sort_order===999).length};
}
export function cleanupCsv(rows:CleanupCandidate[]) {
  const cell=(v:string)=>`"${(/^[=+@\-\t\r]/.test(v)?"'":'')+v.replace(/"/g,'""')}"`;
  return '\uFEFF'+[['Khoá','Nhãn','Hồ sơ','Gói thầu','Nhóm','Lý do'],...rows.map(r=>[r.field.field_key,r.field.label,r.doc.file_name,r.doc.tender_name??'Chưa gắn gói thầu',r.field.field_group??'',r.reason])].map(row=>row.map(cell).join(',')).join('\r\n');
}
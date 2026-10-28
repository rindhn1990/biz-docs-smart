import { useEffect, useRef, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, FileText, Loader2, Megaphone, ScanLine } from 'lucide-react';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { DateField } from '@/components/DateField';
import { ScanFileDialog } from '@/components/ScanFileDialog';
import { DocxPreviewDialog } from '@/components/DocxPreviewDialog';
import { TemplateMissingBadge } from '@/components/TemplateMissingBadge';
import { CONTRACTOR_SCAN_FIELDS } from '@/lib/contractor';
import { noticeValues, emptyContractorPatch } from '@/lib/notice';
import { noticeFileName, packageNoticeFiles } from '@/lib/notice-export';
import { fillMappings, loadInheritedSources } from '@/lib/template-resolve';
import { renderDocxBuffer, type DelimiterStyle } from '@/lib/docx';
import { recordExport } from '@/lib/export-history';
import { formatDateVariant, formatCurrency } from '@/lib/format';
import { TENDER_METHODS } from '@/lib/methods';

export const Route = createFileRoute('/_app/thong-bao')({
  head: () => ({meta:[{title:'Thông báo nhà thầu — OfficeFlow'},{name:'description',content:'Soạn và xuất thông báo Word theo nhà thầu trong từng gói thầu.'},{property:'og:title',content:'Thông báo nhà thầu — OfficeFlow'},{property:'og:description',content:'Xuất thông báo cho nhiều nhà thầu từ mẫu Word.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
  component: NoticePage,
});
type Template = {id:string; name:string; source_docx_path:string|null; delimiter_style:string};
type Ready = {source:ArrayBuffer; style:DelimiterStyle; data:Record<string,string>; fileName:string};
const LAST_TENDER = 'officeflow.notice.last-tender';
function isoDate(value:string) { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; }

function NoticePage() {
  const {canTender,canWrite,user} = useAuth(); const qc = useQueryClient();
  const [tenderId,setTenderId] = useState(''); const [selected,setSelected] = useState<string[]>([]);
  const [selectedTemplates,setSelectedTemplates] = useState<string[]>([]); const [onlyWinners,setOnlyWinners] = useState(false);
  const [common,setCommon] = useState({number:'',date:'',content:''}); const [bulkDate,setBulkDate] = useState('');
  const [overrides,setOverrides] = useState<Record<string,Record<string,string>>>({});
  const [scanning,setScanning] = useState<string|null>(null); const [editing,setEditing] = useState<string|null>(null);
  const [saveScanned,setSaveScanned] = useState(false); const [busy,setBusy] = useState(false); const lock = useRef(false);
  const [preview,setPreview] = useState<(Ready & {title:string;templateId:string;templateName:string;contractorId:string})|null>(null);
  useEffect(() => {setTenderId(localStorage.getItem(LAST_TENDER) ?? '');},[]);
  const tenders = useQuery({queryKey:['tenders','notice'], enabled:canTender,queryFn:async()=>{
    const {data,error}=await supabase.from('tenders').select('id,name,code,package_value,funding_source,location,method,tender_type').order('created_at',{ascending:false}); if(error)throw error; return data;
  }});
  const links = useQuery({queryKey:['tender_contractors','notice',tenderId],enabled:canTender&&Boolean(tenderId),queryFn:async()=>{
    const {data,error}=await supabase.from('tender_contractors').select('id,contractor_id,role,price,bid_received_date,contractors(id,name,tax_code,address,representative,representative_title,phone,email,bank_account,bank_name)').eq('tender_id',tenderId).order('sort_order'); if(error)throw error; return data;
  }});
  const tenderData = useQuery({queryKey:['tender_data','notice',tenderId],enabled:canTender&&Boolean(tenderId),queryFn:async()=>{
    const {data,error}=await supabase.from('tender_data').select('data').eq('tender_id',tenderId).maybeSingle(); if(error)throw error;
    const result:Record<string,string>={}; if(data?.data&&typeof data.data==='object'&&!Array.isArray(data.data)) for(const [key,v] of Object.entries(data.data)) if(typeof v==='string')result[key]=v; return result;
  }});
  const templates = useQuery({queryKey:['templates','notice'],enabled:canTender,queryFn:async()=>{
    const {data,error}=await supabase.from('templates').select('id,name,source_docx_path,delimiter_style').eq('module','notice').order('sort_order').order('created_at');if(error)throw error;return data;
  }});
  const allLinks=links.data??[]; const visible=allLinks.filter(r=>!onlyWinners||r.role==='winner');
  const chosen=allLinks.filter(r=>selected.includes(r.id));
  function pickTender(id:string){setTenderId(id);localStorage.setItem(LAST_TENDER,id);setSelected([]);setOverrides({});setEditing(null);}
  function toggle(ids:string[],id:string){return ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];}
  async function saveDates(ids:string[],value:string){
    if(!canWrite||!ids.length||busy)return;setBusy(true);
    try{const {error}=await supabase.from('tender_contractors').update({bid_received_date:isoDate(value),updated_by:user?.id??null}).in('id',ids).eq('tender_id',tenderId);if(error)throw error;await qc.invalidateQueries({queryKey:['tender_contractors']});toast.success('Đã lưu ngày nhận hồ sơ');}
    catch(e){toast.error('Không lưu được ngày',{description:(e as Error).message});}finally{setBusy(false);}
  }
  async function applyScan(values:Record<string,string>){
    if(!scanning||!canWrite)return;
    const row=allLinks.find(r=>r.id===scanning);if(!row?.contractors)return;
    if(saveScanned){
      if(!window.confirm(`Chỉ điền các ô đang trống vào hồ sơ ${row.contractors.name}? Không ghi đè dữ liệu đã có.`))return;
      const {data:current,error}=await supabase.from('contractors').select('*').eq('id',row.contractor_id).single();if(error)throw error;
      for(const [column,value] of Object.entries(emptyContractorPatch(current,values))){
        const {error:updateError}=await supabase.from('contractors').update({[column]:value,updated_by:user?.id??null}).eq('id',row.contractor_id).or(`${column}.is.null,${column}.eq.`);if(updateError)throw updateError;
      }
      await qc.invalidateQueries({queryKey:['tender_contractors']});await qc.invalidateQueries({queryKey:['contractors']});
    }
    setOverrides(old=>({...old,[row.id]:{...old[row.id],...values}}));setEditing(row.id);
  }
  async function prepare(tpl:Template,id:string,at=new Date()):Promise<Ready>{
    const row=allLinks.find(r=>r.id===id); const tender=tenders.data?.find(t=>t.id===tenderId);
    if(!row?.contractors||!tender)throw new Error('Chọn gói thầu và nhà thầu trước');if(!tpl.source_docx_path)throw new Error('Mẫu chưa có file Word gốc');
    const method=TENDER_METHODS.find(m=>m.value===tender.method)?.label??tender.method;
    const values=noticeValues(row.contractors,{...tender,method},row,common,overrides[id],tenderData.data);
    const [{data:mappings,error},inherited]=await Promise.all([supabase.from('template_mappings').select('placeholder,label,source_field,value,date_format').eq('template_id',tpl.id),loadInheritedSources('notice')]);if(error)throw error;
    const {data:blob,error:downloadError}=await supabase.storage.from('templates').download(tpl.source_docx_path);if(downloadError)throw downloadError;
    return {source:await blob.arrayBuffer(),style:tpl.delimiter_style==='square'?'square':'curly',data:{...values,...fillMappings(mappings??[],values,inherited),_notice_contractor_id:row.contractor_id},fileName:noticeFileName(values.NT_ten,tpl.name,at)};
  }
  async function view(tpl:Template,id:string){setBusy(true);try{setPreview({...await prepare(tpl,id),title:tpl.name,templateId:tpl.id,templateName:tpl.name,contractorId:allLinks.find(r=>r.id===id)?.contractor_id??''});}catch(e){toast.error('Không xem trước được',{description:(e as Error).message});}finally{setBusy(false);}}
  async function history(ready:Ready,tpl:Template){await recordExport({fileName:ready.fileName,module:'notice',data:ready.data,tenderId,templateId:tpl.id,templateName:tpl.name,userId:user?.id??null,userEmail:user?.email??null});}
  async function exportFiles(){
    if(!canWrite||lock.current||!chosen.length||!selectedTemplates.length)return;lock.current=true;setBusy(true);
    try{
      const at=new Date();const files:{name:string;buffer:ArrayBuffer}[]=[];
      const entries:{ready:Ready;tpl:Template}[]=[];
      for(const row of chosen)for(const tpl of templates.data??[])if(selectedTemplates.includes(tpl.id)){
        const ready=await prepare(tpl,row.id,at);files.push({name:ready.fileName,buffer:renderDocxBuffer(ready.source,ready.style,ready.data)});entries.push({ready,tpl});
      }
      const packaged=packageNoticeFiles(files,at);saveAs(packaged.blob,packaged.name);
      for(const entry of entries)await history(entry.ready,entry.tpl);
      await qc.invalidateQueries({queryKey:['export_history']});toast.success(`Đã xuất ${files.length} thông báo`);
    }catch(e){toast.error('Không xuất được thông báo',{description:(e as Error).message});}finally{lock.current=false;setBusy(false);}
  }
  if(!canTender)return <p role="alert">Bạn không có quyền xem phân hệ Đấu thầu.</p>;
  return <div className="space-y-5">
    <PageHeader title="Thông báo nhà thầu" description="" actions={<Button asChild variant="outline"><Link to="/mau-van-ban" search={{module:'notice',tpl:undefined}}><FileText/>Mẫu thông báo</Link></Button>}/>
    <section className="space-y-4 border-b border-border pb-5">
      <label className="block max-w-2xl text-sm font-medium">Gói thầu<select aria-label="Gói thầu" className="input mt-1" value={tenderId} onChange={e=>pickTender(e.target.value)}><option value="">Chọn gói thầu</option>{tenders.data?.map(t=><option key={t.id} value={t.id}>{t.code?`${t.code} — `:''}{t.name}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Ngày ký<DateField id="notice-sign-date" value={common.date} onChange={date=>setCommon(c=>({...c,date}))} readOnly={!canWrite}/></label><label className="text-sm font-medium">Số thông báo<input aria-label="Số thông báo" className="input" value={common.number} readOnly={!canWrite} onChange={e=>setCommon(c=>({...c,number:e.target.value}))}/></label></div>
      <label className="block text-sm font-medium">Nội dung<textarea aria-label="Nội dung" className="input mt-1 min-h-20" value={common.content} readOnly={!canWrite} onChange={e=>setCommon(c=>({...c,content:e.target.value}))}/></label>
    </section>
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Nhà thầu ({selected.length} đã chọn)</h2><select aria-label="Lọc nhà thầu" className="input w-auto" value={onlyWinners?'winner':'all'} onChange={e=>{setOnlyWinners(e.target.value==='winner');setSelected([]);}}><option value="all">Tất cả</option><option value="winner">Chỉ nhà thầu trúng</option></select></div>
      <div className="flex flex-wrap items-center gap-2"><div className="w-56"><DateField id="notice-bulk-date" value={bulkDate} onChange={setBulkDate} readOnly={!canWrite} placeholder="Ngày nhận hồ sơ chung"/></div><Button variant="outline" disabled={!canWrite||busy||!selected.length} onClick={()=>void saveDates(selected,bulkDate)}>Áp dụng ngày nhận hồ sơ cho tất cả nhà thầu đã chọn</Button></div>
      {links.error?<p role="alert" className="text-destructive">Không tải được nhà thầu: {links.error.message}</p>:null}
      <div className="table-scroll overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead><tr className="border-b border-border text-left"><th className="p-2"><input aria-label="Chọn tất cả nhà thầu" type="checkbox" checked={visible.length>0&&visible.every(r=>selected.includes(r.id))} onChange={e=>setSelected(e.target.checked?visible.map(r=>r.id):[])}/></th><th className="p-2">Nhà thầu</th><th className="p-2">Vai trò</th><th className="p-2">Mã số thuế</th><th className="p-2">Email</th><th className="p-2">Giá</th><th className="p-2">Ngày nhận hồ sơ</th><th className="p-2">Thao tác</th></tr></thead><tbody>
        {visible.map(r=>{const c=r.contractors;const o=overrides[r.id];return <tr key={r.id} className="border-b border-border"><td className="p-2"><input aria-label={`Chọn ${c?.name??'nhà thầu'}`} type="checkbox" checked={selected.includes(r.id)} onChange={()=>setSelected(s=>toggle(s,r.id))}/></td><td className="p-2 font-medium">{o?.name??c?.name??'Thiếu tên'}</td><td className="p-2">{r.role==='winner'?'Trúng thầu':'Tham dự'}</td><td className="p-2">{o?.tax_code??c?.tax_code??'Thiếu dữ liệu'}</td><td className="p-2">{o?.email??c?.email??'Thiếu dữ liệu'}</td><td className="p-2 whitespace-nowrap">{formatCurrency(r.price)}</td><td className="p-2 min-w-44"><DateField value={formatDateVariant(r.bid_received_date??'','slash')} onChange={date=>void saveDates([r.id],date)} readOnly={!canWrite||busy}/></td><td className="p-2"><div className="flex gap-1"><Button size="sm" variant="outline" onClick={()=>setEditing(editing===r.id?null:r.id)}>Dữ liệu</Button><Button size="icon" variant="ghost" aria-label={`Quét giấy đăng ký kinh doanh: ${c?.name}`} title="Quét giấy đăng ký kinh doanh" disabled={!canWrite||busy} onClick={()=>{setScanning(r.id);setSaveScanned(false);}}><ScanLine/></Button></div></td></tr>;})}
        {!visible.length?<tr><td colSpan={8} className="py-8 text-center text-muted-foreground">{tenderId?'Chưa có nhà thầu trong gói':'Chọn gói thầu'}</td></tr>:null}
      </tbody></table></div>
      {editing? <div className="grid gap-3 border-b border-border py-4 sm:grid-cols-2 lg:grid-cols-3">{CONTRACTOR_SCAN_FIELDS.map(f=>{const c=allLinks.find(r=>r.id===editing)?.contractors;const value=overrides[editing]?.[f.key]??c?.[f.key]??'';return <label key={f.key} className="text-xs font-medium">{f.label}<input aria-label={f.label} className="input mt-1" value={value} placeholder="Thiếu dữ liệu" readOnly={!canWrite} onChange={e=>setOverrides(old=>({...old,[editing]:{...old[editing],[f.key]:e.target.value}}))}/></label>;})}</div>:null}
    </section>
    <section className="space-y-3 border-t border-border pt-5">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="text-base font-semibold">Mẫu thông báo ({selectedTemplates.length} đã chọn)</h2><Button disabled={!canWrite||busy||!chosen.length||!selectedTemplates.length} onClick={()=>void exportFiles()}>{busy?<Loader2 className="animate-spin"/>:<Download/>}Xuất Word / ZIP</Button></div>
      {!canWrite?<p className="text-sm text-muted-foreground">Bạn chỉ có quyền xem; xuất file cần quyền ghi.</p>:null}
      <div className="divide-y divide-border">{templates.data?.map(t=><div key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><label className="flex items-center gap-3"><input aria-label={`Chọn mẫu ${t.name}`} type="checkbox" checked={selectedTemplates.includes(t.id)} onChange={()=>setSelectedTemplates(s=>toggle(s,t.id))}/><span><span className="block font-medium">{t.name}</span><TemplateMissingBadge templateId={t.id} module="notice"/></span></label><div className="flex flex-wrap gap-2">{chosen.map(r=><Button key={r.id} size="sm" variant="outline" disabled={busy} onClick={()=>void view(t,r.id)}><Eye/>Xem trước — {overrides[r.id]?.name??r.contractors?.name}</Button>)}</div></div>)}</div>
      {!templates.data?.length?<p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Megaphone/>Chưa có mẫu thông báo nhà thầu.</p>:null}
    </section>
    {scanning?<div><div className="fixed bottom-2 left-1/2 z-[60] w-max max-w-[90vw] -translate-x-1/2 rounded-md border border-border bg-card px-4 py-2 text-sm shadow-lg"><label className="flex items-center gap-2"><input type="checkbox" checked={saveScanned} onChange={e=>setSaveScanned(e.target.checked)}/>Lưu vào hồ sơ nhà thầu (chỉ điền các ô còn trống)</label></div><ScanFileDialog title="Quét giấy đăng ký kinh doanh" description={allLinks.find(r=>r.id===scanning)?.contractors?.name??''} fields={[...CONTRACTOR_SCAN_FIELDS]} onApply={applyScan} onClose={()=>setScanning(null)}/></div>:null}
    {preview?<DocxPreviewDialog {...preview} onClose={()=>setPreview(null)} onExport={canWrite?async()=>{if(lock.current)return;lock.current=true;try{const file=packageNoticeFiles([{name:preview.fileName,buffer:renderDocxBuffer(preview.source,preview.style,preview.data)}]);saveAs(file.blob,file.name);await history(preview,{id:preview.templateId,name:preview.templateName,source_docx_path:null,delimiter_style:preview.style});await qc.invalidateQueries({queryKey:['export_history']});}finally{lock.current=false;}}:undefined} readOnly={!canWrite}/>:null}
  </div>;
}
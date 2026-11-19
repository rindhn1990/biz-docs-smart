import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { cleanupCsv, type CleanupCandidate } from '@/lib/tender-field-cleanup';
import { loadCleanupPreview } from '@/lib/tender-field-cleanup-data';

function downloadRows(rows:CleanupCandidate[],name:string) {
  const url=URL.createObjectURL(new Blob([cleanupCsv(rows)],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
export function TenderFieldCleanup() {
  const {isAdmin}=useAuth();const client=useQueryClient();
  const [open,setOpen]=useState(false),[step,setStep]=useState(1),[busy,setBusy]=useState(false),[unchecked,setUnchecked]=useState<Set<string>>(new Set()),[deleted,setDeleted]=useState<CleanupCandidate[]>([]);
  const preview=useQuery({queryKey:['tender_field_cleanup_preview'],enabled:open&&isAdmin,queryFn:loadCleanupPreview,staleTime:0});
  if(!isAdmin)return null;
  const selected=(preview.data?.candidates??[]).filter(r=>!unchecked.has(r.field.id));
  const docs=[...new Map((preview.data?.candidates??[]).map(r=>[r.doc.id,r.doc])).values()];
  async function remove() {
    if(busy||!selected.length)return;setBusy(true);
    const removed:CleanupCandidate[]=[];
    // Download precisely the approved snapshot before any deletion request.
    downloadRows(selected,'truong-thua-da-chon.csv');
    try {
      for(let offset=0;offset<selected.length;offset+=50) {
        const batch=selected.slice(offset,offset+50);
        const result=await supabase.rpc('cleanup_tender_fields',{_rows:batch.map(r=>({id:r.field.id,updated_at:r.field.updated_at,group:r.group,keeper_id:r.keeper?.id??null,keeper_updated_at:r.keeper?.updated_at??null}))});
        if(result.error)throw result.error;
        const ids=new Set(result.data??[]);removed.push(...batch.filter(r=>ids.has(r.field.id)));
      }
      toast.success(`Đã xoá ${removed.length} dòng trống`,{description:`${selected.length-removed.length} dòng được giữ lại sau kiểm tra an toàn.`});
    }catch(e){toast.error(`Đã xoá ${removed.length} dòng; các lô còn lại chưa xoá`,{description:(e as Error).message});}
    finally {
      setDeleted(removed);setStep(1);setUnchecked(new Set());
      await Promise.all(['document_fields','tender_data','documents','data_documents','dashboard','stats','tender_field_cleanup_preview'].map(key=>client.invalidateQueries({queryKey:[key]})));
      setBusy(false);
    }
  }
  return <><Button variant="outline" onClick={()=>{setOpen(true);setStep(1);setUnchecked(new Set());}}><Trash2 className="size-4"/>Dọn trường thừa</Button>
    <Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{step===1?'Dọn trường thừa — Xem trước':'Dọn trường thừa — Xác nhận'}</DialogTitle></DialogHeader>
      {preview.isFetching?<p className="flex items-center gap-2"><Loader2 className="size-4 animate-spin"/>Đang kiểm tra danh sách…</p>:null}
      {preview.error?<p className="text-destructive">Không đọc được danh sách: {(preview.error as Error).message}</p>:null}
      {preview.data?<><div className="flex flex-wrap gap-4 text-sm"><span>Dòng cũ trống: {preview.data.legacyEmpty}</span><span>Cặp trùng khoá: {preview.data.duplicatePairs}</span><span>Đã chọn: {selected.filter(r=>r.group==='legacy').length} dòng cũ + {selected.filter(r=>r.group==='duplicate').length} dòng trùng</span><span>{new Set(selected.map(r=>r.doc.id)).size} hồ sơ</span><span>Cần xử lý tay: {preview.data.manual.reduce((n,r)=>n+r.fields.length,0)} dòng</span></div>
      {step===1?<div className="max-h-[50vh] overflow-y-auto">{docs.map(doc=><section key={doc.id} className="border-b border-border py-3"><h3 className="text-sm font-semibold">{doc.file_name}</h3><p className="mb-2 text-xs text-muted-foreground">{doc.tender_name??'Chưa gắn gói thầu'}</p>{preview.data.candidates.filter(r=>r.doc.id===doc.id).map(r=><label key={r.field.id} className="flex items-start gap-2 py-1 text-sm"><Checkbox disabled={busy} checked={!unchecked.has(r.field.id)} onCheckedChange={v=>setUnchecked(prev=>{const next=new Set(prev);if(v===true)next.delete(r.field.id);else next.add(r.field.id);return next;})}/><span className="min-w-0 break-words">{r.field.field_key} · {r.field.label}<span className="block text-xs text-muted-foreground">{r.group==='legacy'?'Dòng trống do vùng mới tạo ra':'Trùng khoá khác hoa thường'} — {r.reason}</span></span></label>)}</section>)}</div>:<p className="text-sm">Xoá {selected.length} dòng đã chọn ở {new Set(selected.map(r=>r.doc.id)).size} hồ sơ. Chỉ xoá dòng còn trống và chưa được xác nhận; các dòng đã thay đổi sẽ được giữ lại.</p>}
      {preview.data.manual.length?<details className="text-sm"><summary className="cursor-pointer text-warning-foreground">Cần bạn xử lý tay ({preview.data.manual.length} nhóm)</summary>{preview.data.manual.map(r=><div key={`${r.doc.id}:${r.key}`} className="border-b border-border py-2"><p>{r.doc.file_name} · {r.key}</p>{r.fields.map(f=><p key={f.id} className="break-words text-xs">{f.field_key}: {f.value}</p>)}</div>)}</details>:null}
      </>:null}
      {deleted.length?<Button variant="outline" onClick={()=>downloadRows(deleted,'truong-da-xoa.csv')}><Download className="size-4"/>Tải {deleted.length} dòng đã xoá</Button>:null}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={()=>step===2?setStep(1):setOpen(false)}>{step===2?'Quay lại':'Đóng'}</Button><Button variant="outline" disabled={!selected.length||busy} onClick={()=>downloadRows(selected,'truong-thua-xem-truoc.csv')}><Download className="size-4"/>Danh sách CSV</Button>{step===1?<Button disabled={!selected.length||preview.isFetching||busy} onClick={()=>setStep(2)}>Tiếp tục</Button>:<ConfirmDelete title={`Xoá ${selected.length} dòng đã chọn?`} description="Không xoá dòng có dữ liệu hoặc đã được xác nhận. Điều kiện và phiên bản được kiểm tra lại khi xoá; danh sách CSV được tải xuống trước khi thực hiện." confirmLabel={`Xoá ${selected.length} dòng`} onConfirm={remove}><Button variant="destructive" disabled={busy||preview.isFetching||!selected.length}>{busy?<Loader2 className="animate-spin"/>:<Trash2/>}Xoá {selected.length} dòng đã chọn</Button></ConfirmDelete>}</DialogFooter>
    </DialogContent></Dialog></>;
}
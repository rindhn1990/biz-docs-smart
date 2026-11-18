import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DateFormatSelect } from '@/components/DateFormatSelect';
import { isDateSource } from '@/lib/format';
import { moduleSourceFields, type TemplateModule } from '@/lib/template-resolve';
import { loadRegionGroup, applyRegionGroup } from '@/lib/region-group';
import type { RegionPatch } from '@/lib/region-directory';

export type EditRegion = { template_id:string;placeholder:string;label:string;source_field:string|null;date_format:string|null;value:string|null };
export function RegionMetadataEditor({region,module,method,groupMode=false,initialAll=false,initialPatch,onClose}:{region:EditRegion;module:TemplateModule;method:string|null;groupMode?:boolean;initialAll?:boolean;initialPatch?:RegionPatch;onClose:()=>void}) {
  const client=useQueryClient();
  const [patch,setPatch]=useState({label:region.label,source_field:region.source_field,date_format:region.date_format,value:region.value,...initialPatch});
  const [applyOthers,setApplyOthers]=useState(true),[all,setAll]=useState(initialAll),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false);
  const [affected,setAffected]=useState<Awaited<ReturnType<typeof loadRegionGroup>> | null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let alive=true;setAffected(null);setError('');setConfirm(false);
    loadRegionGroup(module,method,region.placeholder,all,!groupMode&&!applyOthers?region.template_id:undefined).then(data=>{if(alive)setAffected(data);}).catch(e=>{if(alive)setError((e as Error).message);});
    return()=>{alive=false;};
  },[module,method,region.placeholder,region.template_id,all,applyOthers,groupMode]);
  async function save() {
    if(!affected?.rows.length || busy) return;
    setBusy(true);
    try {
      const result=await applyRegionGroup(affected.rows,{...patch,label:patch.label.trim()||region.placeholder,source_field:patch.source_field||null,value:patch.value||null},client);
      toast.success(`Đã đồng bộ cấu hình ở ${affected.templates.length} mẫu`,{description:result.destinations.join('\n'),duration:10000});
      if(result.syncError) toast.warning('Cấu hình đã lưu; chưa bổ sung được trường hồ sơ',{description:(result.syncError as Error).message});
      onClose();
    }catch(e){toast.error('Không lưu được cấu hình vùng',{description:(e as Error).message});}finally{setBusy(false);}
  }
  const sources=[...new Map([...moduleSourceFields(module),...(affected?.rows ?? []).filter(r=>r.source_field).map(r=>({key:r.source_field??'',label:r.label}))].map(f=>[f.key,f])).values()];
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent><DialogHeader><DialogTitle>{confirm?'Xác nhận các mẫu bị ảnh hưởng':`Cấu hình vùng ${region.placeholder}`}</DialogTitle></DialogHeader>
    {!confirm?<div className="space-y-3">
      <label className="block space-y-1 text-sm"><span>Tên hiển thị</span><Input aria-label="Tên hiển thị vùng" value={patch.label} onChange={e=>setPatch({...patch,label:e.target.value})}/></label>
      <label className="block space-y-1 text-sm"><span>Nguồn dữ liệu</span><select aria-label="Nguồn dữ liệu vùng" className="input" value={patch.source_field??''} onChange={e=>setPatch({...patch,source_field:e.target.value||null})}><option value="">Tự nhận theo tên vùng</option>{sources.map(f=><option key={f.key} value={f.key}>{f.label} ({f.key})</option>)}</select></label>
      {isDateSource(patch.source_field||region.placeholder,patch.label)?<DateFormatSelect name={region.placeholder} value={patch.date_format} onChange={v=>setPatch({...patch,date_format:v})}/>:null}
      <label className="block space-y-1 text-sm"><span>Ví dụ (chỉ hướng dẫn)</span><Input aria-label="Ví dụ vùng" value={patch.value??''} onChange={e=>setPatch({...patch,value:e.target.value})}/></label>
      {!groupMode?<label className="flex items-start gap-2 text-sm"><Checkbox checked={applyOthers} onCheckedChange={v=>setApplyOthers(v===true)}/>Áp dụng cho các mẫu khác cùng ký hiệu trong hình thức này</label>:null}
      {(groupMode||applyOthers)&&module==='tender'?<label className="flex items-center gap-2 text-sm"><Checkbox checked={all} onCheckedChange={v=>setAll(v===true)}/>Toàn phân hệ</label>:null}
    </div>:<div className="space-y-2 text-sm"><p>Áp dụng cho {affected?.templates.length??0} mẫu. Không đổi ký hiệu hoặc nội dung file Word.</p><ul className="max-h-64 list-disc overflow-auto pl-5">{affected?.templates.map(t=><li key={t.id}>{t.name}</li>)}</ul></div>}
    {error?<p className="text-sm text-destructive">{error}</p>:null}
    <DialogFooter><Button variant="outline" disabled={busy} onClick={()=>confirm?setConfirm(false):onClose()}>{confirm?'Quay lại':'Huỷ'}</Button><Button disabled={busy||!affected?.rows.length||!patch.label.trim()} onClick={()=>confirm?void save():setConfirm(true)}>{busy?<Loader2 className="animate-spin"/>:null}{confirm?'Xác nhận lưu':'Tiếp tục'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
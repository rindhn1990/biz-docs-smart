import { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { extractPlaceholdersFromFile, prettifyPlaceholder } from '@/lib/docx';
import { scopeRegionTemplates, groupRegions } from '@/lib/region-directory';
import { REGION_COLUMNS } from '@/lib/region-group';
import { refreshRegionData, syncRegionToData } from '@/lib/region-sync';
import { moduleSourceFields, type TemplateModule } from '@/lib/template-resolve';
import { methodLabel } from '@/lib/methods';
import { isDateSource } from '@/lib/format';
import { RegionMetadataEditor, type EditRegion } from '@/components/RegionMetadataEditor';

type Template = { id:string;name:string;module:string;method:string|null;source_docx_path:string|null };
export function TemplateRegionDirectory({module,templates,method}:{module:TemplateModule;templates:Template[];method:string|null}) {
 const {isAdmin,user}=useAuth(); const client=useQueryClient();
 const [search,setSearch]=useState(''),[all,setAll]=useState(false),[conflicts,setConflicts]=useState(false),[noSource,setNoSource]=useState(false);
 const [expanded,setExpanded]=useState<Set<string>>(new Set()),[editing,setEditing]=useState<EditRegion|null>(null),[single,setSingle]=useState(false);
 const [adding,setAdding]=useState(false),[templateId,setTemplateId]=useState(''),[key,setKey]=useState(''),[label,setLabel]=useState(''),[source,setSource]=useState(''),[tokens,setTokens]=useState<string[]>([]),[busy,setBusy]=useState(false);
 const scope=scopeRegionTemplates(templates,module,method,all);
 const regions=useQuery({queryKey:['template_mappings','directory',module],queryFn:async()=>{
  const result=await supabase.from('template_mappings').select(`${REGION_COLUMNS},templates!inner(module)`).eq('templates.module',module).order('sort_order').limit(5000);
  if(result.error)throw result.error;return result.data??[];
 }});
 const groups=groupRegions(regions.data??[],scope).filter(g=>(!conflicts||g.conflict)&&(!noSource||g.rows.some(r=>!r.source_field))&&g.rows.some(r=>`${r.placeholder} ${r.label} ${r.source_field??''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
 async function readTokens(id:string) {
  setTemplateId(id);setTokens([]);setKey(''); const template=scope.find(t=>t.id===id);if(!template?.source_docx_path)return;setBusy(true);
  try{const result=await supabase.storage.from('templates').download(template.source_docx_path);if(result.error)throw result.error;
   const found=await extractPlaceholdersFromFile(result.data);setTokens(found.placeholders.filter(p=>!(regions.data??[]).some(r=>r.template_id===id&&r.placeholder===p)));
  }catch(e){toast.error('Không đọc được vùng trong Word',{description:(e as Error).message});}finally{setBusy(false);}
 }
 async function add() {
  if(!isAdmin||busy||!key||!templateId)return;setBusy(true);
  try{const existing=(regions.data??[]).filter(r=>r.template_id===templateId);const result=await supabase.from('template_mappings').insert({template_id:templateId,placeholder:key,label:label.trim()||prettifyPlaceholder(key),source_field:source||null,sort_order:Math.max(0,...existing.map(r=>r.sort_order))+1,created_by:user?.id??null,updated_by:user?.id??null});if(result.error)throw result.error;
   setAdding(false);try{const messages=await syncRegionToData(templateId,[key]);toast.success('Đã thêm vùng đã có',{description:messages.join('\n'),duration:10000});}catch(e){toast.warning('Đã lưu vùng; chưa bổ sung được trường hồ sơ',{description:(e as Error).message});}await refreshRegionData(client);
  }catch(e){toast.error('Không thêm được vùng',{description:(e as Error).message});}finally{setBusy(false);}
 }
 async function remove(id:string){if(!isAdmin||busy)return;setBusy(true);try{const result=await supabase.from('template_mappings').delete().eq('id',id);if(result.error)throw result.error;await refreshRegionData(client);toast.success('Đã xoá định nghĩa; giữ nguyên file Word và dữ liệu hồ sơ');}catch(e){toast.error('Không xoá được vùng',{description:(e as Error).message});}finally{setBusy(false);}}
 return <section className="mb-5 border-y border-border py-4">
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Danh sách vùng dữ liệu đã có <span className="text-muted-foreground">({groups.length} ký hiệu)</span></h2>{isAdmin?<Button variant="outline" size="sm" onClick={()=>{setAdding(true);setTemplateId('');setTokens([]);setKey('');setLabel('');setSource('');}}><Plus/>Thêm vùng đã có</Button>:null}</div>
  <div className="mb-3 flex flex-wrap items-center gap-3 text-sm"><Input className="w-full sm:w-64" aria-label="Tìm vùng dữ liệu" placeholder="Tìm ký hiệu, tên, nguồn…" value={search} onChange={e=>setSearch(e.target.value)}/><span>{module==='tender'?`Hình thức đang chọn: ${methodLabel(method)}`:'Phân hệ đang chọn'}</span>{module==='tender'?<label className="flex items-center gap-2"><Checkbox checked={all} onCheckedChange={v=>setAll(v===true)}/>Toàn phân hệ</label>:null}<label className="flex items-center gap-2"><Checkbox checked={conflicts} onCheckedChange={v=>setConflicts(v===true)}/>Chỉ ký hiệu lệch giữa các mẫu</label><label className="flex items-center gap-2"><Checkbox checked={noSource} onCheckedChange={v=>setNoSource(v===true)}/>Chưa có nguồn</label></div>
  <div className="max-h-[32rem] overflow-auto"><table className="w-full min-w-[800px] text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="p-2">Ký hiệu</th><th className="p-2">Tên hiển thị</th><th className="p-2">Nguồn dữ liệu</th><th className="p-2">Kiểu ngày</th><th className="p-2">Ví dụ</th><th className="p-2">Mẫu</th>{isAdmin?<th className="p-2">Sửa</th>:null}</tr></thead><tbody>
   {groups.map(g=>{const first=g.rows[0];if(!first)return null;const variants=(field:'source_field'|'label'|'date_format'|'value')=>[...new Set(g.rows.map(r=>r[field]??''))].map(value=>`${value||'Chưa đặt'} (${new Set(g.rows.filter(r=>(r[field]??'')===value).map(r=>r.template_id)).size} mẫu)`).join(', ');
    return <Fragment key={g.key}><tr className="border-b border-border"><td className="p-2"><span className="num">{first.placeholder}</span>{g.conflict?<span className="mt-1 block text-xs text-warning-foreground">Lệch giữa các mẫu</span>:null}</td><td className="p-2">{g.conflict?variants('label'):first.label}</td><td className="p-2 text-xs">{g.sourceConflict?variants('source_field'):first.source_field||'Tự nhận theo tên vùng'}</td><td className="p-2 text-xs">{g.rows.some(r=>isDateSource(r.source_field||r.placeholder,r.label))?variants('date_format'):'—'}</td><td className="max-w-48 break-words p-2 text-xs text-muted-foreground">{g.conflict?variants('value'):first.value||'—'}</td><td className="p-2"><Button variant="ghost" size="sm" aria-expanded={expanded.has(g.key)} onClick={()=>setExpanded(prev=>{const next=new Set(prev);if(next.has(g.key))next.delete(g.key);else next.add(g.key);return next;})}>Dùng ở {new Set(g.rows.map(r=>r.template_id)).size} mẫu</Button></td>{isAdmin?<td className="p-2"><Button size="icon" variant="ghost" title="Sửa cấu hình chung" aria-label={`Sửa nhóm ${first.placeholder}`} disabled={busy} onClick={()=>{setSingle(false);setEditing(first);}}><Pencil className="size-4"/></Button></td>:null}</tr>
    {expanded.has(g.key)?<tr className="border-b border-border bg-muted/30"><td colSpan={isAdmin?7:6} className="px-4 py-2"><ul className="divide-y divide-border">{g.rows.map(r=>{const t=scope.find(t=>t.id===r.template_id);return <li key={r.id} className="flex flex-wrap items-center gap-2 py-2"><span className="min-w-0 flex-1 text-xs">{t?.name} · {methodLabel(t?.method)} · {r.placeholder} · {r.label} · {r.source_field||'Tự nhận'} · {r.date_format||'Tự động'} · {r.value||'—'}</span>{isAdmin?<><Button variant="ghost" size="icon" title="Sửa cấu hình vùng" aria-label={`Sửa ${r.placeholder} ở ${t?.name}`} onClick={()=>{setSingle(true);setEditing(r);}}><Pencil className="size-4"/></Button><ConfirmDelete title={`Xoá định nghĩa ${r.placeholder} ở ${t?.name}?`} description={`KHÔNG xoá chữ {{${r.placeholder}}} trong file Word. Chỉ xoá định nghĩa ở mẫu này; dữ liệu hồ sơ và mẫu khác được giữ nguyên.`} onConfirm={()=>remove(r.id)}><Button variant="ghost" size="icon" title="Xoá định nghĩa ở mẫu này" disabled={busy}><Trash2 className="size-4"/></Button></ConfirmDelete></>:null}</li>;})}</ul></td></tr>:null}</Fragment>;
   })}
   {!groups.length?<tr><td colSpan={isAdmin?7:6} className="py-6 text-center text-muted-foreground">{regions.isLoading?'Đang tải…':regions.error?'Không tải được danh sách vùng':'Không có vùng phù hợp'}</td></tr>:null}
  </tbody></table></div>
  {editing?<RegionMetadataEditor region={editing} module={module} method={templates.find(t=>t.id===editing.template_id)?.method??method} groupMode={!single} initialAll={all} onClose={()=>setEditing(null)}/>:null}
  <Dialog open={adding} onOpenChange={open=>{if(!busy)setAdding(open);}}><DialogContent><DialogHeader><DialogTitle>Thêm vùng đã có trong Word</DialogTitle></DialogHeader><div className="space-y-3"><label className="block text-sm">Mẫu văn bản<select className="input" aria-label="Mẫu của vùng" value={templateId} onChange={e=>void readTokens(e.target.value)} disabled={busy}><option value="">Chọn mẫu</option>{scope.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="block text-sm">Ký hiệu<select className="input" aria-label="Ký hiệu vùng có sẵn" value={key} onChange={e=>{setKey(e.target.value);setLabel(prettifyPlaceholder(e.target.value));}}><option value="">Chọn ký hiệu chưa có định nghĩa</option>{tokens.map(p=><option key={p}>{p}</option>)}</select></label><label className="block text-sm">Tên hiển thị<Input value={label} onChange={e=>setLabel(e.target.value)}/></label><label className="block text-sm">Nguồn dữ liệu<select className="input" value={source} onChange={e=>setSource(e.target.value)}><option value="">Tự nhận theo tên vùng</option>{moduleSourceFields(module).map(f=><option key={f.key} value={f.key}>{f.label} ({f.key})</option>)}</select></label></div><DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setAdding(false)}>Huỷ</Button><Button disabled={busy||!key||!templateId} onClick={()=>void add()}>{busy?<Loader2 className="animate-spin"/>:null}Lưu vùng</Button></DialogFooter></DialogContent></Dialog>
 </section>;
}

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, Download, Eye, Loader2, GripVertical, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { DateField, isDateField } from '@/components/DateField';
import { DocxPreviewDialog } from '@/components/DocxPreviewDialog';
import { KHLCNT_FIELDS } from '@/lib/khlcnt';
import { centerFields, centerExportValues, centerTemplatesForMethod, orderCenterMappings, sortCenterFields, centerOrderRows } from '@/lib/tender-center';
import { methodLabel } from '@/lib/methods';
import { tenderMappings } from '@/lib/tender-template-data';
import { fillMappings, loadInheritedSources } from '@/lib/template-resolve';
import { renderAndDownloadDocx, type DelimiterStyle } from '@/lib/docx';
import { recordExport } from '@/lib/export-history';
import { orderedTenderTemplates } from '@/lib/tender-controls';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { normKey } from '@/lib/template-values';
import { reorderWordFields } from '@/lib/region-directory';
import { centerFieldUsage } from '@/lib/region-sync-values';

export function useTenderCenterMappings() {
  return useQuery({ queryKey: ['template_mappings', 'tender-center'], queryFn: async () => {
    const [result, inherited] = await Promise.all([
      supabase.from('template_mappings').select('template_id,placeholder,label,source_field,value,date_format,sort_order,created_at,templates!inner(module)').eq('templates.module', 'tender').order('sort_order').limit(5000),
      loadInheritedSources('tender'),
    ]);
    if (result.error) throw result.error;
    return { rows: result.data ?? [], inherited };
  }});
}

export function TenderCenterWord({ tenderId, method, values, onChange, onSave, canWrite, excludedKeys }: {
  tenderId: string; method: string | null; values: Record<string, string>; onChange: (key: string, value: string) => void;
  onSave: () => Promise<boolean>; canWrite: boolean; excludedKeys: string[];
}) {
  const mappings = useTenderCenterMappings();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('all');
  const [fieldOrdering, setFieldOrdering] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const fieldOrder = useQuery({queryKey:['tender_center_field_order',method],enabled:!!method,queryFn:async()=>{
    const result=await supabase.from('tender_center_field_order').select('method,field_key,sort_order').eq('method',method ?? '');
    if(result.error) throw result.error; return result.data ?? [];
  }});
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); }, []);
  const [preview, setPreview] = useState<{ templateId: string; title: string; fileName: string; source: ArrayBuffer; style: DelimiterStyle; data: Record<string, string> } | null>(null);
  const templates = useQuery({ queryKey: ['templates', 'tender-center'], queryFn: async () => {
    const result = await supabase.from('templates').select('id,name,source_docx_path,delimiter_style,method').eq('module','tender').order('sort_order');
    if (result.error) throw result.error;
    return result.data ?? [];
  }});
  const order = useQuery({ queryKey: ['tender_template_order', tenderId], queryFn: async () => {
    const {data,error} = await supabase.from('tender_template_order').select('template_id,sort_order').eq('tender_id',tenderId);
    if(error) throw error;
    return data;
  }});
  const methodTemplates = orderedTenderTemplates(centerTemplatesForMethod(templates.data ?? [], method), order.data ?? []);
  async function move(templateId: string, direction: number) {
    if (!canWrite || ordering || busy || order.isLoading || order.error) return;
    const index = methodTemplates.findIndex(t => t.id === templateId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= methodTemplates.length) return;
    const next = [...methodTemplates];
    const current = next[index]; const other = next[target];
    if (!current || !other) return;
    next[index] = other; next[target] = current;
    setOrdering(true);
    const {error} = await supabase.from('tender_template_order').upsert(next.map((t,i) => ({tender_id:tenderId,template_id:t.id,sort_order:i+1})),{onConflict:'tender_id,template_id'});
    if(error) toast.error('Không lưu được thứ tự', {description:error.message});
    else await queryClient.invalidateQueries({queryKey:['tender_template_order',tenderId]});
    setOrdering(false);
  }
  const selectedTemplates = methodTemplates.filter(t => selectedTemplateId === 'all' || t.id === selectedTemplateId);
  const selectedMappings = orderCenterMappings(mappings.data?.rows ?? [], selectedTemplates);
  const allDefaultFields = centerFields(orderCenterMappings(mappings.data?.rows ?? [], methodTemplates), mappings.data?.inherited ?? new Map(), KHLCNT_FIELDS).filter(f => !excludedKeys.includes(f.key));
  const allFields = sortCenterFields(allDefaultFields,fieldOrder.data ?? [],method);
  const visibleKeys = new Set(centerFields(selectedMappings,mappings.data?.inherited ?? new Map(),KHLCNT_FIELDS).map(f=>normKey(f.key)));
  const fields = allFields.filter(f=>visibleKeys.has(normKey(f.key)));
  async function moveField(key: string, target: string) {
    if(!canWrite || !method || fieldOrdering || fieldOrder.isLoading || fieldOrder.error || key===target) return;
    const next=reorderWordFields(allFields.map(f=>f.key),fields.map(f=>f.key),key,target);
    setFieldOrdering(true);
    try {
      const result=await supabase.from('tender_center_field_order').upsert(centerOrderRows(method,next,user?.id ?? null),{onConflict:'method,field_key'});
      if(result.error) throw result.error;
      await queryClient.invalidateQueries({queryKey:['tender_center_field_order',method]});
      toast.success('Đã lưu thứ tự trường theo hình thức');
    }catch(e){toast.error('Không lưu được thứ tự trường',{description:(e as Error).message});}finally{setFieldOrdering(false);setDragKey(null);}
  }
  async function resetFieldOrder() {
    if(!method || !canWrite || fieldOrdering) return;setFieldOrdering(true);
    try {const result=await supabase.from('tender_center_field_order').delete().eq('method',method);if(result.error)throw result.error;await queryClient.invalidateQueries({queryKey:['tender_center_field_order',method]});toast.success('Đã đặt lại thứ tự mặc định');}
    catch(e){toast.error('Không đặt lại được thứ tự',{description:(e as Error).message});}finally{setFieldOrdering(false);}
  }
  async function record(ready: NonNullable<typeof preview>) {
    await recordExport({ module: 'tender', tenderId, templateId: ready.templateId, templateName: ready.title,
      fileName: ready.fileName, data: ready.data, userId: user?.id ?? null, userEmail: profile?.email ?? user?.email ?? null });
    void queryClient.invalidateQueries({ queryKey: ['export_history'] });
  }
  async function open(template: NonNullable<typeof templates.data>[number], download: boolean) {
    if (busy || template.method !== method) return;
    setBusy(template.id);
    try {
      if (!template.source_docx_path) throw new Error('Mẫu chưa có file Word gốc');
      if (canWrite && !await onSave()) return;
      const fresh = await mappings.refetch();
      if (fresh.error) throw fresh.error;
      const data = fillMappings(tenderMappings((fresh.data?.rows ?? []).filter(m => m.template_id === template.id)), centerExportValues(values), fresh.data?.inherited ?? new Map());
      const result = await supabase.storage.from('templates').download(template.source_docx_path);
      if (result.error) throw result.error;
      const ready = { templateId: template.id, title: template.name, fileName: `${template.name}_${new Date().toISOString().replace(/[:.]/g,'-')}.docx`, source: await result.data.arrayBuffer(), style: (template.delimiter_style as DelimiterStyle) ?? 'curly', data };
      if (download) {
        await renderAndDownloadDocx(ready.source, ready.style, ready.data, ready.fileName);
        await record(ready);
        toast.success('Đã xuất file Word');
      } else setPreview(ready);
    } catch (e) { toast.error('Không xuất được mẫu', { description: (e as Error).message }); }
    finally { setBusy(null); }
  }
  return <>
    <section className="panel">
      <header className="border-b border-border px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Trường dữ liệu từ mẫu Word</h2>{canWrite?<ConfirmDelete title="Đặt lại thứ tự trường mặc định?" description={`Áp dụng cho mọi gói thầu hình thức ${methodLabel(method)}. Không đổi giá trị đã nhập.`} confirmLabel="Đặt lại" onConfirm={resetFieldOrder}><Button variant="outline" size="sm" disabled={fieldOrdering||fieldOrder.isLoading||!!fieldOrder.error}><RotateCcw className="size-4"/>Đặt lại thứ tự mặc định</Button></ConfirmDelete>:null}</div><p className="mt-1 text-xs text-muted-foreground">Thứ tự áp dụng cho mọi gói thầu hình thức {methodLabel(method)}</p></header>
      <div className="px-4 pt-4">
        <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="tender-word-template">Mẫu Word</label>
        <select id="tender-word-template" className="input w-full" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
          <option value="all">Tất cả mẫu theo hình thức</option>
          {methodTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      {!templates.isLoading && !templates.error && methodTemplates.length === 0 ? <p className="px-4 pt-3 text-sm text-muted-foreground">{method ? 'Chưa có mẫu Word cho hình thức này.' : 'Gói thầu chưa chọn hình thức lựa chọn nhà thầu.'}</p> : null}
      {fieldOrder.error ? <p className="p-4 text-sm text-destructive">Không tải được thứ tự trường.</p> : null}
      {mappings.error ? <p className="p-4 text-sm text-destructive">Không tải được trường dữ liệu từ mẫu.</p> : mappings.isLoading ? <Loader2 className="m-4 size-4 animate-spin" /> :
        <div className="grid gap-3 p-4 md:grid-cols-2">{fields.map((f,index) => { const usage = centerFieldUsage(f.key, selectedMappings, mappings.data?.inherited ?? new Map(), now); return <div key={f.key} data-field-key={f.key} onDragOver={e=>{if(canWrite&&dragKey)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(dragKey)void moveField(dragKey,f.key);}}>
          {canWrite?<div className="mb-1 flex items-center gap-1"><Button variant="ghost" size="icon" className="size-7 cursor-grab" title="Kéo để đổi thứ tự" aria-label={`Kéo trường ${f.label}`} draggable={!fieldOrdering&&!fieldOrder.isLoading&&!fieldOrder.error} disabled={fieldOrdering||fieldOrder.isLoading||!!fieldOrder.error} onDragStart={e=>{setDragKey(f.key);e.dataTransfer.setData('text/plain',f.key);e.dataTransfer.effectAllowed='move';}} onDragEnd={()=>setDragKey(null)}><GripVertical className="size-4"/></Button><Button variant="ghost" size="icon" className="size-7" title="Đưa trường lên" aria-label={`Đưa trường lên: ${f.label}`} disabled={index===0||fieldOrdering||fieldOrder.isLoading||!!fieldOrder.error} onClick={()=>{const target=fields[index-1];if(target)void moveField(f.key,target.key);}}><ArrowUp className="size-4"/></Button><Button variant="ghost" size="icon" className="size-7" title="Đưa trường xuống" aria-label={`Đưa trường xuống: ${f.label}`} disabled={index===fields.length-1||fieldOrdering||fieldOrder.isLoading||!!fieldOrder.error} onClick={()=>{const target=fields[index+1];if(target)void moveField(f.key,target.key);}}><ArrowDown className="size-4"/></Button></div>:null}
          <label><span className="mb-1 block text-xs font-medium text-muted-foreground">{f.label} {usage.isNew ? <span className="ml-1 text-primary">Mới</span> : null}</span>
          {isDateField(f.key, f.label) ? <DateField value={values[f.key] ?? ''} readOnly={!canWrite} onChange={v => onChange(f.key, v)} /> :
            <input className="input" value={values[f.key] ?? ''} readOnly={!canWrite} onChange={e => onChange(f.key,e.target.value)} />}
          </label><details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Dùng ở {usage.symbols} ký hiệu / {usage.templates} mẫu</summary><ul className="mt-1 space-y-1">{usage.rows.map((r,i) => <li key={`${r.template_id}:${r.placeholder}:${i}`}>{r.placeholder} – {methodTemplates.find(t=>t.id===r.template_id)?.name}</li>)}</ul></details>
        </div>; })}</div>}
    </section>
    <section className="panel">
      <header className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Xuất Word theo gói thầu</h2></header>
      {order.error ? <p className="p-4 text-destructive">Không tải được thứ tự mẫu theo gói.</p> : null}
      {templates.error ? <p className="p-4 text-destructive">Không tải được mẫu Word.</p> : <ul className="divide-y divide-border px-4">{selectedTemplates.map(t => <li className="flex flex-wrap items-center gap-2 py-3" key={t.id}>
        <span className="w-6 text-sm text-muted-foreground">{methodTemplates.findIndex(item => item.id === t.id)+1}.</span>
        <span className="min-w-0 flex-1 text-sm font-medium">{t.name}</span>
        {canWrite ? <div className="flex gap-1">
          <Button size="icon" variant="ghost" title="Đưa mẫu lên" aria-label={`Đưa mẫu lên: ${t.name}`} disabled={ordering || !!busy || order.isLoading || !!order.error || methodTemplates[0]?.id === t.id} onClick={() => void move(t.id,-1)}><ArrowUp className="size-4" /></Button>
          <Button size="icon" variant="ghost" title="Đưa mẫu xuống" aria-label={`Đưa mẫu xuống: ${t.name}`} disabled={ordering || !!busy || order.isLoading || !!order.error || methodTemplates.at(-1)?.id === t.id} onClick={() => void move(t.id,1)}><ArrowDown className="size-4" /></Button>
        </div> : null}
        <Button variant="outline" disabled={!!busy || mappings.isLoading || !!mappings.error} onClick={() => void open(t,false)}><Eye className="size-4" />Xem trước</Button>
        {canWrite ? <Button disabled={!!busy || mappings.isLoading || !!mappings.error} onClick={() => void open(t,true)}>{busy === t.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Xuất Word</Button> : null}
      </li>)}</ul>}
    </section>
    {preview ? <DocxPreviewDialog {...preview} readOnly={!canWrite} onClose={() => setPreview(null)} onExport={async () => {
      await renderAndDownloadDocx(preview.source, preview.style, preview.data, preview.fileName);
      await record(preview);
    }} /> : null}
  </>;
}
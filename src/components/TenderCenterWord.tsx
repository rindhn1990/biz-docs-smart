import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { DateField, isDateField } from '@/components/DateField';
import { DocxPreviewDialog } from '@/components/DocxPreviewDialog';
import { KHLCNT_FIELDS } from '@/lib/khlcnt';
import { centerFields, centerExportValues, centerTemplatesForMethod } from '@/lib/tender-center';
import { methodLabel } from '@/lib/methods';
import { tenderMappings } from '@/lib/tender-template-data';
import { fillMappings, loadInheritedSources } from '@/lib/template-resolve';
import { renderAndDownloadDocx, type DelimiterStyle } from '@/lib/docx';
import { recordExport } from '@/lib/export-history';

export function useTenderCenterMappings() {
  return useQuery({ queryKey: ['template_mappings', 'tender-center'], queryFn: async () => {
    const [result, inherited] = await Promise.all([
      supabase.from('template_mappings').select('template_id,placeholder,label,source_field,value,date_format,sort_order,templates!inner(module)').eq('templates.module', 'tender').order('sort_order'),
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
  const [selectedTemplateId, setSelectedTemplateId] = useState('all');
  const [preview, setPreview] = useState<{ templateId: string; title: string; fileName: string; source: ArrayBuffer; style: DelimiterStyle; data: Record<string, string> } | null>(null);
  const templates = useQuery({ queryKey: ['templates', 'tender-center'], queryFn: async () => {
    const result = await supabase.from('templates').select('id,name,source_docx_path,delimiter_style,method').eq('module','tender').order('sort_order');
    if (result.error) throw result.error;
    return result.data ?? [];
  }});
  const methodTemplates = centerTemplatesForMethod(templates.data ?? [], method);
  const selectedTemplates = methodTemplates.filter(t => selectedTemplateId === 'all' || t.id === selectedTemplateId);
  const selectedIds = new Set(selectedTemplates.map(t => t.id));
  const selectedMappings = (mappings.data?.rows ?? []).filter(m => selectedIds.has(m.template_id));
  const fields = centerFields(selectedMappings, mappings.data?.inherited ?? new Map(), KHLCNT_FIELDS).filter(f => !excludedKeys.includes(f.key));
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
      <header className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Trường dữ liệu từ mẫu Word</h2><p className="mt-1 text-xs text-muted-foreground">{methodLabel(method)}</p></header>
      <div className="px-4 pt-4">
        <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="tender-word-template">Mẫu Word</label>
        <select id="tender-word-template" className="input w-full" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
          <option value="all">Tất cả mẫu theo hình thức</option>
          {methodTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      {!templates.isLoading && !templates.error && methodTemplates.length === 0 ? <p className="px-4 pt-3 text-sm text-muted-foreground">{method ? 'Chưa có mẫu Word cho hình thức này.' : 'Gói thầu chưa chọn hình thức lựa chọn nhà thầu.'}</p> : null}
      {mappings.error ? <p className="p-4 text-sm text-destructive">Không tải được trường dữ liệu từ mẫu.</p> : mappings.isLoading ? <Loader2 className="m-4 size-4 animate-spin" /> :
        <div className="grid gap-3 p-4 md:grid-cols-2">{fields.map(f => <label key={f.key}>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">{f.label}</span>
          {isDateField(f.key, f.label) ? <DateField value={values[f.key] ?? ''} readOnly={!canWrite} onChange={v => onChange(f.key, v)} /> :
            <input className="input" value={values[f.key] ?? ''} readOnly={!canWrite} onChange={e => onChange(f.key,e.target.value)} />}
        </label>)}</div>}
    </section>
    <section className="panel">
      <header className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Xuất Word theo gói thầu</h2></header>
      {templates.error ? <p className="p-4 text-destructive">Không tải được mẫu Word.</p> : <ul className="divide-y divide-border px-4">{selectedTemplates.map(t => <li className="flex flex-wrap items-center gap-2 py-3" key={t.id}>
        <span className="min-w-0 flex-1 text-sm font-medium">{t.name}</span>
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
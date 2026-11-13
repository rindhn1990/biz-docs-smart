import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { extractPlaceholdersFromFile, prettifyPlaceholder } from '@/lib/docx';
import { renameRegionToken, validateRegionKey } from '@/lib/template-region-edit';
import { saveTemplateFile } from '@/lib/template-file-save';
import { loadInheritedSources, normKey, moduleSourceFields, type TemplateModule } from '@/lib/template-resolve';
import { tenderSourceKey } from '@/lib/tender-template-data';

type Template = { id: string; name: string; module: string; source_docx_path: string | null };
type Region = { id: string; template_id: string; placeholder: string; label: string; source_field: string | null; sort_order: number };

export function TemplateRegionDirectory({ module, templates }: { module: TemplateModule; templates: Template[] }) {
  const { isAdmin, user } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [draft, setDraft] = useState<{ id?: string; templateId: string; key: string; label: string; source: string } | null>(null);
  const [tokens, setTokens] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const scoped = templates.filter(t => t.module === module);
  const regions = useQuery({
    queryKey: ['template_mappings', 'directory', module],
    queryFn: async () => {
      const { data, error } = await supabase.from('template_mappings').select('id,template_id,placeholder,label,source_field,sort_order,templates!inner(module)').eq('templates.module', module).order('sort_order');
      if (error) throw error;
      return data as Region[];
    },
  });
  const visible = useMemo(() => (regions.data ?? []).filter(r => (!filter || r.template_id === filter) && `${r.placeholder} ${r.label} ${scoped.find(t => t.id === r.template_id)?.name ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [regions.data, scoped, search, filter]);
  const refresh = () => Promise.all(['template_mappings', 'template_custom_fields', 'template_field_examples', 'templates'].map(key => client.invalidateQueries({ queryKey: [key] })));

  async function readTokens(templateId: string) {
    setTokens([]);
    const template = scoped.find(t => t.id === templateId);
    if (!template?.source_docx_path) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.storage.from('templates').download(template.source_docx_path);
      if (error || !data) throw error ?? new Error('Không tải được mẫu');
      const found = await extractPlaceholdersFromFile(data);
      setTokens(found.placeholders.filter(key => !(regions.data ?? []).some(r => r.template_id === templateId && r.placeholder === key)));
    } catch (error) { toast.error('Không đọc được các vùng trong mẫu', { description: (error as Error).message }); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!draft || !isAdmin || busy) return;
    const template = scoped.find(t => t.id === draft.templateId);
    if (!template) return;
    setBusy(true);
    let original: ArrayBuffer | undefined;
    let changed: ArrayBuffer | undefined;
    let committed = false;
    try {
      const existing = (regions.data ?? []).filter(r => r.template_id === draft.templateId);
      const old = existing.find(r => r.id === draft.id);
      const key = validateRegionKey(draft.key, existing.map(r => r.placeholder), old?.placeholder);
      const label = draft.label.trim() || prettifyPlaceholder(key);
      let source = draft.source || null;
      let count = 0;
      if (old && old.placeholder !== key) {
        if (!template.source_docx_path) throw new Error('Mẫu chưa có file Word gốc');
        // Pin the old resolved source so renaming does not change package data keys.
        if (!source) {
          const inherited = await loadInheritedSources(module);
          source = inherited.get(normKey(old.placeholder)) || (module === 'tender' ? tenderSourceKey(old.placeholder) : old.placeholder);
        }
        const { data, error } = await supabase.storage.from('templates').download(template.source_docx_path);
        if (error || !data) throw error ?? new Error('Không đọc được mẫu');
        original = await data.arrayBuffer();
        const renamed = renameRegionToken(original, old.placeholder, key);
        changed = renamed.buffer;
        count = renamed.count;
        if (!count) throw new Error('Không tìm thấy ký hiệu cũ trong file Word; bản hiện tại được giữ nguyên');
        await saveTemplateFile(template.source_docx_path, changed, true, original);
      }
      if (!old && !tokens.includes(key)) throw new Error('Chọn một vùng đã có trong file Word');
      const result = old
        ? await supabase.from('template_mappings').update({ placeholder: key, label, source_field: source, updated_by: user?.id ?? null }).eq('id', old.id).eq('template_id', template.id)
        : await supabase.from('template_mappings').insert({ template_id: template.id, placeholder: key, label, source_field: source, sort_order: Math.max(0, ...existing.map(r => r.sort_order)) + 1, created_by: user?.id ?? null, updated_by: user?.id ?? null });
      if (result.error) throw result.error;
      committed = true;
      setDraft(null);
      toast.success(old ? 'Đã sửa vùng dữ liệu' : 'Đã thêm vùng dữ liệu', { description: count ? `Đã đổi ký hiệu tại ${count} vị trí trong Word; giữ nguyên nguồn dữ liệu theo gói.` : undefined });
      await refresh();
    } catch (error) {
      if (!committed && original && changed && template.source_docx_path) {
        try { await saveTemplateFile(template.source_docx_path, original, true, changed); }
        catch { toast.error('Không khôi phục được file; hãy dùng Hoàn tác lần sửa gần nhất trước khi xuất'); }
      }
      toast.error('Không lưu được vùng dữ liệu', { description: (error as Error).message });
    } finally { setBusy(false); }
  }

  async function remove(region: Region) {
    if (!isAdmin || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('template_mappings').delete().eq('id', region.id).eq('template_id', region.template_id);
      if (error) throw error;
      await refresh();
      toast.success('Đã xoá định nghĩa vùng; giữ nguyên file Word và dữ liệu gói thầu');
    } catch (error) { toast.error('Không xoá được vùng', { description: (error as Error).message }); }
    finally { setBusy(false); }
  }

  return <section className="mb-5 border-y border-border py-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">Danh sách vùng dữ liệu đã có <span className="text-muted-foreground">({visible.length})</span></h2>
      {isAdmin && <Button variant="outline" size="sm" onClick={() => { setDraft({ templateId: filter, key: '', label: '', source: '' }); if (filter) void readTokens(filter); }}><Plus /> Thêm vùng đã có</Button>}
    </div>
    <div className="mb-3 flex flex-wrap gap-2">
      <Input className="w-full sm:w-72" aria-label="Tìm vùng dữ liệu" placeholder="Tìm tên, ký hiệu hoặc mẫu…" value={search} onChange={e => setSearch(e.target.value)} />
      <select className="max-w-full rounded-md border border-input bg-background px-3 py-2 text-sm" aria-label="Lọc vùng theo mẫu" value={filter} onChange={e => setFilter(e.target.value)}><option value="">Tất cả mẫu trong phân hệ</option>{scoped.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
    </div>
    <div className="max-h-80 overflow-auto">
      <table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="px-3 py-2">Tên vùng</th><th className="px-3 py-2">Ký hiệu</th><th className="px-3 py-2">Mẫu văn bản</th><th className="px-3 py-2">Nguồn dữ liệu</th>{isAdmin && <th className="px-3 py-2">Thao tác</th>}</tr></thead><tbody>
        {visible.map(r => <tr key={r.id} className="border-b border-border"><td className="px-3 py-2">{r.label}</td><td className="num px-3 py-2">{r.placeholder}</td><td className="px-3 py-2">{scoped.find(t => t.id === r.template_id)?.name}</td><td className="px-3 py-2 text-muted-foreground">{r.source_field || 'Tự nhận theo tên vùng'}</td>{isAdmin && <td className="px-3 py-2"><div className="flex gap-1"><Button size="icon" variant="ghost" title="Sửa vùng dữ liệu" aria-label={`Sửa vùng ${r.placeholder}`} disabled={busy} onClick={() => setDraft({ id: r.id, templateId: r.template_id, key: r.placeholder, label: r.label, source: r.source_field ?? '' })}><Pencil className="size-4" /></Button><ConfirmDelete title={`Xoá định nghĩa ${r.placeholder}?`} description="Chỉ xoá định nghĩa trong mẫu này. Ký hiệu trong Word và dữ liệu đã nhập theo gói vẫn được giữ; các mẫu khác không thay đổi." onConfirm={() => remove(r)}><Button size="icon" variant="ghost" disabled={busy} title="Xoá định nghĩa" aria-label={`Xoá định nghĩa ${r.placeholder}`}><Trash2 className="size-4" /></Button></ConfirmDelete></div></td>}</tr>)}
        {!visible.length && <tr><td colSpan={isAdmin ? 5 : 4} className="py-6 text-center text-muted-foreground">{regions.isLoading ? 'Đang tải…' : regions.error ? 'Không tải được danh sách vùng' : 'Chưa có vùng dữ liệu phù hợp'}</td></tr>}
      </tbody></table>
    </div>
    <Dialog open={!!draft} onOpenChange={open => { if (!open && !busy) setDraft(null); }}><DialogContent><DialogHeader><DialogTitle>{draft?.id ? 'Sửa vùng dữ liệu' : 'Thêm vùng đã có trong Word'}</DialogTitle></DialogHeader>{draft && <div className="space-y-3">
      <label className="block space-y-1 text-sm"><span>Mẫu văn bản</span><select aria-label="Mẫu của vùng" disabled={!!draft.id || busy} className="w-full rounded-md border border-input bg-background p-2" value={draft.templateId} onChange={e => { const id = e.target.value; setDraft({ ...draft, templateId: id, key: '' }); void readTokens(id); }}><option value="">Chọn mẫu</option>{scoped.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="block space-y-1 text-sm"><span>Ký hiệu</span>{draft.id ? <Input aria-label="Ký hiệu vùng" value={draft.key} onChange={e => setDraft({ ...draft, key: e.target.value })} /> : <select aria-label="Ký hiệu vùng có sẵn" className="w-full rounded-md border border-input bg-background p-2" value={draft.key} onChange={e => setDraft({ ...draft, key: e.target.value, label: prettifyPlaceholder(e.target.value) })}><option value="">{busy ? 'Đang đọc Word…' : 'Chọn ký hiệu chưa có định nghĩa'}</option>{tokens.map(key => <option key={key}>{key}</option>)}</select>}</label>
      <label className="block space-y-1 text-sm"><span>Tên vùng</span><Input aria-label="Tên vùng" value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} /></label>
      <label className="block space-y-1 text-sm"><span>Nguồn dữ liệu</span><select aria-label="Nguồn của vùng" className="w-full rounded-md border border-input bg-background p-2" value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })}><option value="">Tự nhận theo tên vùng</option>{[...new Map([...moduleSourceFields(module), ...(regions.data ?? []).filter(r => r.source_field).map(r => ({ key: r.source_field ?? '', label: r.label }))].map(f => [f.key, f])).values()].map(f => <option key={f.key} value={f.key}>{f.label} ({f.key})</option>)}</select></label>
    </div>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDraft(null)}>Huỷ</Button><Button disabled={busy || !draft?.key || !draft.templateId} onClick={() => void save()}>{busy && <Loader2 className="animate-spin" />}Lưu vùng</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
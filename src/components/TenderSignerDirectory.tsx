import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/DateField';
import { ConfirmDelete } from '@/components/ConfirmDelete';
import { signerValues, type TenderSigner } from '@/lib/tender-controls';

function SignerRow({ row, onSaved }: { row: TenderSigner; onSaved: () => void }) {
  const [draft, setDraft] = useState(row);
  const [busy, setBusy] = useState(false);
  return <tr className="border-b border-border">
    <td className="p-2"><input aria-label="Tên người ký" className="input" value={draft.name} onChange={e => setDraft({...draft,name:e.target.value})} /></td>
    <td className="p-2"><input aria-label="Số uỷ quyền trong danh bạ" className="input" value={draft.authorization_number} onChange={e => setDraft({...draft,authorization_number:e.target.value})} /></td>
    <td className="p-2"><DateField value={draft.authorization_date} onChange={v => setDraft({...draft,authorization_date:v})} /></td>
    <td className="p-2"><div className="flex gap-1"><Button size="icon" variant="outline" aria-label="Lưu người ký" disabled={busy || !draft.name.trim()} onClick={async () => {
      setBusy(true);
      const {error} = await supabase.from('tender_signers').update({name:draft.name.trim(),authorization_number:draft.authorization_number,authorization_date:draft.authorization_date}).eq('id',row.id);
      setBusy(false);
      if(error) toast.error(error.message); else { toast.success('Đã lưu người ký'); onSaved(); }
    }}><Save className="size-4" /></Button>
    <ConfirmDelete title={`Xoá người ký ${row.name}?`} description="Dữ liệu đã lưu trong các gói thầu không thay đổi." onConfirm={async () => {
      const {error} = await supabase.from('tender_signers').delete().eq('id',row.id);
      if(error) toast.error(error.message); else onSaved();
    }}><Button size="icon" variant="outline" aria-label="Xoá người ký"><Trash2 className="size-4" /></Button></ConfirmDelete></div></td>
  </tr>;
}

export function TenderSignerDirectory({ values, onChange, canWrite, isAdmin }: {
  values: Record<string,string>; onChange: (values: Record<string,string>) => void; canWrite: boolean; isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [managing, setManaging] = useState(false);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const rows = useQuery({queryKey:['tender_signers'],queryFn:async () => {
    const {data,error} = await supabase.from('tender_signers').select('*').order('name');
    if(error) throw error;
    return data;
  }});
  const refresh = () => { void qc.invalidateQueries({queryKey:['tender_signers']}); };
  const currentName = values['Sign_Photong'] ?? values['Sign_PhoTong'] ?? '';
  const selected = rows.data?.find(r => r.name === currentName && r.authorization_number === (values['UQ_photong'] ?? values['UQ_Photong'] ?? '') && r.authorization_date === (values['Date_UQ_Photong'] ?? ''));
  return <section className="panel">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Người ký · Uỷ quyền</h2>
      {isAdmin ? <Button variant="outline" onClick={() => setManaging(!managing)}><Users className="size-4" />Danh bạ người ký</Button> : null}
    </header>
    {rows.error ? <p className="p-4 text-destructive">Không tải được danh bạ người ký.</p> : null}
    <div className="grid gap-3 p-4 md:grid-cols-3">
      <label className="text-xs font-medium">Chọn người ký<select aria-label="Chọn người ký" className="input mt-1" disabled={!canWrite || rows.isLoading || !!rows.error} value={selected?.id ?? (currentName ? 'saved' : '')} onChange={e => onChange(signerValues(values,rows.data?.find(r => r.id === e.target.value) ?? null))}>
        <option value="">Chưa chọn</option>{currentName && !selected ? <option value="saved">{currentName} (đã lưu theo gói)</option> : null}
        {rows.data?.map(r => <option value={r.id} key={r.id}>{r.name} · {r.authorization_number || 'Chưa có số uỷ quyền'}</option>)}
      </select></label>
      <label className="text-xs font-medium">Số uỷ quyền<input aria-label="Số uỷ quyền theo gói" className="input mt-1" value={values['UQ_photong'] ?? values['UQ_Photong'] ?? ''} readOnly={!canWrite} onChange={e => onChange({...values,UQ_photong:e.target.value,UQ_Photong:e.target.value})} /></label>
      <label className="text-xs font-medium">Ngày uỷ quyền<div className="mt-1"><DateField value={values['Date_UQ_Photong'] ?? ''} readOnly={!canWrite} onChange={v => onChange({...values,Date_UQ_Photong:v})} /></div></label>
    </div>
    {managing && isAdmin ? <div className="border-t border-border p-4">
      <div className="mb-3 flex gap-2"><input aria-label="Tên người ký mới" className="input" value={name} onChange={e => setName(e.target.value)} />
        <Button disabled={adding || !name.trim()} onClick={async () => {
          setAdding(true);
          const {error} = await supabase.from('tender_signers').insert({name:name.trim()});
          setAdding(false);
          if(error) toast.error(error.message); else {setName('');refresh();}
        }}><Plus className="size-4" />Thêm</Button></div>
      <div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Người ký</th><th className="p-2 text-left">Số uỷ quyền</th><th className="p-2 text-left">Ngày uỷ quyền</th><th className="p-2" /></tr></thead><tbody>
        {rows.data?.map(r => <SignerRow key={`${r.id}-${r.name}-${r.authorization_number}-${r.authorization_date}`} row={r} onSaved={refresh} />)}
      </tbody></table></div>
    </div> : null}
  </section>;
}
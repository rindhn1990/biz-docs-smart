import { normKey } from './template-values';

export const SIGNER_FIELDS = [
  { key: 'Sign_Photong', label: 'Người ký (Phó tổng)' },
  { key: 'UQ_photong', label: 'Số uỷ quyền' },
  { key: 'Date_UQ_Photong', label: 'Ngày uỷ quyền' },
];
export type TenderSigner = { id: string; name: string; authorization_number: string; authorization_date: string };
export function signerValues(values: Record<string, string>, signer: TenderSigner | null) {
  const replacements: Record<string, string> = {
    Sign_Photong: signer?.name ?? '', UQ_photong: signer?.authorization_number ?? '', Date_UQ_Photong: signer?.authorization_date ?? '',
  };
  const out = { ...values };
  for (const [key, value] of Object.entries(replacements)) {
    for (const existing of Object.keys(out)) if (normKey(existing) === normKey(key)) out[existing] = value;
    out[key] = value;
  }
  return out;
}
export function orderedTenderTemplates<T extends { id: string }>(templates: readonly T[], order: readonly { template_id: string; sort_order: number }[]) {
  const positions = new Map(order.map(r => [r.template_id, r.sort_order]));
  return templates.map((t, index) => ({ t, position: positions.get(t.id) ?? Number.MAX_SAFE_INTEGER, index }))
    .sort((a,b) => a.position - b.position || a.index - b.index).map(r => r.t);
}
export function suggestionsForModule<T extends { module: string; placeholder: string }>(rows: readonly T[], module: string) {
  const seen = new Set<string>();
  return rows.filter(r => {
    if (r.module !== module || seen.has(normKey(r.placeholder))) return false;
    seen.add(normKey(r.placeholder));
    return true;
  });
}
import { formatDateVariant, resolveDateVariant } from "./format";

export type MappingLike = { placeholder: string; label?: string | null; source_field: string | null; value: string | null; date_format?: string | null };

export function normKey(s: string | null | undefined) {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[\s_\-.:]+/g, "");
}

/** Formatting belongs to each region, never to the editable source value. */
export function applyMappingDateFormats(mappings: Pick<MappingLike, "placeholder" | "date_format" | "label">[], values: Record<string, string>) {
  const out = { ...values };
  for (const m of mappings) {
    if (Object.hasOwn(out, m.placeholder)) out[m.placeholder] = formatDateVariant(out[m.placeholder] ?? "", resolveDateVariant(m.date_format, m.label));
  }
  return out;
}

export function fillMappings(mappings: MappingLike[], data: Record<string, string>, inherited: Map<string, string>) {
  const byNorm = new Map<string, string>();
  for (const [k, v] of Object.entries(data)) if (v?.trim()) byNorm.set(normKey(k), v);
  const out: Record<string, string> = {};
  for (const m of mappings) {
    let v = (m.source_field ? data[m.source_field] : data[m.placeholder])?.trim() || "";
    if (!v && m.source_field) v = byNorm.get(normKey(m.source_field))?.trim() ?? "";
    if (!v && !m.source_field) {
      v = byNorm.get(normKey(m.placeholder))?.trim() ?? "";
      const inh = inherited.get(normKey(m.placeholder));
      if (!v && inh) v = (data[inh] ?? byNorm.get(normKey(inh)) ?? "").trim();
    }
    out[m.placeholder] = formatDateVariant(v, resolveDateVariant(m.date_format, m.label));
  }
  return out;
}
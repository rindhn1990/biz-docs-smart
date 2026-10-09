import { supabase } from "@/integrations/supabase/client";
import { KHLCNT_FIELDS } from "@/lib/khlcnt";
import { HR_TEMPLATE_FIELDS } from "@/lib/hr";
import { PAYMENT_TEMPLATE_FIELDS } from "@/lib/payment";

export type TemplateModule = "tender" | "hr" | "payment";

/** Chuẩn hoá tên vùng/trường để so khớp: bỏ dấu, chữ thường, bỏ khoảng trắng, gạch dưới, gạch ngang. */
export function normKey(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[\s_\-.:]+/g, "");
}

export function moduleSourceFields(module: TemplateModule): readonly { key: string; label: string }[] {
  return module === "hr" ? HR_TEMPLATE_FIELDS : module === "payment" ? PAYMENT_TEMPLATE_FIELDS : KHLCNT_FIELDS;
}

/**
 * Nguồn đã gán ở các mẫu khác cùng phân hệ, theo tên vùng đã chuẩn hoá.
 * Nhiều nguồn cho cùng tên: chọn nguồn dùng nhiều nhất, hoà thì nguồn gán gần nhất.
 */
export async function loadInheritedSources(module: TemplateModule) {
  const { data } = await supabase
    .from("template_mappings")
    .select("placeholder,source_field,updated_at,templates!inner(module)")
    .eq("templates.module", module)
    .not("source_field", "is", null)
    .limit(5000);
  const stats = new Map<string, Map<string, { n: number; last: string }>>();
  for (const r of (data ?? []) as { placeholder: string; source_field: string | null; updated_at: string }[]) {
    if (!r.source_field) continue;
    const k = normKey(r.placeholder);
    const inner = stats.get(k) ?? new Map();
    const s = inner.get(r.source_field) ?? { n: 0, last: "" };
    s.n += 1;
    if (r.updated_at > s.last) s.last = r.updated_at;
    inner.set(r.source_field, s);
    stats.set(k, inner);
  }
  const out = new Map<string, string>();
  for (const [k, inner] of stats) {
    const best = [...inner.entries()].sort((a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last))[0];
    if (best) out.set(k, best[0]);
  }
  return out;
}

type MappingLike = { placeholder: string; label?: string | null; source_field: string | null; value: string | null };

/**
 * Tìm nguồn cho vùng chưa có nguồn: (1) trùng tên chuẩn hoá với khoá dữ liệu sẵn có,
 * (2) kế thừa nguồn từ mẫu khác cùng phân hệ, (3) tuỳ chọn: trùng nhãn với trường nguồn.
 */
export function resolveSource(
  m: MappingLike,
  dataKeys: Iterable<string>,
  inherited: Map<string, string>,
  labelFields?: readonly { key: string; label: string }[],
): { key: string; via: "name" | "inherit" | "label" } | null {
  if (m.source_field) return { key: m.source_field, via: "name" };
  const k = normKey(m.placeholder);
  for (const d of dataKeys) if (normKey(d) === k) return { key: d, via: "name" };
  const inh = inherited.get(k);
  if (inh) return { key: inh, via: "inherit" };
  if (labelFields && m.label) {
    const l = normKey(m.label);
    const f = labelFields.find((x) => normKey(x.label) === l);
    if (f) return { key: f.key, via: "label" };
  }
  return null;
}

/** Ghép dữ liệu cho mọi vùng: nguồn đã gán → giá trị cố định → tự khớp tên/kế thừa khi xuất. */
export function fillMappings(
  mappings: MappingLike[],
  data: Record<string, string>,
  inherited: Map<string, string>,
) {
  const byNorm = new Map<string, string>();
  for (const [k, v] of Object.entries(data)) if (v?.trim()) byNorm.set(normKey(k), v);
  const out: Record<string, string> = {};
  for (const m of mappings) {
    let v = (m.source_field ? data[m.source_field] : data[m.placeholder])?.trim() || "";
    if (!v && m.source_field) v = byNorm.get(normKey(m.source_field))?.trim() ?? "";
    if (!v) v = m.value?.trim() ?? "";
    if (!v && !m.source_field) {
      v = byNorm.get(normKey(m.placeholder))?.trim() ?? "";
      const inh = inherited.get(normKey(m.placeholder));
      if (!v && inh) v = (data[inh] ?? byNorm.get(normKey(inh)) ?? "").trim();
    }
    out[m.placeholder] = v;
  }
  return out;
}

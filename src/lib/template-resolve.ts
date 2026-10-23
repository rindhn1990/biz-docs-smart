import { supabase } from "@/integrations/supabase/client";
import { KHLCNT_FIELDS } from "@/lib/khlcnt";
import { HR_TEMPLATE_FIELDS } from "@/lib/hr";
import { PAYMENT_TEMPLATE_FIELDS } from "@/lib/payment";
import { normKey, type MappingLike } from "./template-values";
export { normKey, fillMappings, applyMappingDateFormats } from "./template-values";

export type TemplateModule = "tender" | "hr" | "payment";

/** Chuẩn hoá tên vùng/trường để so khớp: bỏ dấu, chữ thường, bỏ khoảng trắng, gạch dưới, gạch ngang. */

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

/** Ghép dữ liệu cho mọi vùng: nguồn đã gán → tự khớp tên/kế thừa. Giá trị ví dụ của mẫu KHÔNG được điền vào file xuất. */

/**
 * Đề xuất nguồn + nhãn cho chỗ trống mới dò được khi tải/thay mẫu.
 * Chỉ gán khi chắc chắn: trùng tên chuẩn hoá với khoá nguồn, hoặc kế thừa
 * từ vùng cùng tên ở mẫu khác cùng phân hệ (nguồn dùng nhiều nhất).
 */
export async function suggestForNewPlaceholders(module: TemplateModule, placeholders: string[]) {
  const fields = moduleSourceFields(module);
  const keys = fields.map((f) => f.key);
  const out = new Map<string, { source_field: string | null; label: string | null }>();
  if (!placeholders.length) return out;
  const [inherited, { data }] = await Promise.all([
    loadInheritedSources(module),
    supabase
      .from("template_mappings")
      .select("placeholder,label,source_field,updated_at,templates!inner(module)")
      .eq("templates.module", module)
      .order("updated_at", { ascending: false })
      .limit(5000),
  ]);
  const labels = new Map<string, string>();
  for (const r of (data ?? []) as { placeholder: string; label: string | null; source_field: string | null }[]) {
    const k = normKey(r.placeholder);
    if (r.label && !labels.has(k) && r.source_field === inherited.get(k)) labels.set(k, r.label);
  }
  for (const p of placeholders) {
    const r = resolveSource({ placeholder: p, source_field: null, value: null }, keys, inherited);
    const k = normKey(p);
    const label = labels.get(k) ?? (r ? fields.find((f) => f.key === r.key)?.label ?? null : null);
    out.set(p, { source_field: r?.key ?? null, label });
  }
  return out;
}

import { PAYMENT_TEMPLATE_FIELDS } from "./payment";
import { CONTRACTOR_SCAN_FIELDS } from "./contractor";

export const DEFAULT_PAYMENT_SCAN_KEYS = ["HD_so", "HD_ngay", "TT_noidung", "TT_ngay"];
export const PAYMENT_DATE_KEYS = new Set(["HD_ngay", "TT_ngay", "TT_hanthanhtoan"]);
export const PAYMENT_MONEY_KEYS = new Set(["HD_giatri", "TT_tongtien"]);

/** Only configured payment sources plus the always-available core fields. */
export function paymentScanExtraFields(sources: Iterable<string>) {
  const keys = new Set([...DEFAULT_PAYMENT_SCAN_KEYS, ...sources]);
  return PAYMENT_TEMPLATE_FIELDS.filter((f) => keys.has(f.key) &&
    !f.key.startsWith("NT_") && !["TT_sotien", "TT_sotien_chu"].includes(f.key))
    .map((f) => ({ key: f.key, label: f.label.split(" — ").slice(1).join(" — ") || f.label }));
}

export function normalizePaymentDate(value: string) {
  const m = value.trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/) ??
    value.match(/ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i);
  if (m?.[1] && m[2] && m[3]) return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`;
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : value.trim();
}

export function splitPaymentScan(values: Record<string, string>) {
  const contractor: Record<string, string> = {};
  const edits: Record<string, string> = {};
  const contractorKeys = new Set<string>(CONTRACTOR_SCAN_FIELDS.map((f) => f.key));
  const paymentKeys = new Set<string>(PAYMENT_TEMPLATE_FIELDS.map((f) => f.key));
  for (const [key, raw] of Object.entries(values)) {
    const value = raw.trim();
    if (!value) continue;
    if (contractorKeys.has(key)) contractor[key] = value;
    else if (paymentKeys.has(key) && !key.startsWith("NT_") &&
      !["TT_noidung", "TT_sotien", "TT_sotien_chu"].includes(key)) {
      edits[key] = PAYMENT_DATE_KEYS.has(key) ? normalizePaymentDate(value) : value;
    }
  }
  return { contractor, edits, amount: values.pay_amount?.trim(), content: values.TT_noidung?.trim() };
}
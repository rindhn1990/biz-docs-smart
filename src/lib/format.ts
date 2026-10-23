export type DateVariant = "slash" | "vn_full" | "vn_full_short" | "vn_no_prefix";

export function isDateSource(key: string | null | undefined, label?: string | null) {
  const name = (key ?? "").split(".").at(-1) ?? "";
  return /^date_/i.test(name) || /_date$/i.test(name) || /_ngay$/i.test(name) || name === "TT_hanthanhtoan" || /^ngày\b/i.test((label ?? "").trim());
}

function dateParts(value: string) {
  const slash = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(value);
  const iso = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(value);
  if (!slash && !iso) return null;
  const d = Number(slash?.[1] ?? iso?.[3]);
  const m = Number(slash?.[2] ?? iso?.[2]);
  const y = Number(slash?.[3] ?? iso?.[1]);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > (days[m - 1] ?? 0)) return null;
  return { d, m, y };
}

/** Format only valid, complete dates; null keeps the existing source verbatim. */
export function formatDateVariant(value: string, variant?: string | null): string {
  if (!variant) return value;
  const parts = dateParts(value);
  if (!parts) return value;
  const { d, m, y } = parts;
  const day = String(d).padStart(2, "0");
  const month = String(m).padStart(2, "0");
  if (variant === "slash") return `${day}/${month}/${String(y).padStart(4, "0")}`;
  if (variant === "vn_full") return `ngày ${day} tháng ${month} năm ${String(y).padStart(4, "0")}`;
  if (variant === "vn_full_short") return `ngày ${d} tháng ${m} năm ${String(y).padStart(4, "0")}`;
  if (variant === "vn_no_prefix") return `${day} tháng ${month} năm ${String(y).padStart(4, "0")}`;
  return value;
}

/** Only complete valid date phrases provide a confident format suggestion. */
export function detectDateVariant(text: string): DateVariant | null {
  const full = /^(ngày\s+)?(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})$/i.exec(text.trim());
  if (full) {
    if (!dateParts(`${full[2]}/${full[3]}/${full[4]}`)) return null;
    if (!full[1]) return "vn_no_prefix";
    return full[2]?.length === 2 && full[3]?.length === 2 ? "vn_full" : "vn_full_short";
  }
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text.trim()) && dateParts(text) ? "slash" : null;
}

export function formatCurrency(value: number | null | undefined, currency = "VND") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function formatCompact(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`;
  return new Intl.NumberFormat("vi-VN").format(n);
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("vi-VN").format(Number(value));
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysUntil(date: string | null | undefined) {
  if (!date) return null;
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function parseVnNumber(input: string): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

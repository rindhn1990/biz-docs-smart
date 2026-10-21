import { readVietnameseMoney } from "@/lib/money";

/** Các vùng dữ liệu được phép dùng trong mẫu email thông báo lương. */
export const SALARY_PLACEHOLDERS = [
  { key: "Ten_NV", label: "Tên nhân viên" },
  { key: "Thang", label: "Tháng (MM/YYYY)" },
  { key: "Nam", label: "Năm" },
  { key: "Luong", label: "Lương (số, 1.234.567)" },
  { key: "Luong_chu", label: "Lương bằng chữ" },
  { key: "Don_vi", label: "Đầu mục" },
  { key: "Chuc_vu", label: "Chức vụ" },
  { key: "Phong_ban", label: "Phòng ban" },
] as const;

export type SalaryPlaceholderKey = (typeof SALARY_PLACEHOLDERS)[number]["key"];

/** Escape HTML cho mọi giá trị chèn vào thư — chống chèn script/HTML tuỳ ý. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

/** Chuẩn hoá họ tên để so khớp: thường, bỏ dấu, gộp khoảng trắng. */
export function normalizeName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type SalaryMailValues = Partial<Record<SalaryPlaceholderKey, string | null | undefined>>;

export type BuiltSalaryMail = {
  subject: string;
  /** Nội dung HTML an toàn: giá trị đã escape, xuống dòng giữ nguyên. */
  html: string;
  /** Tên vùng thiếu dữ liệu — có phần tử thì KHÔNG được gửi. */
  missing: string[];
};

function fillTemplate(template: string, values: SalaryMailValues, missing: string[]): string {
  return template.replace(/\{\{\s*([A-Za-z_]+)\s*\}\}/g, (raw, key: string) => {
    if (!SALARY_PLACEHOLDERS.some((p) => p.key === key)) return raw; // vùng lạ: giữ nguyên, không chặn
    const value = values[key as SalaryPlaceholderKey];
    if (value === null || value === undefined || value.trim() === "") {
      if (!missing.includes(key)) missing.push(key);
      return raw; // giữ nguyên vùng trong bản xem trước; server sẽ chặn gửi
    }
    return value;
  });
}

/** Dựng tiêu đề + nội dung thư từ mẫu. Giá trị chèn luôn được escape HTML. */
export function buildSalaryMail(subject: string, body: string, values: SalaryMailValues): BuiltSalaryMail {
  const missing: string[] = [];
  const filledSubject = fillTemplate(subject, values, missing);
  const filledBody = fillTemplate(body, values, missing);
  const html = escapeHtml(filledBody).replace(/\n/g, "<br>");
  return { subject: filledSubject, html, missing };
}

/** Giá trị vùng cho một nhân sự trong một kỳ lương. */
export function salaryMailValues(input: {
  fullName: string | null;
  period: string; // YYYY-MM
  amount: number | null;
  unitName: string | null;
  position: string | null;
  department: string | null;
}): SalaryMailValues {
  const [year, month] = input.period.split("-");
  return {
    Ten_NV: input.fullName,
    Thang: `${month}/${year}`,
    Nam: year,
    Luong: input.amount === null ? null : input.amount.toLocaleString("vi-VN"),
    Luong_chu: input.amount === null ? null : readVietnameseMoney(input.amount),
    Don_vi: input.unitName,
    Chuc_vu: input.position,
    Phong_ban: input.department,
  };
}

// ---------- Khớp dòng Excel ----------

export type ExcelSalaryRow = {
  cccd?: string | null;
  name?: string | null;
  amount: number | null;
  note?: string | null;
  email?: string | null;
};

export type EmployeeRef = { id: string; full_name: string | null; id_number: string | null };

export type ExcelMatchResult =
  | { kind: "matched"; employee: EmployeeRef }
  | { kind: "unmatched" }
  | { kind: "ambiguous"; candidates: EmployeeRef[] };

/** Khớp một dòng Excel với nhân sự: ưu tiên số CCCD, sau đó họ tên đã chuẩn hoá. */
export function matchExcelRow(row: ExcelSalaryRow, employees: EmployeeRef[]): ExcelMatchResult {
  const cccd = (row.cccd ?? "").replace(/\D/g, "");
  if (cccd) {
    const byId = employees.filter((e) => (e.id_number ?? "").replace(/\D/g, "") === cccd);
    if (byId.length === 1) return { kind: "matched", employee: byId[0]! };
    if (byId.length > 1) return { kind: "ambiguous", candidates: byId };
  }
  const name = normalizeName(row.name);
  if (!name) return { kind: "unmatched" };
  const byName = employees.filter((e) => normalizeName(e.full_name) === name);
  if (byName.length === 1) return { kind: "matched", employee: byName[0]! };
  if (byName.length > 1) return { kind: "ambiguous", candidates: byName };
  return { kind: "unmatched" };
}

// ---------- Trạng thái người nhận ----------

export type RecipientStatus = "ready" | "no_email" | "bad_email" | "no_salary" | "sent";

export const RECIPIENT_STATUS_LABEL: Record<RecipientStatus, string> = {
  ready: "Sẵn sàng",
  no_email: "Thiếu email",
  bad_email: "Email không hợp lệ",
  no_salary: "Thiếu lương kỳ này",
  sent: "Đã gửi kỳ này",
};

/** Trạng thái gửi của một nhân sự; chỉ "ready" mới được gửi. */
export function recipientStatus(input: {
  email: string | null | undefined;
  amount: number | null | undefined;
  sentReal: boolean;
  resend: boolean;
}): RecipientStatus {
  if (!input.email || !input.email.trim()) return "no_email";
  if (!isValidEmail(input.email)) return "bad_email";
  if (input.amount === null || input.amount === undefined) return "no_salary";
  if (input.sentReal && !input.resend) return "sent";
  return "ready";
}

/** Danh sách nhân sự thuộc các đầu mục đã chọn ("none" = chưa phân loại). */
export function employeesInUnits<T extends { unit_id: string | null }>(employees: T[], unitKeys: string[]): T[] {
  const set = new Set(unitKeys);
  return employees.filter((e) => (e.unit_id === null ? set.has("none") : set.has(e.unit_id)));
}

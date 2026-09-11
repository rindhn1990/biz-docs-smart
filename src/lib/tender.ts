import type { Tone } from "./domain";

/** Trạng thái của một bước trong hồ sơ gói thầu. */
export const STEP_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Chưa bắt đầu", tone: "neutral" },
  in_progress: { label: "Đang làm", tone: "info" },
  approved: { label: "Đã duyệt", tone: "success" },
};

export type StepStatus = "pending" | "in_progress" | "approved";

/** Vai trò của nhà thầu trong một gói thầu. */
export const CONTRACTOR_ROLES = [
  { value: "quote", label: "Nộp báo giá lập dự toán" },
  { value: "bid", label: "Nộp chào giá / hồ sơ dự thầu" },
  { value: "winner", label: "Trúng thầu" },
] as const;

export type ContractorRole = (typeof CONTRACTOR_ROLES)[number]["value"];

export function contractorRoleLabel(role: string) {
  return CONTRACTOR_ROLES.find((r) => r.value === role)?.label ?? role;
}

/** Các nhóm tệp nguồn được tải lên cho một gói thầu. */
export const SOURCE_CATEGORIES = [
  {
    value: "dkkd",
    label: "Giấy đăng ký kinh doanh",
    hint: "Máy đọc tự động tên doanh nghiệp, địa chỉ, mã số thuế, người đại diện, chức danh.",
    accept: ".pdf,.doc,.docx,.xls,.xlsx",
    ai: true,
  },
  {
    value: "bao_gia_du_toan",
    label: "Báo giá lập dự toán",
    hint: "Hỗ trợ tệp Word và Excel. Máy đọc bảng giá, không gửi sang trí tuệ nhân tạo.",
    accept: ".doc,.docx,.xls,.xlsx",
    ai: false,
  },
  {
    value: "gia_chao_thau",
    label: "Giá chào thầu",
    hint: "Hỗ trợ tệp Word và Excel. Dùng để đối chiếu giữa các nhà thầu dự thầu.",
    accept: ".doc,.docx,.xls,.xlsx",
    ai: false,
  },
  {
    value: "gia_trung_thau",
    label: "Giá trúng thầu",
    hint: "Số liệu sẽ được đưa vào phần dữ liệu chung của gói thầu.",
    accept: ".doc,.docx,.xls,.xlsx",
    ai: false,
  },
] as const;

export function sourceCategoryLabel(value: string) {
  return SOURCE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/** Dữ liệu chuẩn hoá dùng chung cho mọi văn bản của gói thầu. */
export const DATA_CENTER_GROUPS: {
  title: string;
  fields: { key: string; label: string; wide?: boolean }[];
}[] = [
  {
    title: "Thông tin gói thầu",
    fields: [
      { key: "ten_goi_thau", label: "Tên gói thầu", wide: true },
      { key: "gia_goi_thau", label: "Giá gói thầu (VNĐ)" },
      { key: "gia_bang_chu", label: "Giá gói thầu bằng chữ", wide: true },
      { key: "don_vi", label: "Đơn vị chủ trì" },
      { key: "nguon_von", label: "Nguồn vốn" },
      { key: "dia_diem", label: "Địa điểm thực hiện" },
      { key: "thoi_gian_thuc_hien", label: "Thời gian thực hiện" },
      { key: "loai_hop_dong", label: "Loại hợp đồng" },
    ],
  },
  {
    title: "Văn bản – chữ ký",
    fields: [
      { key: "so_van_ban_chu_truong", label: "Số văn bản chủ trương" },
      { key: "ngay_van_ban_chu_truong", label: "Ngày văn bản chủ trương" },
      { key: "so_hop_dong", label: "Số hợp đồng" },
      { key: "ngay_hop_dong", label: "Ngày ký hợp đồng" },
      { key: "nguoi_ky", label: "Người ký" },
      { key: "chuc_vu_nguoi_ky", label: "Chức vụ người ký" },
    ],
  },
];

export const DATA_CENTER_KEYS = DATA_CENTER_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

export function formatMoney(value: number | string | null | undefined) {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

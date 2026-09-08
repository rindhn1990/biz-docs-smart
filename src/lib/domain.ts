import { daysUntil } from "./format";

export type AppRole = "admin" | "manager" | "commercial" | "contract" | "payment" | "viewer";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Quản trị hệ thống",
  manager: "Quản lý",
  commercial: "Nhân viên thương mại",
  contract: "Nhân viên hợp đồng",
  payment: "Nhân viên thanh toán",
  viewer: "Chỉ xem",
};

export const TENDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  preparing: { label: "Đang chuẩn bị", tone: "info" },
  submitted: { label: "Đã nộp", tone: "neutral" },
  evaluating: { label: "Đang đánh giá", tone: "warning" },
  won: { label: "Trúng thầu", tone: "success" },
  lost: { label: "Không trúng", tone: "danger" },
  cancelled: { label: "Đã hủy", tone: "neutral" },
};

export const CONTRACT_STATUS: Record<string, { label: string; tone: Tone }> = {
  not_started: { label: "Chưa bắt đầu", tone: "neutral" },
  in_progress: { label: "Đang thực hiện", tone: "info" },
  expiring: { label: "Sắp hết hạn", tone: "warning" },
  expired: { label: "Đã hết hạn", tone: "danger" },
  completed: { label: "Đã hoàn thành", tone: "success" },
  liquidated: { label: "Đã thanh lý", tone: "neutral" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Nháp", tone: "neutral" },
  pending: { label: "Chờ duyệt", tone: "warning" },
  approved: { label: "Đã duyệt", tone: "info" },
  rejected: { label: "Từ chối", tone: "danger" },
  paid: { label: "Đã thanh toán", tone: "success" },
};

export const DOC_STATUS: Record<string, { label: string; tone: Tone }> = {
  new: { label: "Mới tải lên", tone: "neutral" },
  ocr_done: { label: "Đã nhận dạng", tone: "info" },
  extracted: { label: "Đã bóc tách", tone: "info" },
  pending_review: { label: "Chờ kiểm tra", tone: "warning" },
  approved: { label: "Đã xác nhận", tone: "success" },
  rejected: { label: "Bị từ chối", tone: "danger" },
  archived: { label: "Lưu trữ", tone: "neutral" },
};

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const DOC_FOLDERS = [
  "01_Ho_so_moi_thau",
  "02_Ho_so_du_thau",
  "03_Ket_qua",
  "04_Hop_dong",
  "05_Nghiem_thu",
  "06_Thanh_toan",
  "07_Thanh_ly",
] as const;

export const FOLDER_LABELS: Record<string, string> = {
  "01_Ho_so_moi_thau": "01 · Hồ sơ mời thầu",
  "02_Ho_so_du_thau": "02 · Hồ sơ dự thầu",
  "03_Ket_qua": "03 · Kết quả",
  "04_Hop_dong": "04 · Hợp đồng",
  "05_Nghiem_thu": "05 · Nghiệm thu",
  "06_Thanh_toan": "06 · Thanh toán",
  "07_Thanh_ly": "07 · Thanh lý",
};

export const ACCEPTED_MIME =
  ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/*";

export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Ngưỡng cảnh báo hạn hợp đồng (ngày) */
export const DEFAULT_ALERT_DAYS = [180, 90, 60, 30, 15, 7];

export function contractAlert(endDate: string | null | undefined, alertDays = DEFAULT_ALERT_DAYS) {
  const d = daysUntil(endDate);
  if (d === null) return null;
  if (d < 0) return { days: d, label: `Quá hạn ${Math.abs(d)} ngày`, tone: "danger" as Tone };
  const sorted = [...alertDays].sort((a, b) => a - b);
  const hit = sorted.find((t) => d <= t);
  if (hit === undefined) return { days: d, label: `Còn ${d} ngày`, tone: "neutral" as Tone };
  const tone: Tone = hit <= 15 ? "danger" : hit <= 60 ? "warning" : "info";
  return { days: d, label: `Còn ${d} ngày`, tone };
}

/** Danh sách trường dữ liệu chuẩn mà AI phải bóc tách */
export const EXTRACTION_FIELDS: {
  key: string;
  label: string;
  group: string;
  type: "text" | "number" | "date";
}[] = [
  { key: "tender_code", label: "Mã gói thầu", group: "Gói thầu", type: "text" },
  { key: "tender_name", label: "Tên gói thầu", group: "Gói thầu", type: "text" },
  { key: "project_name", label: "Tên dự án", group: "Gói thầu", type: "text" },
  { key: "investor", label: "Chủ đầu tư", group: "Gói thầu", type: "text" },
  { key: "procuring_entity", label: "Bên mời thầu", group: "Gói thầu", type: "text" },
  { key: "location", label: "Địa điểm", group: "Gói thầu", type: "text" },
  { key: "tender_type", label: "Loại gói thầu", group: "Gói thầu", type: "text" },
  { key: "funding_source", label: "Nguồn vốn", group: "Gói thầu", type: "text" },
  { key: "package_value", label: "Giá gói thầu", group: "Gói thầu", type: "number" },
  { key: "bid_value", label: "Giá dự thầu", group: "Gói thầu", type: "number" },
  { key: "won_value", label: "Giá trúng thầu", group: "Gói thầu", type: "number" },
  { key: "issue_date", label: "Ngày phát hành hồ sơ", group: "Gói thầu", type: "date" },
  { key: "submit_deadline", label: "Hạn nộp hồ sơ", group: "Gói thầu", type: "date" },
  { key: "open_date", label: "Ngày mở thầu", group: "Gói thầu", type: "date" },

  { key: "company_name", label: "Tên doanh nghiệp", group: "Nhà thầu", type: "text" },
  { key: "tax_code", label: "Mã số thuế", group: "Nhà thầu", type: "text" },
  { key: "company_address", label: "Địa chỉ", group: "Nhà thầu", type: "text" },
  { key: "representative", label: "Người đại diện", group: "Nhà thầu", type: "text" },
  { key: "representative_title", label: "Chức vụ", group: "Nhà thầu", type: "text" },
  { key: "phone", label: "Số điện thoại", group: "Nhà thầu", type: "text" },
  { key: "email", label: "Email", group: "Nhà thầu", type: "text" },
  { key: "bank_account", label: "Tài khoản ngân hàng", group: "Nhà thầu", type: "text" },

  { key: "contract_number", label: "Số hợp đồng", group: "Hợp đồng", type: "text" },
  { key: "sign_date", label: "Ngày ký", group: "Hợp đồng", type: "date" },
  { key: "start_date", label: "Ngày bắt đầu", group: "Hợp đồng", type: "date" },
  { key: "end_date", label: "Ngày kết thúc", group: "Hợp đồng", type: "date" },
  { key: "value_before_vat", label: "Giá trị trước VAT", group: "Hợp đồng", type: "number" },
  { key: "vat_rate", label: "Thuế suất VAT (%)", group: "Hợp đồng", type: "number" },
  { key: "contract_value", label: "Giá trị hợp đồng (sau VAT)", group: "Hợp đồng", type: "number" },
  { key: "duration", label: "Thời gian thực hiện", group: "Hợp đồng", type: "text" },
  { key: "payment_terms", label: "Điều khoản thanh toán", group: "Hợp đồng", type: "text" },
  { key: "guarantee_info", label: "Bảo lãnh", group: "Hợp đồng", type: "text" },
  { key: "advance_info", label: "Tạm ứng", group: "Hợp đồng", type: "text" },
  { key: "warranty_info", label: "Bảo hành", group: "Hợp đồng", type: "text" },
];

export type ExtractedField = {
  value: string | number | null;
  confidence: number | null;
  source_page: number | null;
  source_text?: string | null;
  needs_review?: boolean;
};

export type ExtractionPayload = {
  document_type?: { value: string | null; confidence: number | null };
  fields: Record<string, ExtractedField>;
};

export const PLACEHOLDER_MAP: Record<string, string> = {
  TEN_GOI_THAU: "tender_name",
  MA_GOI_THAU: "tender_code",
  TEN_DU_AN: "project_name",
  CHU_DAU_TU: "investor",
  BEN_MOI_THAU: "procuring_entity",
  DIA_DIEM: "location",
  GIA_GOI_THAU: "package_value",
  GIA_DU_THAU: "bid_value",
  GIA_TRUNG_THAU: "won_value",
  SO_HOP_DONG: "contract_number",
  NGAY_KY: "sign_date",
  NGAY_BAT_DAU: "start_date",
  NGAY_KET_THUC: "end_date",
  GIA_TRI_HOP_DONG: "contract_value",
  GIA_TRI_TRUOC_VAT: "value_before_vat",
  THOI_GIAN_THUC_HIEN: "duration",
  DIEU_KHOAN_THANH_TOAN: "payment_terms",
  NGUOI_PHU_TRACH: "assignee_name",
  TEN_KHACH_HANG: "customer_name",
  MA_SO_THUE: "tax_code",
  NGUOI_DAI_DIEN: "representative",
};

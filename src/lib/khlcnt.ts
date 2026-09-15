/**
 * Bộ trường dữ liệu chuẩn của hồ sơ đấu thầu, lấy theo bảng Data_input_column.
 * field_key trùng với placeholder trong mẫu Word thật (kiểu [[Ten_bien]]).
 * Mẫu nào không dùng đến trường nào thì trường đó để trống, nhưng bảng dữ liệu
 * của mọi hồ sơ luôn hiển thị đầy đủ các trường dưới đây.
 */
export const KHLCNT_DOC_TYPE = "to_trinh_khlcnt";

export const KHLCNT_GROUPS = [
  "Căn cứ",
  "Thông tin gói thầu",
  "KHLCNT",
  "Nhà thầu",
  "Thương thảo",
  "KQLCNT",
  "Khác",
] as const;

export type KhlcntGroup = (typeof KHLCNT_GROUPS)[number];

export type KhlcntField = {
  key: string;
  label: string;
  group: KhlcntGroup;
  value: string;
  conf: number;
};

/** Trường chưa có dữ liệu mẫu: để trống, độ tin cậy thấp để nhắc người dùng nhập tay. */
const BLANK = { value: "", conf: 0.3 };

export const KHLCNT_FIELDS: KhlcntField[] = [
  // Căn cứ
  { key: "Numb_CVCT", label: "Số công văn chủ trương", group: "Căn cứ", value: "13/KT", conf: 0.95 },
  {
    key: "Date_CVCT",
    label: "Ngày công văn chủ trương",
    group: "Căn cứ",
    value: "18/02/2025",
    conf: 0.93,
  },
  {
    key: "Numb_SOW",
    label: "Số Phạm vi công việc",
    group: "Căn cứ",
    value: "23/SOW.KVN.PVCV",
    conf: 0.88,
  },
  {
    key: "Date_SOW",
    label: "Ngày Phạm vi công việc",
    group: "Căn cứ",
    value: "23/5/2024",
    conf: 0.9,
  },
  {
    key: "Numb_DToan",
    label: "Số quyết định dự toán",
    group: "Căn cứ",
    value: "255/QĐ-KVN",
    conf: 0.94,
  },
  {
    key: "Date_DToan",
    label: "Ngày quyết định dự toán",
    group: "Căn cứ",
    value: "26/02/2025",
    conf: 0.91,
  },
  { key: "Numb_TCG", label: "Số văn bản TCG", group: "Căn cứ", ...BLANK },
  { key: "Date_TCG", label: "Ngày văn bản TCG", group: "Căn cứ", ...BLANK },

  // Thông tin gói thầu
  {
    key: "Ten_goi_thau",
    label: "Tên gói thầu",
    group: "Thông tin gói thầu",
    value:
      "Hỗ trợ kiểm tra và đối chiếu số liệu Báo cáo tài chính quốc tế (IFRS) tại Tổng công ty",
    conf: 0.97,
  },
  {
    key: "Gia_goi_thau_numb",
    label: "Giá gói thầu (số)",
    group: "Thông tin gói thầu",
    value: "486.000.000",
    conf: 0.96,
  },
  {
    key: "Gia_goi_thau_text",
    label: "Giá gói thầu (chữ)",
    group: "Thông tin gói thầu",
    value: "Bốn trăm tám mươi sáu triệu đồng",
    conf: 0.85,
  },
  {
    key: "Thue_VAT",
    label: "Thuế VAT",
    group: "Thông tin gói thầu",
    value: "đã bao gồm 8% VAT",
    conf: 0.9,
  },
  {
    key: "Nguon_von",
    label: "Nguồn vốn",
    group: "Thông tin gói thầu",
    value: "Chi phí sản xuất kinh doanh của Tổng công ty",
    conf: 0.92,
  },
  {
    key: "Hinh_thuc_LCNT",
    label: "Hình thức lựa chọn nhà thầu",
    group: "Thông tin gói thầu",
    value: "Chỉ định thầu rút gọn",
    conf: 0.93,
  },
  {
    key: "Time_start",
    label: "Thời gian bắt đầu tổ chức LCNT",
    group: "Thông tin gói thầu",
    value: "Tháng 03/2025",
    conf: 0.89,
  },
  {
    key: "Loai_HD",
    label: "Loại hợp đồng",
    group: "Thông tin gói thầu",
    value: "Trọn gói",
    conf: 0.9,
  },
  {
    key: "Duration_Contract",
    label: "Thời gian thực hiện hợp đồng",
    group: "Thông tin gói thầu",
    value: "365 ngày kể từ ngày hợp đồng có hiệu lực",
    conf: 0.87,
  },

  // KHLCNT
  {
    key: "Numb_totrinh_KH",
    label: "Số tờ trình KHLCNT",
    group: "KHLCNT",
    value: "47/TMĐT",
    conf: 0.96,
  },
  {
    key: "Date_totrinh_KH",
    label: "Ngày tờ trình KHLCNT",
    group: "KHLCNT",
    value: "17/3/2025",
    conf: 0.94,
  },
  {
    key: "Numb_thamdinh_KH",
    label: "Số văn bản thẩm định KHLCNT",
    group: "KHLCNT",
    value: "51/TMĐT",
    conf: 0.9,
  },
  {
    key: "Date_thamdinh_KH",
    label: "Ngày văn bản thẩm định KHLCNT",
    group: "KHLCNT",
    value: "18/3/2025",
    conf: 0.88,
  },
  {
    key: "Numb_QD_KH",
    label: "Số quyết định phê duyệt KHLCNT",
    group: "KHLCNT",
    value: "329/QĐ-KVN",
    conf: 0.93,
  },
  {
    key: "Date_QD_KH",
    label: "Ngày quyết định phê duyệt KHLCNT",
    group: "KHLCNT",
    value: "21/3/2025",
    conf: 0.9,
  },
  { key: "Num_tender", label: "Số hồ sơ mời thầu", group: "KHLCNT", ...BLANK },
  { key: "Date_tender", label: "Ngày hồ sơ mời thầu", group: "KHLCNT", ...BLANK },

  // Nhà thầu
  {
    key: "CV_moi_DPGKT",
    label: "Số công văn mời đàm phán giá (kỹ thuật)",
    group: "Nhà thầu",
    ...BLANK,
  },
  {
    key: "Date_CV_moi_DPGKT",
    label: "Ngày công văn mời đàm phán giá (kỹ thuật)",
    group: "Nhà thầu",
    ...BLANK,
  },
  { key: "Name_NT1", label: "Nhà thầu mời 1", group: "Nhà thầu", ...BLANK },
  { key: "Name_NT2", label: "Nhà thầu mời 2", group: "Nhà thầu", ...BLANK },
  { key: "Name_NT3", label: "Nhà thầu mời 3", group: "Nhà thầu", ...BLANK },
  {
    key: "CV_moi_DPGTT",
    label: "Số công văn mời đàm phán giá (trực tiếp)",
    group: "Nhà thầu",
    ...BLANK,
  },
  {
    key: "Date_CV_moi_DPGTT",
    label: "Ngày công văn mời đàm phán giá (trực tiếp)",
    group: "Nhà thầu",
    ...BLANK,
  },
  { key: "Name_NTDP1", label: "Nhà thầu đàm phán 1", group: "Nhà thầu", ...BLANK },
  { key: "Name_NTDP2", label: "Nhà thầu đàm phán 2", group: "Nhà thầu", ...BLANK },
  { key: "Name_NTDP3", label: "Nhà thầu đàm phán 3", group: "Nhà thầu", ...BLANK },
  {
    key: "CV_moi_TTHD",
    label: "Số công văn mời thương thảo HĐ",
    group: "Nhà thầu",
    value: "565/KVN-TMĐT",
    conf: 0.85,
  },
  {
    key: "Date_CV_moi_TTHD",
    label: "Ngày công văn mời thương thảo HĐ",
    group: "Nhà thầu",
    value: "21/3/2025",
    conf: 0.85,
  },

  // Thương thảo
  { key: "Numb_danhgia", label: "Số biên bản đánh giá", group: "Thương thảo", ...BLANK },
  { key: "Date_danhgia", label: "Ngày biên bản đánh giá", group: "Thương thảo", ...BLANK },
  { key: "Numb_DPG", label: "Số biên bản đàm phán giá", group: "Thương thảo", ...BLANK },
  { key: "Date_DPG", label: "Ngày biên bản đàm phán giá", group: "Thương thảo", ...BLANK },
  {
    key: "Numb_BBTT",
    label: "Số biên bản thương thảo HĐ",
    group: "Thương thảo",
    value: "94/BB-KVN",
    conf: 0.89,
  },
  {
    key: "Date_BBTT",
    label: "Ngày biên bản thương thảo HĐ",
    group: "Thương thảo",
    value: "26/3/2025",
    conf: 0.89,
  },

  // KQLCNT
  {
    key: "Numb_Totrinh_KQ",
    label: "Số tờ trình kết quả LCNT",
    group: "KQLCNT",
    value: "133/TMĐT",
    conf: 0.92,
  },
  {
    key: "Date_Totrinh_KQ",
    label: "Ngày tờ trình kết quả LCNT",
    group: "KQLCNT",
    value: "07/5/2025",
    conf: 0.9,
  },
  {
    key: "Numb_Thamdinh_KQ",
    label: "Số văn bản thẩm định kết quả LCNT",
    group: "KQLCNT",
    ...BLANK,
  },
  {
    key: "Date_Thamdinh_KQ",
    label: "Ngày văn bản thẩm định kết quả LCNT",
    group: "KQLCNT",
    ...BLANK,
  },
  {
    key: "NT_trungthau",
    label: "Tên nhà thầu trúng thầu",
    group: "KQLCNT",
    value: "Công ty TNHH PwC (Việt Nam)",
    conf: 0.97,
  },
  {
    key: "Gia_trungthau_numb",
    label: "Giá trúng thầu (số)",
    group: "KQLCNT",
    value: "480.000.000",
    conf: 0.95,
  },
  {
    key: "Gia_trungthau_text",
    label: "Giá trúng thầu (chữ)",
    group: "KQLCNT",
    value: "Bốn trăm tám mươi triệu đồng",
    conf: 0.83,
  },

  // Khác
  { key: "Ban_CM", label: "Ban chuyên môn", group: "Khác", value: "Ban Kế Toán", conf: 0.92 },
  { key: "Kyhieu_BanCM", label: "Ký hiệu ban chuyên môn", group: "Khác", value: "KT", conf: 0.9 },
  {
    key: "LD_CM",
    label: "Chức danh lãnh đạo ban chuyên môn",
    group: "Khác",
    value: "Trưởng",
    conf: 0.87,
  },
];

/** Thứ tự hiển thị của nhóm; nhóm lạ (do người dùng tự thêm) xếp cuối. */
export function groupOrder(group: string | null | undefined) {
  const i = KHLCNT_GROUPS.indexOf((group ?? "Khác") as KhlcntGroup);
  return i === -1 ? KHLCNT_GROUPS.length : i;
}

/** Tiêu đề nhóm có đánh số thứ tự: "1. Căn cứ". */
export function groupHeading(group: string | null | undefined, index: number) {
  return `${index + 1}. ${group ?? "Khác"}`;
}

export const KHLCNT_FIELD_KEYS = new Set(KHLCNT_FIELDS.map((f) => f.key));

/** Nhãn hiển thị các loại hồ sơ đấu thầu có thể tải lên. */
export const TENDER_DOC_TYPES: Record<string, { label: string; filePrefix: string }> = {
  ho_so_du_thau: { label: "Hồ sơ dự thầu", filePrefix: "Ho_so_du_thau" },
  [KHLCNT_DOC_TYPE]: { label: "Tờ trình KHLCNT", filePrefix: "To_trinh_KHLCNT" },
};

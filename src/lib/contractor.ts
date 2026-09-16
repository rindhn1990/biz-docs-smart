/** Các trường thông tin nhà thầu có thể quét tự động từ PDF, ảnh chụp hoặc file Word. */
export const CONTRACTOR_SCAN_FIELDS = [
  { key: "name", label: "Tên đơn vị / nhà thầu (tên đầy đủ theo giấy tờ)" },
  { key: "tax_code", label: "Mã số thuế" },
  { key: "address", label: "Địa chỉ trụ sở" },
  { key: "representative", label: "Người đại diện theo pháp luật" },
  { key: "representative_title", label: "Chức danh người đại diện" },
  { key: "phone", label: "Số điện thoại" },
  { key: "email", label: "Địa chỉ email" },
  { key: "bank_account", label: "Số tài khoản ngân hàng" },
  { key: "bank_name", label: "Tên ngân hàng và chi nhánh" },
] as const;

export type ContractorScanKey = (typeof CONTRACTOR_SCAN_FIELDS)[number]["key"];

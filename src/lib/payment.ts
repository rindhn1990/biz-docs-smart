/** Trường nguồn dùng cho kho mẫu văn bản Thanh toán (lấy từ thông tin nhà thầu + hợp đồng). */
export const PAYMENT_TEMPLATE_FIELDS = [
  { key: "NT_ten", label: "Nhà thầu — Tên đơn vị", group: "Nhà thầu" },
  { key: "NT_mst", label: "Nhà thầu — Mã số thuế", group: "Nhà thầu" },
  { key: "NT_diachi", label: "Nhà thầu — Địa chỉ", group: "Nhà thầu" },
  { key: "NT_daidien", label: "Nhà thầu — Người đại diện", group: "Nhà thầu" },
  { key: "NT_chucdanh", label: "Nhà thầu — Chức danh đại diện", group: "Nhà thầu" },
  { key: "NT_dienthoai", label: "Nhà thầu — Điện thoại", group: "Nhà thầu" },
  { key: "NT_email", label: "Nhà thầu — Email", group: "Nhà thầu" },
  { key: "NT_taikhoan", label: "Nhà thầu — Số tài khoản", group: "Nhà thầu" },
  { key: "NT_nganhang", label: "Nhà thầu — Ngân hàng", group: "Nhà thầu" },
  { key: "HD_so", label: "Hợp đồng — Số hợp đồng", group: "Hợp đồng" },
  { key: "HD_ngay", label: "Hợp đồng — Ngày ký", group: "Hợp đồng" },
  { key: "HD_giatri", label: "Hợp đồng — Tổng giá trị", group: "Hợp đồng" },
  { key: "TT_dot", label: "Thanh toán — Đợt số", group: "Thanh toán" },
  { key: "TT_noidung", label: "Thanh toán — Nội dung", group: "Thanh toán" },
  { key: "TT_sotien", label: "Thanh toán — Số tiền (số)", group: "Thanh toán" },
  { key: "TT_sotien_chu", label: "Thanh toán — Số tiền (chữ)", group: "Thanh toán" },
  { key: "TT_vat", label: "Thanh toán — Thuế VAT (%)", group: "Thanh toán" },
  { key: "TT_tongtien", label: "Thanh toán — Tổng cộng (số)", group: "Thanh toán" },
  { key: "TT_ngay", label: "Thanh toán — Ngày đề nghị", group: "Thanh toán" },
  { key: "TT_hanthanhtoan", label: "Thanh toán — Hạn thanh toán", group: "Thanh toán" },
] as const;

export type PaymentTemplateField = (typeof PAYMENT_TEMPLATE_FIELDS)[number];

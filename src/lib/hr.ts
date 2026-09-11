export type EmployeeDocType = "quyet_dinh_bo_nhiem" | "cccd" | "bang_cap";

export const HR_TEMPLATE_FIELDS = [
  { key: "full_name", label: "Họ và tên" },
  { key: "date_of_birth", label: "Ngày sinh" },
  { key: "id_number", label: "Số CCCD" },
  { key: "id_issue_date", label: "Ngày cấp CCCD" },
  { key: "id_issue_place", label: "Nơi cấp CCCD" },
  { key: "hometown", label: "Quê quán" },
  { key: "position", label: "Chức vụ" },
  { key: "department", label: "Phòng ban" },
  { key: "contract_number", label: "Số hợp đồng" },
  { key: "contract_type", label: "Loại hợp đồng" },
  { key: "start_date", label: "Ngày bắt đầu" },
  { key: "end_date", label: "Ngày kết thúc" },
  { key: "base_salary", label: "Lương cơ bản" },
  { key: "degree_name", label: "Tên bằng cấp" },
  { key: "degree_major", label: "Chuyên ngành" },
  { key: "degree_school", label: "Trường cấp bằng" },
] as const;

export const EMPLOYEE_DOC_TYPES: Record<
  EmployeeDocType,
  { label: string; filePrefix: string; scan: boolean }
> = {
  quyet_dinh_bo_nhiem: {
    label: "Quyết định bổ nhiệm",
    filePrefix: "QD_Bo_nhiem",
    scan: false,
  },
  cccd: { label: "Căn cước công dân", filePrefix: "CCCD", scan: true },
  bang_cap: { label: "Bằng cấp", filePrefix: "Bang_cap", scan: true },
};

export const EMPLOYEE_CONTRACT_STATUS: Record<string, { label: string; tone: "info" | "danger" | "success" }> = {
  active: { label: "Đang hiệu lực", tone: "info" },
  expired: { label: "Đã hết hạn", tone: "danger" },
  completed: { label: "Đã hoàn thành", tone: "success" },
};

type SampleField = { key: string; label: string; value: string; conf: number };

export const EMPLOYEE_SAMPLE_FIELDS: Record<EmployeeDocType, SampleField[]> = {
  quyet_dinh_bo_nhiem: [
    { key: "full_name", label: "Họ và tên", value: "Nguyễn Thị Thanh Huyền", conf: 0.97 },
    {
      key: "position",
      label: "Chức vụ được bổ nhiệm",
      value: "Phó Trưởng phòng Kinh doanh",
      conf: 0.94,
    },
    { key: "department", label: "Phòng ban", value: "Phòng Kinh doanh", conf: 0.92 },
    { key: "decision_date", label: "Ngày quyết định", value: "10/02/2026", conf: 0.89 },
    { key: "decision_number", label: "Số quyết định", value: "", conf: 0.62 },
  ],
  cccd: [
    { key: "full_name", label: "Họ và tên", value: "Bùi Đức Thắng", conf: 0.98 },
    { key: "id_number", label: "Số CCCD", value: "001091005678", conf: 0.96 },
    { key: "date_of_birth", label: "Ngày sinh", value: "07/09/1991", conf: 0.93 },
    { key: "hometown", label: "Quê quán", value: "Xã Quảng Phú, huyện Lương Tài, tỉnh Bắc Ninh", conf: 0.87 },
    { key: "id_issue_date", label: "Ngày cấp", value: "22/06/2021", conf: 0.9 },
    { key: "id_issue_place", label: "Nơi cấp", value: "", conf: 0.55 },
  ],
  bang_cap: [
    { key: "full_name", label: "Họ và tên", value: "Ngô Thanh Tùng", conf: 0.96 },
    { key: "degree_name", label: "Tên bằng cấp", value: "Kỹ sư", conf: 0.94 },
    { key: "degree_major", label: "Chuyên ngành", value: "Cơ khí chế tạo máy", conf: 0.91 },
    {
      key: "degree_school",
      label: "Trường cấp bằng",
      value: "Đại học Công nghiệp Hà Nội",
      conf: 0.88,
    },
    { key: "degree_issue_date", label: "Ngày cấp", value: "", conf: 0.71 },
  ],
};

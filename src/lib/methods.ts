/** 5 hình thức lựa chọn nhà thầu dùng để phân loại mẫu văn bản. */
export const TENDER_METHODS = [
  { value: "chi_dinh_thau_rut_gon", label: "Chỉ định thầu rút gọn" },
  { value: "dam_phan_truc_tiep", label: "Đàm phán trực tiếp" },
  { value: "chao_hang_canh_tranh_rut_gon", label: "Chào hàng cạnh tranh rút gọn" },
  { value: "chao_hang_canh_tranh_thong_thuong", label: "Chào hàng cạnh tranh thông thường" },
  { value: "dau_thau_rong_rai_2_tui", label: "Đấu thầu rộng rãi 2 túi" },
] as const;

export type TenderMethod = (typeof TENDER_METHODS)[number]["value"];

export const DEFAULT_METHOD: TenderMethod = "chi_dinh_thau_rut_gon";

export function methodLabel(value: string | null | undefined) {
  return TENDER_METHODS.find((m) => m.value === value)?.label ?? "Chưa phân loại";
}

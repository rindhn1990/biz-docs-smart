import { supabase } from "@/integrations/supabase/client";
import { methodLabel, TENDER_METHODS } from "@/lib/methods";
import { formatThousands, readVietnameseMoney } from "@/lib/money";

/**
 * Bảng ánh xạ trường dùng chung giữa gói thầu và hồ sơ đấu thầu.
 * Đồng bộ hai chiều do các trigger trong CSDL thực hiện (sync_doc_field_to_tender,
 * sync_tender_to_docs, sync_tender_data_to_docs) — bảng này phải khớp với các trigger đó.
 *
 *   field_key hồ sơ     | cột bảng tenders | khoá tender_data
 *   Ten_goi_thau        | name             | ten_goi_thau
 *   Gia_goi_thau_numb   | package_value    | gia_goi_thau
 *   Gia_goi_thau_text   | (sinh từ số)     | gia_bang_chu
 *   Nguon_von           | funding_source   | nguon_von
 *   Hinh_thuc_LCNT      | method (nhãn)    | —
 *
 * Mã gói thầu và địa điểm chưa có trường tương ứng trong bộ trường KHLCNT nên không đồng bộ vào hồ sơ.
 */
export const TENDER_SHARED_FIELDS = [
  { fieldKey: "Ten_goi_thau", tenderCol: "name", dataKey: "ten_goi_thau" },
  { fieldKey: "Gia_goi_thau_numb", tenderCol: "package_value", dataKey: "gia_goi_thau" },
  { fieldKey: "Gia_goi_thau_text", tenderCol: null, dataKey: "gia_bang_chu" },
  { fieldKey: "Nguon_von", tenderCol: "funding_source", dataKey: "nguon_von" },
  { fieldKey: "Hinh_thuc_LCNT", tenderCol: "method", dataKey: null },
] as const;

export const TENDER_SHARED_KEYS = new Set<string>(TENDER_SHARED_FIELDS.map((f) => f.fieldKey));

/** Lấy giá trị các trường dùng chung từ gói thầu (ưu tiên dữ liệu chung, rồi cột của gói). */
export async function loadTenderSharedValues(tenderId: string): Promise<Record<string, string>> {
  const [t, d] = await Promise.all([
    supabase
      .from("tenders")
      .select("name,package_value,funding_source,method")
      .eq("id", tenderId)
      .maybeSingle(),
    supabase.from("tender_data").select("data").eq("tender_id", tenderId).maybeSingle(),
  ]);
  const data = (d.data?.data ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
  const out: Record<string, string> = {};
  const name = str(data["ten_goi_thau"]) || str(t.data?.name);
  if (name) out["Ten_goi_thau"] = name;
  const money = formatThousands(str(data["gia_goi_thau"]) || str(t.data?.package_value));
  if (money) {
    out["Gia_goi_thau_numb"] = money;
    out["Gia_goi_thau_text"] = readVietnameseMoney(money);
  }
  const fund = str(data["nguon_von"]) || str(t.data?.funding_source);
  if (fund) out["Nguon_von"] = fund;
  if (t.data?.method && TENDER_METHODS.some((m) => m.value === t.data?.method)) {
    out["Hinh_thuc_LCNT"] = methodLabel(t.data.method);
  }
  return out;
}

/** Làm mới mọi màn hình gói thầu/hồ sơ sau khi một trường dùng chung đổi giá trị. */
export function invalidateTenderSharedQueries(queryClient: {
  invalidateQueries: (o: { queryKey: string[] }) => Promise<unknown>;
}) {
  for (const k of ["tender_case", "tender_cases", "tenders", "tender_data", "documents"])
    void queryClient.invalidateQueries({ queryKey: [k] });
}

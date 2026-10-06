import { useEffect, useState } from "react";
import { useTenders } from "@/hooks/useData";

const KEY = "ho-so-dau-thau:tender";
export const ALL_TENDERS = "all";
export const NO_TENDER = "none";

/** Gói thầu đang xem, dùng chung cho 3 tab Hồ sơ / Dữ liệu / Báo cáo (nhớ lần chọn gần nhất). */
export function useTenderFilter() {
  const [value, setValue] = useState<string>(ALL_TENDERS);
  useEffect(() => {
    const saved = window.localStorage.getItem(KEY);
    if (saved) setValue(saved);
  }, []);
  const update = (v: string) => {
    setValue(v);
    window.localStorage.setItem(KEY, v);
  };
  return [value, update] as const;
}

/** Áp bộ lọc gói thầu vào danh sách có cột tender_id. */
export function filterByTender<T extends { tender_id: string | null }>(rows: T[], value: string) {
  if (value === ALL_TENDERS) return rows;
  if (value === NO_TENDER) return rows.filter((r) => !r.tender_id);
  return rows.filter((r) => r.tender_id === value);
}

export function TenderSelect({
  value,
  onChange,
  includeAll = true,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  includeAll?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const tenders = useTenders();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "max-w-[280px] rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
      }
    >
      {includeAll ? (
        <>
          <option value={ALL_TENDERS}>Tất cả gói thầu</option>
          <option value={NO_TENDER}>Chưa gán gói thầu</option>
        </>
      ) : (
        <option value="">{placeholder ?? "— Chọn gói thầu —"}</option>
      )}
      {(tenders.data ?? []).map((t) => (
        <option key={t.id} value={t.id}>
          {t.code ? `${t.code} · ` : ""}
          {t.name}
        </option>
      ))}
    </select>
  );
}

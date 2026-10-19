import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHrCounts, useHrUnits } from "@/hooks/useHrUnits";

export function HrUnitSelect({ value, onChange, filter = false, disabled = false, label = "Đầu mục" }: {
  value: string; onChange: (value: string) => void; filter?: boolean; disabled?: boolean; label?: string;
}) {
  const units = useHrUnits();
  const counts = useHrCounts();
  return <Select value={value || (filter ? "all" : "none")} onValueChange={(v) => onChange(v === "all" ? "" : v)} disabled={disabled}>
    <SelectTrigger aria-label={label} className="min-w-[180px] max-w-[280px]"><SelectValue /></SelectTrigger>
    <SelectContent>
      {filter && <SelectItem value="all">Tất cả đầu mục ({counts.data?.all ?? 0})</SelectItem>}
      <SelectItem value="none">Chưa phân loại{filter ? ` (${counts.data?.none ?? 0})` : ""}</SelectItem>
      {(units.data ?? []).map((u) => u.id && <SelectItem key={u.id} value={u.id}>{u.name}{filter ? ` (${u.employee_count ?? 0})` : ""}</SelectItem>)}
    </SelectContent>
  </Select>;
}
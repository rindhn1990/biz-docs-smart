import { formatDateVariant } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const options = [
  ["slash", "31/01/2026"],
  ["vn_full", "ngày 31 tháng 01 năm 2026"],
  ["vn_full_short", "ngày 31 tháng 1 năm 2026"],
  ["vn_no_prefix", "31 tháng 01 năm 2026"],
] as const;

export function DateFormatSelect({ value, onChange, disabled, name = "" }: { value?: string | null; onChange: (value: string | null) => void; disabled?: boolean; name?: string }) {
  return <div className="min-w-[220px] space-y-1">
    <Select value={value ?? "default"} onValueChange={(next) => onChange(next === "default" ? null : next)} disabled={disabled}>
      <SelectTrigger aria-label={`Kiểu ngày${name ? ` · ${name}` : ""}`}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="default">Mặc định · dd/mm/yyyy</SelectItem>
        {options.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
      </SelectContent>
    </Select>
    <p className="text-xs font-normal text-muted-foreground">31/01/2026 → {formatDateVariant("31/01/2026", value)}</p>
  </div>;
}
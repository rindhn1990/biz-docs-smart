import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Nhận biết trường ngày tháng theo mã trường hoặc nhãn hiển thị. */
export function isDateField(key: string, label?: string) {
  return /^date_/i.test(key) || /_date$/i.test(key) || /^ngày\b/i.test((label ?? "").trim());
}

/** Chuỗi "dd/mm/yyyy" → Date; chấp nhận cả "d/m/yyyy". */
export function parseVnDate(value: string | null | undefined): Date | undefined {
  const m = /^\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s*$/.exec(value ?? "");
  if (!m) return undefined;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Date → "dd/mm/yyyy". */
export function formatVnDate(date: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * Ô chọn ngày/tháng/năm bằng lịch, hiển thị và lưu theo định dạng dd/mm/yyyy.
 */
export function DateField({
  id,
  value,
  onChange,
  readOnly,
  className,
  placeholder = "Chọn ngày…",
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseVnDate(value);

  return (
    <Popover open={open} onOpenChange={(o) => !readOnly && setOpen(o)}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={readOnly}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 py-1.5 text-left text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:bg-muted",
            !value && "text-muted-foreground",
            className,
          )}
        >
          {value || placeholder}
          <CalendarIcon className="size-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={new Date(2000, 0)}
          endMonth={new Date(2100, 11)}
          defaultMonth={selected ?? new Date()}
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            onChange(formatVnDate(d));
            setOpen(false);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        {value ? (
          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              Xoá ngày đã chọn
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

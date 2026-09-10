import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const DOC_STEPS = [
  { key: "new", label: "Mới tạo" },
  { key: "ocr_done", label: "Đã OCR" },
  { key: "extracted", label: "Đã trích xuất dữ liệu" },
  { key: "pending_review", label: "Chờ kiểm tra" },
  { key: "approved", label: "Đã xác nhận" },
] as const;

export function stepIndex(status: string | null | undefined) {
  const i = DOC_STEPS.findIndex((s) => s.key === status);
  if (i >= 0) return i;
  if (status === "rejected") return 3;
  if (status === "archived") return 4;
  return 0;
}

export function DocStepper({
  status,
  compact = false,
}: {
  status: string | null | undefined;
  compact?: boolean;
}) {
  const current = stepIndex(status);

  return (
    <ol className="flex items-center gap-1">
      {DOC_STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.key} className="flex items-center gap-1">
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold transition-colors",
                done && "border-success bg-success text-white",
                active && "border-primary bg-primary text-primary-foreground",
                !done && !active && "border-border bg-muted text-muted-foreground",
              )}
              title={step.label}
            >
              {done ? <Check className="size-3" /> : i + 1}
            </span>
            {!compact ? (
              <span
                className={cn(
                  "hidden whitespace-nowrap text-[11px] xl:inline",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            ) : null}
            {i < DOC_STEPS.length - 1 ? (
              <span
                className={cn("h-px w-4 shrink-0", i < current ? "bg-success" : "bg-border")}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

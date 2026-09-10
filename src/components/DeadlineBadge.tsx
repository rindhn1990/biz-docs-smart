import { daysUntil } from "@/lib/format";

/** Mức cảnh báo theo số ngày còn lại tới ngày kết thúc hợp đồng. */
export function deadlineLevel(endDate: string | null | undefined, status?: string | null) {
  if (status === "completed" || status === "liquidated") {
    return { key: "done", label: "Đã hoàn thành", days: null as number | null };
  }
  const d = daysUntil(endDate);
  if (d === null) return { key: "none", label: "Chưa có hạn", days: null as number | null };
  if (d < 0) return { key: "overdue", label: "Đã quá hạn", days: d };
  if (d <= 7) return { key: "d7", label: `Còn ${d} ngày`, days: d };
  if (d <= 15) return { key: "d15", label: `Còn ${d} ngày`, days: d };
  if (d <= 30) return { key: "d30", label: `Còn ${d} ngày`, days: d };
  if (d <= 60) return { key: "d60", label: `Còn ${d} ngày`, days: d };
  if (d <= 90) return { key: "d90", label: `Còn ${d} ngày`, days: d };
  return { key: "far", label: `Còn ${d} ngày`, days: d };
}

const levelClass: Record<string, string> = {
  overdue: "border-destructive/40 bg-destructive/12 text-destructive",
  d7: "border-destructive/40 bg-destructive/12 text-destructive",
  d15: "border-warning/60 bg-warning/25 text-warning-foreground",
  d30: "border-warning/45 bg-warning/18 text-warning-foreground",
  d60: "border-warning/30 bg-warning/10 text-warning-foreground",
  d90: "border-primary/30 bg-primary/10 text-primary",
  far: "border-border bg-muted text-muted-foreground",
  done: "border-border bg-muted text-muted-foreground",
  none: "border-border bg-muted text-muted-foreground",
};

export function DeadlineBadge({
  endDate,
  status,
}: {
  endDate: string | null | undefined;
  status?: string | null;
}) {
  const level = deadlineLevel(endDate, status);
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium ${levelClass[level.key]}`}
    >
      {level.label}
    </span>
  );
}

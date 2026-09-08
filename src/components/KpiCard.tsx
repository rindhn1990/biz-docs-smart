import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const toneRing: Record<string, string> = {
    default: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning-foreground bg-warning/20",
    danger: "text-destructive bg-destructive/10",
    info: "text-info bg-info/10",
  };
  return (
    <div className="panel flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="num mt-1.5 text-2xl font-semibold text-foreground">{value}</p>
        {sub ? <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p> : null}
      </div>
      {Icon ? (
        <span className={cn("rounded-lg p-2", toneRing[tone])}>
          <Icon className="size-5" />
        </span>
      ) : null}
    </div>
  );
}

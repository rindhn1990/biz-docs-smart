import { Link, useRouterState } from "@tanstack/react-router";
import { Gavel, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export const MODULE_TABS = [
  { key: "dau-thau", label: "Đấu thầu", to: "/tong-quan", icon: Gavel },
  { key: "nhan-su", label: "Hợp đồng nhân sự", to: "/nhan-su", icon: Users },
] as const;

export function currentModule(pathname: string, module?: unknown): "dau-thau" | "nhan-su" {
  return pathname.startsWith("/nhan-su") || module === "hr" ? "nhan-su" : "dau-thau";
}

export function ModuleTabs({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = currentModule(pathname);

  return (
    <div
      role="tablist"
      aria-label="Phân hệ"
      className={cn("mb-6 inline-flex gap-1 rounded-lg border border-border bg-card p-1", className)}
    >
      {MODULE_TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            to={tab.to}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

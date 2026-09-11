import { Link, useRouterState } from "@tanstack/react-router";
import { ListChecks, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/ho-so-dau-thau", label: "Danh sách hồ sơ", icon: ListChecks },
  { to: "/ho-so-dau-thau/bao-cao", label: "Báo cáo", icon: BarChart3 },
] as const;

/** Dải tab con của phân hệ Hồ sơ đấu thầu. */
export function DocsTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div
      role="tablist"
      aria-label="Hồ sơ đấu thầu"
      className="mb-4 inline-flex gap-1 rounded-lg border border-border bg-card p-1"
    >
      {TABS.map((tab) => {
        const active =
          tab.to === "/ho-so-dau-thau"
            ? pathname === "/ho-so-dau-thau" || pathname === "/ho-so-dau-thau/"
            : pathname.startsWith(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
              active
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

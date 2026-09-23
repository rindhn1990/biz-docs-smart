import { Link, useRouterState } from "@tanstack/react-router";
import { Gavel, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export const MODULE_TABS = [
  { key: "dau-thau", label: "Đấu thầu", to: "/tong-quan", icon: Gavel },
  { key: "nhan-su", label: "Hợp đồng nhân sự", to: "/nhan-su", icon: Users },
] as const;

export function currentModule(pathname: string, module?: unknown): "dau-thau" | "nhan-su" {
  return pathname.startsWith("/nhan-su") || module === "hr" ? "nhan-su" : "dau-thau";
}

/** Chỉ giữ lại phân hệ mà tài khoản được cấp quyền sử dụng. */
export function allowedModuleTabs(canTender: boolean, canHr: boolean) {
  return MODULE_TABS.filter((t) => (t.key === "dau-thau" ? canTender : canHr));
}

/** Các đường dẫn thuộc phân hệ Đấu thầu (ngoài /nhan-su là phân hệ nhân sự). */
export const TENDER_PATHS = [
  "/tong-quan",
  "/goi-thau",
  "/ho-so-dau-thau",
  "/nha-thau",
  "/hop-dong",
  "/thanh-toan",
  "/lich-su-xuat",
  "/quy-trinh",
];

export function ModuleTabs({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = currentModule(pathname);
  const { canTender, canHr } = useAuth();
  const tabs = allowedModuleTabs(canTender, canHr);
  if (tabs.length < 2) return null;

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

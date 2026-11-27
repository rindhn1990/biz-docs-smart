import { Link } from "@tanstack/react-router";
import { Gavel } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { ScrollTabs } from "@/components/ScrollTabs";

export const MODULE_TABS = [
  { key: "dau-thau", label: "Đấu thầu", to: "/tong-quan", icon: Gavel },
] as const;

/** App_TMDT chỉ còn phân hệ Đấu thầu. */
export function allowedModuleTabs(canTender: boolean) {
  return canTender ? MODULE_TABS : [];
}

export const TENDER_PATHS = [
  "/tong-quan",
  "/goi-thau",
  "/ho-so-dau-thau",
  "/nha-thau",
  "/hop-dong",
  "/thanh-toan",
  "/thong-bao",
  "/lich-su-xuat",
  "/quy-trinh",
];

export function ModuleTabs({ className }: { className?: string }) {
  const { canTender } = useAuth();
  const tabs = allowedModuleTabs(canTender);
  if (tabs.length < 2) return null;

  return (
    <ScrollTabs
      role="tablist"
      aria-label="Phân hệ"
      className={cn("mb-6 inline-flex gap-1 rounded-lg border border-border bg-card p-1", className)}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          to={tab.to}
          role="tab"
          aria-selected={true}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground"
        >
          <tab.icon className="size-4" />
          {tab.label}
        </Link>
      ))}
    </ScrollTabs>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  LayoutDashboard,
  Gavel,
  FileSignature,
  Wallet,
  FolderOpen,
  BarChart3,
  Settings,
  FileStack,
  CalendarDays,
  FileText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: React.ElementType };

const groups: { title: string; items: Item[] }[] = [
  {
    title: "Tổng quan",
    items: [{ to: "/tong-quan", label: "Bảng điều khiển", icon: LayoutDashboard }],
  },
  {
    title: "Thương mại – Đấu thầu",
    items: [
      { to: "/dau-thau", label: "Dashboard đấu thầu", icon: BarChart3 },
      { to: "/ho-so", label: "Hồ sơ đấu thầu", icon: FileStack },
      { to: "/goi-thau", label: "Gói thầu", icon: Gavel },
      { to: "/hop-dong", label: "Hợp đồng", icon: FileSignature },
      { to: "/lich-hop-dong", label: "Lịch hợp đồng", icon: CalendarDays },
      { to: "/thanh-toan", label: "Thanh toán", icon: Wallet },
    ],
  },
  {
    title: "Văn phòng",
    items: [
      { to: "/tai-lieu", label: "Tài liệu", icon: FolderOpen },
      { to: "/bieu-mau", label: "Biểu mẫu", icon: FileText },
      { to: "/tro-ly", label: "Trợ lý AI", icon: Sparkles },
      { to: "/bao-cao", label: "Báo cáo", icon: BarChart3 },
      { to: "/cai-dat", label: "Cài đặt", icon: Settings },
    ],
  },
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <Link
        to="/tong-quan"
        onClick={onNavigate}
        className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4"
      >
        <span className="grid size-8 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Building2 className="size-4" />
        </span>
        <span className="font-display text-base font-semibold">OfficeFlow</span>
      </Link>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

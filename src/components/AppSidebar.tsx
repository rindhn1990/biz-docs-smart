import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  LayoutDashboard,
  FileStack,
  FileText,
  FileSignature,
  ScrollText,
  BarChart3,
  FolderOpen,
  Settings,
  Lock,
  Users,
  
  IdCard,
  ShieldCheck,
  Workflow,
  Handshake,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { MODULE_TABS, currentModule } from "@/components/ModuleTabs";

type ActiveItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  locked?: false;
  search?: { module: "tender" | "hr" };
};
type LockedItem = { label: string; icon: React.ElementType; locked: true };
type Item = ActiveItem | LockedItem;

const lockedGroup: { title: string; items: Item[] } = {
  title: "Sắp mở rộng",
  items: [
    { label: "Văn bản – Hồ sơ", icon: ScrollText, locked: true },
    { label: "Báo cáo – Thống kê", icon: BarChart3, locked: true },
    { label: "Quản lý tài liệu", icon: FolderOpen, locked: true },
    { label: "Cài đặt hệ thống", icon: Settings, locked: true },
  ],
};

const tenderGroups: { title: string; items: Item[] }[] = [
  {
    title: "MVP – Giai đoạn 1",
    items: [
      { to: "/tong-quan", label: "Tổng quan", icon: LayoutDashboard },
      { to: "/goi-thau", label: "Gói thầu", icon: Workflow },
      { to: "/ho-so-dau-thau", label: "Hồ sơ đấu thầu", icon: FileStack },

      { to: "/nha-thau", label: "Nhà thầu", icon: Handshake },
      { to: "/mau-van-ban", label: "Mẫu văn bản", icon: FileText, search: { module: "tender" } },
      { to: "/hop-dong", label: "Hợp đồng", icon: FileSignature },
      { to: "/thanh-toan", label: "Thanh toán", icon: Receipt },
    ],
  },
  lockedGroup,
];

const hrGroups: { title: string; items: Item[] }[] = [
  {
    title: "Hợp đồng nhân sự",
    items: [
      { to: "/nhan-su", label: "Hồ sơ nhân sự", icon: IdCard },
      { to: "/nhan-su/hop-dong", label: "Hợp đồng nhân sự", icon: Users },
      { to: "/mau-van-ban", label: "Mẫu văn bản", icon: FileText, search: { module: "hr" } },
    ],
  },
  lockedGroup,
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useRouterState({ select: (s) => s.location });
  const pathname = location.pathname;
  const activeModule = currentModule(pathname, (location.search as { module?: unknown }).module);
  const { isAdmin } = useAuth();
  const baseGroups = activeModule === "nhan-su" ? hrGroups : tenderGroups;
  const groups = isAdmin
    ? [
        ...baseGroups,
        {
          title: "Quản trị",
          items: [
            { to: "/quy-trinh", label: "Quy trình mẫu", icon: Workflow },
            { to: "/quan-tri", label: "Phân quyền người dùng", icon: ShieldCheck },
          ] as Item[],
        },
      ]
    : baseGroups;

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

      <div className="border-b border-sidebar-border px-3 py-3">
        <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
          Phân hệ
        </p>
        <div className="grid gap-1">
          {MODULE_TABS.map((tab) => (
            <Link
              key={tab.key}
              to={tab.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                tab.key === activeModule
                  ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <tab.icon className="size-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                if (item.locked) {
                  return (
                    <li key={item.label}>
                      <span
                        aria-disabled="true"
                        className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground/40"
                      >
                        <item.icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                        <span className="ml-auto inline-flex items-center gap-1 rounded border border-sidebar-border px-1.5 py-0.5 text-[10px] text-sidebar-foreground/45">
                          <Lock className="size-2.5" />
                          Sắp mở rộng
                        </span>
                      </span>
                    </li>
                  );
                }
                const active =
                  item.to === "/nhan-su"
                    ? pathname === "/nhan-su" || /^\/nhan-su\/(?!hop-dong$)/.test(pathname)
                    : pathname === item.to || pathname.startsWith(`${item.to}/`);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      search={item.search ? { module: item.search.module } : {}}
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

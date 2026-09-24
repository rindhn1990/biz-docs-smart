import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert, Clock, Loader2, LogOut, Menu, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { ReminderBanner } from "@/components/ReminderBanner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/domain";
import { TENDER_PATHS } from "@/components/ModuleTabs";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { loading, session, profile, roles, isActive, signOut, canTender, canHr } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      void navigate({ to: "/auth", search: { next: pathname } });
    }
  }, [loading, session, navigate, pathname]);

  if (loading || !session || !profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="panel max-w-md space-y-4 p-6 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
            <Clock className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold">Tài khoản của bạn đang chờ quản trị viên kích hoạt</h1>
            <p className="text-sm text-muted-foreground">
              Tài khoản {profile.email ?? session.user.email} đã đăng ký thành công. Vui lòng liên hệ
              quản trị viên để được kích hoạt và cấp quyền sử dụng hệ thống.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/auth", search: { next: undefined } });
            }}
          >
            <LogOut className="mr-2 size-4" />
            Đăng xuất
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="sticky top-0 hidden h-screen lg:block">
        <AppSidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-0 bg-sidebar p-0">
              <SheetTitle className="sr-only">Điều hướng</SheetTitle>
              <AppSidebar onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex-1">
            <GlobalSearch />
          </div>

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <UserRound className="size-4" />
                <span className="hidden max-w-40 truncate sm:inline">
                  {profile?.full_name ?? session.user.email}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="space-y-0.5">
                <p className="truncate text-sm">{profile?.full_name ?? "Người dùng"}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {session.user.email}
                </p>
                <p className="pt-1 text-xs font-normal text-muted-foreground">
                  {roles.length ? roles.map((r) => ROLE_LABELS[r]).join(", ") : "Chưa được cấp quyền"}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="justify-between">
                Cài đặt & tài khoản
                <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  Sắp mở rộng
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  await signOut();
                  void navigate({ to: "/auth", search: { next: undefined } });
                }}
              >
                <LogOut className="mr-2 size-4" />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <ReminderBanner />

        <main className="min-w-0 flex-1 p-4 md:p-6">
          {(() => {
            const inHr = pathname === "/nhan-su" || pathname.startsWith("/nhan-su/");
            const inTender = TENDER_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
            const blocked = (inHr && !canHr) || (inTender && !canTender);
            if (!canTender && !canHr) {
              return <NoAccess message="Tài khoản chưa được cấp quyền sử dụng phân hệ nào. Vui lòng liên hệ quản trị viên." />;
            }
            if (blocked) {
              return (
                <NoAccess
                  message={`Bạn không có quyền truy cập phân hệ ${inHr ? "Hợp đồng nhân sự" : "Đấu thầu"}.`}
                  to={inHr ? "/tong-quan" : "/nhan-su"}
                  toLabel={inHr ? "Về phân hệ Đấu thầu" : "Về phân hệ Hợp đồng nhân sự"}
                />
              );
            }
            return <Outlet />;
          })()}
        </main>
      </div>
    </div>
  );
}

function NoAccess({ message, to, toLabel }: { message: string; to?: "/tong-quan" | "/nhan-su"; toLabel?: string }) {
  return (
    <div className="panel mx-auto mt-10 max-w-md space-y-4 p-6 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
        <ShieldAlert className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm">{message}</p>
      {to ? (
        <Button asChild variant="outline">
          <Link to={to}>{toLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}

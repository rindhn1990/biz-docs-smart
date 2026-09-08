import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Đăng nhập — OfficeFlow" },
      {
        name: "description",
        content: "Đăng nhập vào hệ thống quản lý văn phòng và tự động hóa tác vụ hành chính.",
      },
      { property: "og:title", content: "Đăng nhập — OfficeFlow" },
      {
        property: "og:description",
        content: "Truy cập hệ thống quản lý đấu thầu, hợp đồng và thanh toán của doanh nghiệp bạn.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search["next"] === "string" ? (search["next"] as string) : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { next } = useSearch({ from: "/auth" });
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: next && next.startsWith("/") ? next : "/tong-quan" });
    }
  }, [loading, session, navigate, next]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("Invalid login")
          ? "Email hoặc mật khẩu không đúng."
          : `Không đăng nhập được: ${error.message}`,
      );
      return;
    }
    toast.success("Đăng nhập thành công.");
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Mật khẩu cần tối thiểu 6 ký tự.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/tong-quan`,
        data: { full_name: fullName || email },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("already registered")
          ? "Email này đã có tài khoản. Hãy đăng nhập."
          : `Không tạo được tài khoản: ${error.message}`,
      );
      return;
    }
    toast.success("Đã tạo tài khoản. Nếu cần xác nhận email, hãy kiểm tra hộp thư.");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">OfficeFlow</span>
        </div>
        <div>
          <h2 className="max-w-md font-display text-3xl font-semibold leading-snug">
            Số hóa hồ sơ, tự động hóa tác vụ hành chính
          </h2>
          <p className="mt-4 max-w-md text-sm text-sidebar-foreground/70">
            Tải tài liệu lên, hệ thống tự đọc và bóc tách dữ liệu, bạn kiểm tra rồi duyệt. Hợp đồng,
            thanh toán và báo cáo được cập nhật theo.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-sidebar-foreground/70">
            <li>· Nhận dạng tài liệu scan tiếng Việt</li>
            <li>· Kiểm tra dữ liệu kèm độ tin cậy từng trường</li>
            <li>· Điền biểu mẫu tự động</li>
            <li>· Cảnh báo hợp đồng sắp hết hạn</li>
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          Người đăng ký đầu tiên sẽ là quản trị hệ thống.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="font-display text-xl font-semibold">OfficeFlow</span>
          </div>
          <h1 className="text-2xl font-semibold">Truy cập hệ thống</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dùng email công ty của bạn để đăng nhập.
          </p>

          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Đăng nhập</TabsTrigger>
              <TabsTrigger value="signup">Tạo tài khoản</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ten@congty.vn"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Đăng nhập
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullname">Họ và tên</Label>
                  <Input
                    id="fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email2">Email</Label>
                  <Input
                    id="email2"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password2">Mật khẩu</Label>
                  <Input
                    id="password2"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Tạo tài khoản
                </Button>
                <p className="text-xs text-muted-foreground">
                  Tài khoản mới mặc định ở mức Chỉ xem, trừ tài khoản đầu tiên. Quản trị sẽ cấp thêm
                  quyền trong phần Cài đặt.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

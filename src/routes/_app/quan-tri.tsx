import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";
import type { AppRole } from "@/lib/domain";

export const Route = createFileRoute("/_app/quan-tri")({
  head: () => ({
    meta: [
      { title: "Phân quyền người dùng — OfficeFlow" },
      {
        name: "description",
        content:
          "Quản trị viên gán quyền theo email: chỉ admin được chỉnh sửa mẫu văn bản, các vai trò khác chỉ sử dụng.",
      },
      { property: "og:title", content: "Phân quyền người dùng — OfficeFlow" },
      {
        property: "og:description",
        content: "Gán vai trò quản trị viên theo email trong hệ thống OfficeFlow.",
      },
    ],
  }),
  component: RolesPage,
});

const ROLES: AppRole[] = ["admin", "manager", "commercial", "contract", "payment", "viewer"];

function RolesPage() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);

  const people = useQuery({
    queryKey: ["admin", "people"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id,email,full_name,department,is_active").order("email"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      if (error) throw error;
      const byUser = new Map<string, AppRole[]>();
      for (const r of (roles ?? []) as { user_id: string; role: AppRole }[]) {
        byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
      }
      return (profiles ?? []).map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
    },
  });

  async function setActive(userId: string, active: boolean) {
    setSaving(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: active })
        .eq("id", userId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["admin", "people"] });
      toast.success(active ? "Đã kích hoạt tài khoản" : "Đã vô hiệu hoá tài khoản");
    } catch (e) {
      toast.error("Không cập nhật được trạng thái", { description: (e as Error).message });
    } finally {
      setSaving(null);
    }
  }

  async function setRole(userId: string, role: AppRole) {
    setSaving(userId);
    try {
      const del = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (del.error) throw del.error;
      const ins = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (ins.error) throw ins.error;
      await queryClient.invalidateQueries({ queryKey: ["admin", "people"] });
      toast.success("Đã cập nhật quyền");
    } catch (e) {
      toast.error("Không cập nhật được quyền", { description: (e as Error).message });
    } finally {
      setSaving(null);
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Phân quyền người dùng" description="Khu vực dành cho quản trị viên." />
        <p className="panel inline-flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4" />
          Chỉ quản trị viên được xem và thay đổi phân quyền.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Phân quyền người dùng"
        description="Gán vai trò theo email. Chỉ quản trị viên được chỉnh sửa mẫu văn bản; các vai trò khác vẫn xem mẫu và xuất file Word bình thường."
      />
      <section className="panel">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ShieldCheck className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Người dùng trong hệ thống</h2>
        </header>
        <div className="overflow-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Họ tên</th>
                <th className="px-4 py-2.5 font-medium">Vai trò</th>
                <th className="px-4 py-2.5 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(people.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5">
                    {p.email ?? "—"}
                    {p.id === user?.id ? (
                      <span className="ml-2 text-xs text-muted-foreground">(bạn)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.full_name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={p.roles[0] ?? "viewer"}
                      disabled={saving === p.id}
                      onChange={(e) => void setRole(p.id, e.target.value as AppRole)}
                      aria-label={`Vai trò của ${p.email ?? p.id}`}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={p.is_active === true}
                        disabled={saving === p.id || p.id === user?.id}
                        onCheckedChange={(v) => void setActive(p.id, v)}
                        aria-label={`Kích hoạt tài khoản ${p.email ?? p.id}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {p.is_active ? "Đã kích hoạt" : "Chờ kích hoạt"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {people.isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Đang tải…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

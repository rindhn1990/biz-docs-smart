import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Pencil, Plus, ScanLine, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { ScanFileDialog } from "@/components/ScanFileDialog";
import { CONTRACTOR_SCAN_FIELDS } from "@/lib/contractor";

export const Route = createFileRoute("/_app/nha-thau")({
  head: () => ({
    meta: [
      { title: "Nhà thầu — OfficeFlow" },
      {
        name: "description",
        content:
          "Danh bạ nhà thầu: mã số thuế, địa chỉ, người đại diện, tài khoản ngân hàng và số gói thầu đã tham gia, đã trúng.",
      },
      { property: "og:title", content: "Nhà thầu — OfficeFlow" },
      {
        property: "og:description",
        content: "Quản lý tập trung thông tin nhà thầu để dùng lại cho mọi gói thầu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractorsPage,
});

type Form = {
  id?: string;
  name: string;
  tax_code: string;
  address: string;
  representative: string;
  representative_title: string;
  phone: string;
  email: string;
  bank_account: string;
  bank_name: string;
};

const empty: Form = {
  name: "",
  tax_code: "",
  address: "",
  representative: "",
  representative_title: "",
  phone: "",
  email: "",
  bank_account: "",
  bank_name: "",
};

function ContractorsPage() {
  const queryClient = useQueryClient();
  const { canWrite, user } = useAuth();
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState(false);

  const contractors = useQuery({
    queryKey: ["contractors", "with-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contractors")
        .select("*, tender_contractors(role)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(() => {
    const list = contractors.data ?? [];
    const key = q.trim().toLowerCase();
    if (!key) return list;
    return list.filter((c) =>
      [c.name, c.tax_code, c.representative].some((v) => (v ?? "").toLowerCase().includes(key)),
    );
  }, [contractors.data, q]);

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      toast.error("Hãy nhập tên nhà thầu");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      tax_code: form.tax_code.trim() || null,
      address: form.address.trim() || null,
      representative: form.representative.trim() || null,
      representative_title: form.representative_title.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      bank_account: form.bank_account.trim() || null,
      bank_name: form.bank_name.trim() || null,
      updated_by: user?.id ?? null,
    };
    const { error } = form.id
      ? await supabase.from("contractors").update(payload).eq("id", form.id)
      : await supabase
          .from("contractors")
          .insert({ ...payload, source: "nhap_tay", created_by: user?.id ?? null });
    setSaving(false);
    if (error) {
      toast.error("Không lưu được nhà thầu", { description: error.message });
      return;
    }
    toast.success(form.id ? "Đã cập nhật nhà thầu" : "Đã thêm nhà thầu");
    setForm(null);
    void queryClient.invalidateQueries({ queryKey: ["contractors"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("contractors").delete().eq("id", id);
    if (error) {
      toast.error("Không xoá được nhà thầu", { description: error.message });
      return;
    }
    toast.success("Đã xoá nhà thầu");
    void queryClient.invalidateQueries({ queryKey: ["contractors"] });
  }

  return (
    <div>
      <PageHeader
        title="Nhà thầu"
        description="Danh bạ dùng chung cho mọi gói thầu: thông tin nhập một lần, dùng lại ở mọi văn bản."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm theo tên, mã số thuế…"
                className="input min-w-[240px] pl-8"
              />
            </span>
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => setScanning(true)}
              className="inline-flex items-center gap-2 rounded-md border border-input px-3.5 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <ScanLine className="size-4" />
              Quét từ PDF / ảnh chụp
            </button>
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => setForm({ ...empty })}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="size-4" />
              Thêm nhà thầu
            </button>
          </div>
        }
      />

      {scanning ? (
        <ScanFileDialog
          title="Quét thông tin nhà thầu"
          description="Chọn giấy đăng ký kinh doanh, hồ sơ năng lực, đề nghị thanh toán… dạng ảnh chụp, PDF hoặc Word. Hệ thống đọc và điền sẵn vào biểu mẫu để bạn kiểm tra."
          fields={CONTRACTOR_SCAN_FIELDS.map((f) => ({ key: f.key, label: f.label }))}
          note="Đây là thông tin của một nhà thầu / đơn vị cung cấp hàng hoá, dịch vụ."
          onClose={() => setScanning(false)}
          onApply={(values) => {
            setForm((current) => ({ ...(current ?? { ...empty }), ...values }));
            toast.success("Đã điền thông tin vào biểu mẫu", {
              description: "Kiểm tra lại rồi bấm Lưu để thêm nhà thầu.",
            });
          }}
        />
      ) : null}


      {form ? (
        <section className="panel mb-4 p-4">
          <h2 className="mb-3 text-sm font-semibold">
            {form.id ? "Sửa thông tin nhà thầu" : "Nhà thầu mới"}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ["name", "Tên nhà thầu", true],
                ["tax_code", "Mã số thuế", false],
                ["address", "Địa chỉ", true],
                ["representative", "Người đại diện", false],
                ["representative_title", "Chức danh", false],
                ["phone", "Điện thoại", false],
                ["email", "Email", false],
                ["bank_account", "Số tài khoản", false],
                ["bank_name", "Ngân hàng", false],
              ] as [keyof Form, string, boolean][]
            ).map(([key, label, wide]) => (
              <label key={key} className={wide ? "md:col-span-2" : undefined}>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  {label}
                </span>
                <input
                  value={(form[key] as string) ?? ""}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="input"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Lưu
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-md border border-input px-3.5 py-2 text-sm font-medium hover:bg-accent"
            >
              Huỷ
            </button>
          </div>
        </section>
      ) : null}

      <div className="panel overflow-x-auto">
        {contractors.isLoading ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Đang tải…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Chưa có nhà thầu nào"
            description="Bấm “Thêm nhà thầu” để tạo danh bạ dùng chung."
          />
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Nhà thầu</th>
                <th className="px-4 py-3 font-medium">Người đại diện</th>
                <th className="px-4 py-3 font-medium">Ngân hàng</th>
                <th className="px-4 py-3 font-medium">Tham gia / trúng</th>
                <th className="px-4 py-3 font-medium">Nguồn</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => {
                const links = c.tender_contractors ?? [];
                const joined = links.filter((l) => l.role !== "winner").length;
                const won = links.filter((l) => l.role === "winner").length;
                return (
                  <tr key={c.id} className="align-top transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <span className="block max-w-[280px] truncate font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        MST {c.tax_code ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">{c.representative ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.representative_title ?? ""} {c.phone ? `· ${c.phone}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="block">{c.bank_name ?? "—"}</span>
                      <span className="text-xs">{c.bank_account ?? ""}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {joined} / {won}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={c.source === "bao_gia" ? "info" : "neutral"}>
                        {c.source === "bao_gia" ? "Từ báo giá" : "Nhập tay"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      {canWrite ? (
                        <span className="flex justify-end gap-1">
                          <button
                            type="button"
                            aria-label="Sửa"
                            onClick={() =>
                              setForm({
                                id: c.id,
                                name: c.name ?? "",
                                tax_code: c.tax_code ?? "",
                                address: c.address ?? "",
                                representative: c.representative ?? "",
                                representative_title: c.representative_title ?? "",
                                phone: c.phone ?? "",
                                email: c.email ?? "",
                                bank_account: c.bank_account ?? "",
                                bank_name: c.bank_name ?? "",
                              })
                            }
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Xoá"
                            onClick={() => void remove(c.id)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

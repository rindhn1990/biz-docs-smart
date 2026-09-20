import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, Plus, Gavel, Trash2 } from "lucide-react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { TENDER_METHODS, methodLabel, DEFAULT_METHOD, type TenderMethod } from "@/lib/methods";
import { TENDER_STATUS } from "@/lib/domain";
import { formatMoney } from "@/lib/tender";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_app/goi-thau/")({
  head: () => ({
    meta: [
      { title: "Gói thầu — OfficeFlow" },
      {
        name: "description",
        content:
          "Danh sách gói thầu với quy trình 18 bước: theo dõi tiến độ đã duyệt, dữ liệu chung và xuất văn bản Word cho từng bước.",
      },
      { property: "og:title", content: "Gói thầu — OfficeFlow" },
      {
        property: "og:description",
        content: "Theo dõi tiến độ từng gói thầu theo quy trình chuẩn của từng hình thức.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TenderCasesPage,
});

type NewCase = {
  name: string;
  code: string;
  method: TenderMethod;
  package_value: string;
  funding_source: string;
  location: string;
};

const emptyCase: NewCase = {
  name: "",
  code: "",
  method: DEFAULT_METHOD,
  package_value: "",
  funding_source: "",
  location: "",
};

function TenderCasesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, isAdmin, user } = useAuth();

  /** Xoá gói thầu kèm toàn bộ dữ liệu con — chỉ quản trị viên. */
  async function removeCase(id: string) {
    for (const table of [
      "tender_steps",
      "tender_sources",
      "tender_contractors",
      "tender_data",
    ] as const) {
      const { error } = await supabase.from(table).delete().eq("tender_id", id);
      if (error) {
        toast.error("Không xoá được dữ liệu của gói thầu", { description: error.message });
        return;
      }
    }
    const { error } = await supabase.from("tenders").delete().eq("id", id);
    if (error) {
      toast.error("Không xoá được gói thầu", { description: error.message });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["tender_cases"] });
    toast.success("Đã xoá gói thầu");
  }
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewCase>(emptyCase);
  const [methodFilter, setMethodFilter] = useState<string>("all");

  const cases = useQuery({
    queryKey: ["tender_cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenders")
        .select("id,code,name,method,package_value,status,created_at,tender_steps(status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(() => {
    const list = cases.data ?? [];
    return methodFilter === "all" ? list : list.filter((r) => r.method === methodFilter);
  }, [cases.data, methodFilter]);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Hãy nhập tên gói thầu");
      const { data: tender, error } = await supabase
        .from("tenders")
        .insert({
          name: form.name.trim(),
          code: form.code.trim() || null,
          method: form.method,
          package_value: form.package_value ? Number(form.package_value) : null,
          funding_source: form.funding_source.trim() || null,
          location: form.location.trim() || null,
          status: "preparing",
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { data: steps } = await supabase
        .from("workflow_steps")
        .select("sort_order,name,doc_type,template_id,required")
        .eq("method", form.method)
        .order("sort_order");

      if (steps?.length) {
        const { error: stepErr } = await supabase.from("tender_steps").insert(
          steps.map((s) => ({
            tender_id: tender.id,
            sort_order: s.sort_order,
            name: s.name,
            doc_type: s.doc_type,
            template_id: s.template_id,
            required: s.required,
            status: "pending",
            created_by: user?.id ?? null,
          })),
        );
        if (stepErr) throw stepErr;
      }

      await supabase.from("tender_data").insert({
        tender_id: tender.id,
        data: {
          ten_goi_thau: form.name.trim(),
          gia_goi_thau: form.package_value,
          nguon_von: form.funding_source,
          dia_diem: form.location,
        },
        created_by: user?.id ?? null,
      });

      return tender.id as string;
    },
    onSuccess: (id) => {
      setCreating(false);
      setForm(emptyCase);
      void queryClient.invalidateQueries({ queryKey: ["tender_cases"] });
      toast.success("Đã tạo gói thầu", { description: "Danh sách các bước đã được tạo sẵn." });
      void navigate({ to: "/goi-thau/$tenderId", params: { tenderId: id } });
    },
    onError: (e: Error) => toast.error("Không tạo được gói thầu", { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title="Gói thầu"
        description="Mỗi gói thầu đi theo một quy trình chuẩn gồm 18 bước. Mở gói thầu để nhập dữ liệu chung, tải tài liệu nguồn và xuất từng văn bản."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            >
              <option value="all">Tất cả hình thức</option>
              {TENDER_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => setCreating((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="size-4" />
              Tạo gói thầu
            </button>
          </div>
        }
      />

      {creating ? (
        <section className="panel mb-4 p-4">
          <h2 className="mb-3 text-sm font-semibold">Gói thầu mới</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Tên gói thầu" wide>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                placeholder="Ví dụ: Cung cấp vật tư điện dự phòng quý III"
              />
            </Field>
            <Field label="Mã gói thầu">
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="input"
                placeholder="GT-2026-010"
              />
            </Field>
            <Field label="Hình thức lựa chọn nhà thầu">
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value as TenderMethod })}
                className="input"
              >
                {TENDER_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Giá gói thầu (VNĐ)">
              <input
                value={form.package_value}
                onChange={(e) => setForm({ ...form, package_value: e.target.value })}
                className="input"
                inputMode="numeric"
                placeholder="8900000000"
              />
            </Field>
            <Field label="Nguồn vốn">
              <input
                value={form.funding_source}
                onChange={(e) => setForm({ ...form, funding_source: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Địa điểm">
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={create.isPending}
              onClick={() => create.mutate()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Tạo và mở hồ sơ
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-md border border-input px-3.5 py-2 text-sm font-medium hover:bg-accent"
            >
              Huỷ
            </button>
          </div>
        </section>
      ) : null}

      <div className="panel overflow-x-auto">
        {cases.isLoading ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Đang tải dữ liệu…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title="Chưa có gói thầu nào"
            description="Bấm “Tạo gói thầu” để bắt đầu một hồ sơ mới theo quy trình chuẩn."
          />
        ) : (
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Gói thầu</th>
                <th className="px-4 py-3 font-medium">Giá gói thầu</th>
                <th className="px-4 py-3 font-medium">Hình thức</th>
                <th className="px-4 py-3 font-medium">Tiến độ</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const steps = row.tender_steps ?? [];
                const done = steps.filter((s) => s.status === "approved").length;
                const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
                return (
                  <tr
                    key={row.id}
                    onClick={() =>
                      void navigate({ to: "/goi-thau/$tenderId", params: { tenderId: row.id } })
                    }
                    className="cursor-pointer transition-colors hover:bg-accent/60"
                  >
                    <td className="px-4 py-3">
                      <span className="block max-w-[340px] truncate font-medium">{row.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.code ?? "—"} · {formatDateTime(row.created_at)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatMoney(row.package_value)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{methodLabel(row.method)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {done}/{steps.length || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={TENDER_STATUS[row.status]?.tone}>
                        {TENDER_STATUS[row.status]?.label ?? row.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isAdmin ? (
                          <ConfirmDelete
                            title={`Xoá gói thầu "${row.name}"?`}
                            description="Toàn bộ bước, tài liệu nguồn, dữ liệu chung và nhà thầu của gói thầu này sẽ bị xoá."
                            onConfirm={() => removeCase(row.id)}
                          >
                            <button
                              type="button"
                              aria-label={`Xoá gói thầu ${row.name}`}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </ConfirmDelete>
                        ) : null}
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
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

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "md:col-span-2" : undefined}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

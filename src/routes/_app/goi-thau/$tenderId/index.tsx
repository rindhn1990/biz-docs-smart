import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, FileUp, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { methodLabel } from "@/lib/methods";
import { TENDER_STATUS } from "@/lib/domain";
import {
  CONTRACTOR_ROLES,
  DATA_CENTER_GROUPS,
  SOURCE_CATEGORIES,
  STEP_STATUS,
  formatMoney,
} from "@/lib/tender";

import { formatDateTime } from "@/lib/format";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { DateField, isDateField } from "@/components/DateField";
import { formatThousands, readVietnameseMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/goi-thau/$tenderId/")({
  head: () => ({
    meta: [
      { title: "Hồ sơ gói thầu — OfficeFlow" },
      {
        name: "description",
        content:
          "Hồ sơ một gói thầu: danh sách bước cần làm, tài liệu nguồn, dữ liệu chung và thông tin tổng hợp.",
      },
      { property: "og:title", content: "Hồ sơ gói thầu — OfficeFlow" },
      {
        property: "og:description",
        content: "Theo dõi từng bước, tài liệu nguồn và dữ liệu chung của một gói thầu.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TenderCaseDetail,
});

const TABS = [
  { key: "checklist", label: "Các bước" },
  { key: "sources", label: "Nguồn dữ liệu" },
  { key: "data", label: "Dữ liệu chung" },
  { key: "info", label: "Thông tin" },
] as const;

function TenderCaseDetail() {
  const { tenderId } = Route.useParams();
  const { canWrite, isAdmin } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("checklist");

  const tender = useQuery({
    queryKey: ["tender_case", tenderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenders")
        .select("*")
        .eq("id", tenderId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const steps = useQuery({
    queryKey: ["tender_steps", tenderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tender_steps")
        .select("*")
        .eq("tender_id", tenderId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const list = steps.data ?? [];
  const done = list.filter((s) => s.status === "approved").length;

  if (tender.isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Đang tải hồ sơ…</p>;
  }
  if (!tender.data) {
    return <EmptyState title="Không tìm thấy gói thầu này" />;
  }

  const t = tender.data;

  return (
    <div>
      <Link
        to="/goi-thau"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Danh sách gói thầu
      </Link>

      <PageHeader
        title={t.name}
        description={`${t.code ?? "Chưa có mã"} · ${methodLabel(t.method)} · ${formatMoney(t.package_value)} · đã duyệt ${done}/${list.length} bước`}
        actions={
          <StatusBadge tone={TENDER_STATUS[t.status]?.tone}>
            {TENDER_STATUS[t.status]?.label ?? t.status}
          </StatusBadge>
        }
      />

      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {TABS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setTab(x.key)}
            className={cn(
              "rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
              x.key === tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === "checklist" ? (
        <Checklist tenderId={tenderId} canWrite={canWrite} />
      ) : tab === "sources" ? (
        <Sources tenderId={tenderId} canWrite={canWrite} />
      ) : tab === "data" ? (
        <DataCenter tenderId={tenderId} canWrite={canWrite} />
      ) : (
        <Info tender={t} />
      )}
    </div>
  );
}

/* ---------------------------------- Bước ---------------------------------- */

function Checklist({ tenderId, canWrite }: { tenderId: string; canWrite: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const steps = useQuery({
    queryKey: ["tender_steps", tenderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tender_steps")
        .select("*")
        .eq("tender_id", tenderId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const list = steps.data ?? [];
  const done = list.filter((s) => s.status === "approved").length;

  async function setStatus(id: string, status: string) {
    setBusy(id);
    const { error } = await supabase
      .from("tender_steps")
      .update({
        status,
        approved_at: status === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    setBusy(null);
    if (error) {
      toast.error("Không cập nhật được bước", { description: error.message });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["tender_steps", tenderId] });
    void queryClient.invalidateQueries({ queryKey: ["tender_cases"] });
  }

  if (steps.isLoading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Đang tải…</p>;
  }
  if (list.length === 0) {
    return (
      <EmptyState
        title="Gói thầu này chưa có bước nào"
        description="Hãy thiết lập quy trình cho hình thức lựa chọn nhà thầu tương ứng ở mục Quy trình mẫu."
      />
    );
  }

  return (
    <section className="panel">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">
            Đã duyệt {done}/{list.length} bước
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Mở từng bước để nhập dữ liệu và xuất văn bản Word tương ứng.
          </p>
        </div>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary"
            style={{ width: `${Math.round((done / list.length) * 100)}%` }}
          />
        </div>
      </header>
      <ul className="divide-y divide-border">
        {list.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="w-6 shrink-0 text-xs text-muted-foreground">{s.sort_order}</span>
            {s.status === "approved" ? (
              <CheckCircle2 className="size-4 shrink-0 text-success" />
            ) : (
              <Circle className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground">
                {s.template_id ? "Đã gắn mẫu Word" : "Chưa gắn mẫu Word"}
                {s.required ? "" : " · không bắt buộc"}
              </span>
            </span>
            <StatusBadge tone={STEP_STATUS[s.status]?.tone}>
              {STEP_STATUS[s.status]?.label ?? s.status}
            </StatusBadge>
            <button
              type="button"
              onClick={() =>
                void navigate({
                  to: "/goi-thau/$tenderId/buoc/$stepId",
                  params: { tenderId, stepId: s.id },
                })
              }
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Mở
            </button>
            <select
              value={s.status}
              disabled={!canWrite || busy === s.id}
              onChange={(e) => void setStatus(s.id, e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary disabled:opacity-50"
            >
              {Object.entries(STEP_STATUS).map(([key, v]) => (
                <option key={key} value={key}>
                  {v.label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------ Nguồn dữ liệu ------------------------------ */

function Sources({ tenderId, canWrite }: { tenderId: string; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [uploading, setUploading] = useState<string | null>(null);

  const sources = useQuery({
    queryKey: ["tender_sources", tenderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tender_sources")
        .select("*")
        .eq("tender_id", tenderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function upload(category: string, files: FileList | null) {
    if (!files?.length) return;
    setUploading(category);
    try {
      for (const file of Array.from(files)) {
        const path = `tenders/${tenderId}/${category}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
        if (upErr) throw upErr;
        const { error } = await supabase.from("tender_sources").insert({
          tender_id: tenderId,
          category,
          file_name: file.name,
          storage_path: path,
          mime_type: file.type || null,
          file_size: file.size,
          status: SOURCE_CATEGORIES.find((c) => c.value === category)?.ai
            ? "cho_doc_du_lieu"
            : "uploaded",
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
      toast.success("Đã tải tài liệu lên");
      void queryClient.invalidateQueries({ queryKey: ["tender_sources", tenderId] });
    } catch (e) {
      toast.error("Không tải lên được", { description: (e as Error).message });
    } finally {
      setUploading(null);
    }
  }

  async function remove(id: string, path: string | null) {
    if (path) await supabase.storage.from("documents").remove([path]);
    const { error } = await supabase.from("tender_sources").delete().eq("id", id);
    if (error) {
      toast.error("Không xoá được tệp", { description: error.message });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["tender_sources", tenderId] });
  }

  const all = sources.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {SOURCE_CATEGORIES.map((cat) => {
        const files = all.filter((f) => f.category === cat.value);
        return (
          <section key={cat.value} className="panel">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{cat.label}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{cat.hint}</p>
            </header>
            <div className="p-4">
              <label
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-accent/50",
                  !canWrite && "pointer-events-none opacity-50",
                )}
              >
                {uploading === cat.value ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileUp className="size-4" />
                )}
                Chọn tệp để tải lên ({cat.accept.replaceAll(".", "").replaceAll(",", ", ")})
                <input
                  type="file"
                  multiple
                  accept={cat.accept}
                  className="hidden"
                  disabled={!canWrite}
                  onChange={(e) => void upload(cat.value, e.target.files)}
                />
              </label>

              {files.length === 0 ? (
                <p className="mt-3 text-center text-xs text-muted-foreground">Chưa có tệp nào.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{f.file_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(f.created_at)} ·{" "}
                          {Math.max(1, Math.round((f.file_size ?? 0) / 1024))} KB
                        </span>
                      </span>
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => void remove(f.id, f.storage_path)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Xoá tệp"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------- Dữ liệu chung ------------------------------ */

function DataCenter({ tenderId, canWrite }: { tenderId: string; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const row = useQuery({
    queryKey: ["tender_data", tenderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tender_data")
        .select("*")
        .eq("tender_id", tenderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const contractors = useQuery({
    queryKey: ["contractors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contractors").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const links = useQuery({
    queryKey: ["tender_contractors", tenderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tender_contractors")
        .select("*, contractors(name,tax_code,representative)")
        .eq("tender_id", tenderId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (row.data) setValues((row.data.data ?? {}) as Record<string, string>);
  }, [row.data]);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("tender_data").upsert(
      {
        tender_id: tenderId,
        data: values,
        updated_by: user?.id ?? null,
      },
      { onConflict: "tender_id" },
    );
    setSaving(false);
    if (error) {
      toast.error("Không lưu được dữ liệu", { description: error.message });
      return;
    }
    toast.success("Đã lưu dữ liệu chung");
    void queryClient.invalidateQueries({ queryKey: ["tender_data", tenderId] });
  }

  async function addContractor(role: string, contractorId: string) {
    if (!contractorId) return;
    const { error } = await supabase.from("tender_contractors").insert({
      tender_id: tenderId,
      contractor_id: contractorId,
      role,
      sort_order: (links.data ?? []).filter((l) => l.role === role).length + 1,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error("Không thêm được nhà thầu", { description: error.message });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["tender_contractors", tenderId] });
  }

  async function removeLink(id: string) {
    const { error } = await supabase.from("tender_contractors").delete().eq("id", id);
    if (error) {
      toast.error("Không xoá được", { description: error.message });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["tender_contractors", tenderId] });
  }

  return (
    <div className="space-y-4">
      {DATA_CENTER_GROUPS.map((group) => (
        <section key={group.title} className="panel">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{group.title}</h2>
          </header>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {group.fields.map((f) => (
              <label key={f.key} className={f.wide ? "md:col-span-2" : undefined}>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  {f.label}
                </span>
                <input
                  value={values[f.key] ?? ""}
                  readOnly={!canWrite}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="input read-only:bg-muted"
                />
              </label>
            ))}
          </div>
        </section>
      ))}

      {CONTRACTOR_ROLES.map((role) => {
        const rows = (links.data ?? []).filter((l) => l.role === role.value);
        return (
          <section key={role.value} className="panel">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{role.label}</h2>
              {canWrite ? (
                <select
                  value=""
                  onChange={(e) => void addContractor(role.value, e.target.value)}
                  className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                >
                  <option value="">+ Thêm nhà thầu…</option>
                  {(contractors.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </header>
            {rows.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                Chưa chọn nhà thầu nào.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{l.contractors?.name}</span>
                      <span className="text-xs text-muted-foreground">
                        MST {l.contractors?.tax_code ?? "—"} ·{" "}
                        {l.contractors?.representative ?? "—"}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-muted-foreground">
                      {formatMoney(l.price)}
                    </span>
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => void removeLink(l.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Bỏ nhà thầu"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {canWrite ? (
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Lưu dữ liệu chung
        </button>
      ) : null}
    </div>
  );
}

/* --------------------------------- Thông tin -------------------------------- */

function Info({ tender }: { tender: Record<string, unknown> }) {
  const t = tender as {
    name: string;
    code: string | null;
    method: string | null;
    package_value: number | null;
    funding_source: string | null;
    location: string | null;
    created_at: string;
    notes: string | null;
  };
  const items = [
    ["Tên gói thầu", t.name],
    ["Mã gói thầu", t.code ?? "—"],
    ["Hình thức lựa chọn nhà thầu", methodLabel(t.method)],
    ["Giá gói thầu", formatMoney(t.package_value)],
    ["Nguồn vốn", t.funding_source ?? "—"],
    ["Địa điểm", t.location ?? "—"],
    ["Ngày tạo", formatDateTime(t.created_at)],
    ["Ghi chú", t.notes ?? "—"],
  ] as const;

  return (
    <section className="panel divide-y divide-border">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-wrap gap-2 px-4 py-3 text-sm">
          <span className="w-56 shrink-0 text-muted-foreground">{label}</span>
          <span className="min-w-0 flex-1 font-medium">{value}</span>
        </div>
      ))}
    </section>
  );
}


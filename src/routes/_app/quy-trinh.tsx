import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpToLine, Loader2, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { DEFAULT_METHOD, TENDER_METHODS, type TenderMethod } from "@/lib/methods";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/quy-trinh")({
  head: () => ({
    meta: [
      { title: "Quy trình mẫu — OfficeFlow" },
      {
        name: "description",
        content:
          "Thiết lập danh sách bước chuẩn cho từng hình thức lựa chọn nhà thầu và gắn mẫu Word cho mỗi bước.",
      },
      { property: "og:title", content: "Quy trình mẫu — OfficeFlow" },
      {
        property: "og:description",
        content: "Mỗi hình thức lựa chọn nhà thầu có một quy trình bước riêng, gắn kèm mẫu Word.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkflowPage,
});

type Step = {
  key: string;
  name: string;
  doc_type: string | null;
  template_id: string | null;
  required: boolean;
};

function WorkflowPage() {
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const [method, setMethod] = useState<TenderMethod>(DEFAULT_METHOD);
  const [draft, setDraft] = useState<Step[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const steps = useQuery({
    queryKey: ["workflow_steps", method],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_steps")
        .select("id,name,doc_type,template_id,required,sort_order")
        .eq("method", method)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const templates = useQuery({
    queryKey: ["templates", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("templates").select("id,name,method").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setDraft(
      (steps.data ?? []).map((s) => ({
        key: s.id,
        name: s.name,
        doc_type: s.doc_type,
        template_id: s.template_id,
        required: s.required,
      })),
    );
    setDirty(false);
  }, [steps.data]);

  function update(next: Step[]) {
    setDraft(next);
    setDirty(true);
  }

  function insertAt(index: number) {
    const next = [...draft];
    next.splice(index, 0, {
      key: `new-${Date.now()}-${index}`,
      name: "Bước mới",
      doc_type: null,
      template_id: null,
      required: true,
    });
    update(next);
  }

  async function save() {
    setSaving(true);
    const { error: delErr } = await supabase.from("workflow_steps").delete().eq("method", method);
    if (delErr) {
      setSaving(false);
      toast.error("Không lưu được quy trình", { description: delErr.message });
      return;
    }
    if (draft.length) {
      const { error } = await supabase.from("workflow_steps").insert(
        draft.map((s, i) => ({
          method,
          sort_order: i + 1,
          name: s.name.trim() || `Bước ${i + 1}`,
          doc_type: s.doc_type,
          template_id: s.template_id,
          required: s.required,
          created_by: user?.id ?? null,
        })),
      );
      if (error) {
        setSaving(false);
        toast.error("Không lưu được quy trình", { description: error.message });
        return;
      }
    }
    setSaving(false);
    setDirty(false);
    toast.success("Đã lưu quy trình", {
      description: "Các gói thầu tạo mới sẽ dùng danh sách bước này.",
    });
    void queryClient.invalidateQueries({ queryKey: ["workflow_steps", method] });
  }

  return (
    <div>
      <PageHeader
        title="Quy trình mẫu"
        description="Mỗi hình thức lựa chọn nhà thầu có một danh sách bước riêng. Gói thầu tạo mới sẽ tự sao chép danh sách này."
        actions={
          isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!dirty}
                onClick={() => void steps.refetch()}
                className="inline-flex items-center gap-2 rounded-md border border-input px-3.5 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                <RotateCcw className="size-4" />
                Hoàn tác
              </button>
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={() => void save()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Lưu quy trình
              </button>
            </div>
          ) : null
        }
      />

      {!isAdmin ? (
        <p className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
          Chỉ quản trị viên được chỉnh sửa quy trình. Bạn vẫn xem được danh sách bước.
        </p>
      ) : null}

      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {TENDER_METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMethod(m.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              m.value === method
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <section className="panel">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{draft.length} bước</h2>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => insertAt(draft.length)}
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              + Thêm bước cuối
            </button>
          ) : null}
        </header>

        {steps.isLoading ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Đang tải…</p>
        ) : draft.length === 0 ? (
          <EmptyState
            title="Hình thức này chưa có bước nào"
            description="Thêm bước đầu tiên để tạo quy trình chuẩn cho hình thức này."
          />
        ) : (
          <ul className="divide-y divide-border">
            {draft.map((s, i) => (
              <li key={s.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-6 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                <input
                  value={s.name}
                  readOnly={!isAdmin}
                  onChange={(e) => {
                    const next = [...draft];
                    next[i] = { ...s, name: e.target.value };
                    update(next);
                  }}
                  className="input min-w-[220px] flex-1 read-only:bg-muted"
                />
                <select
                  value={s.template_id ?? ""}
                  disabled={!isAdmin}
                  onChange={(e) => {
                    const next = [...draft];
                    next[i] = { ...s, template_id: e.target.value || null };
                    update(next);
                  }}
                  className="input min-w-[200px] max-w-[260px] disabled:opacity-60"
                >
                  <option value="">Chưa gắn mẫu Word</option>
                  {(templates.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={s.required}
                    disabled={!isAdmin}
                    onChange={(e) => {
                      const next = [...draft];
                      next[i] = { ...s, required: e.target.checked };
                      update(next);
                    }}
                  />
                  Bắt buộc
                </label>
                {isAdmin ? (
                  <span className="flex gap-1">
                    <button
                      type="button"
                      aria-label="Chèn bước phía trên"
                      onClick={() => insertAt(i)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <ArrowUpToLine className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Chèn bước phía dưới"
                      onClick={() => insertAt(i + 1)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <ArrowDownToLine className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Xoá bước"
                      onClick={() => update(draft.filter((_, idx) => idx !== i))}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {dirty ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Thay đổi chỉ có hiệu lực sau khi bấm “Lưu quy trình”.
        </p>
      ) : null}
    </div>
  );
}

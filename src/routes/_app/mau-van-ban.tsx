import { Fragment, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Wand2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/mau-van-ban")({
  head: () => ({
    meta: [
      { title: "Mẫu văn bản — OfficeFlow" },
      {
        name: "description",
        content:
          "Kho mẫu hợp đồng, đề nghị thanh toán và biên bản nghiệm thu; tự động điền các chỗ trống từ dữ liệu hệ thống.",
      },
      { property: "og:title", content: "Mẫu văn bản — OfficeFlow" },
      {
        property: "og:description",
        content: "Chọn mẫu, ánh xạ chỗ trống và xem trước văn bản đã điền sẵn.",
      },
    ],
  }),
  component: TemplatesPage,
});

type Mapping = {
  id: string;
  template_id: string;
  placeholder: string;
  label: string;
  source_field: string | null;
  value: string | null;
  sort_order: number;
};

function TemplatesPage() {
  const queryClient = useQueryClient();
  const { canWrite } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [banner, setBanner] = useState(false);

  const templates = useQuery({
    queryKey: ["templates", "with-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("id,name,category,description,body")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const list = useMemo(() => templates.data ?? [], [templates.data]);
  const currentId = selectedId ?? list[0]?.id ?? null;

  const mappings = useQuery({
    queryKey: ["template_mappings", currentId],
    enabled: !!currentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("template_mappings")
        .select("*")
        .eq("template_id", currentId!)
        .order("sort_order");
      if (error) throw error;
      return data as Mapping[];
    },
  });

  const current = list.find((t) => t.id === currentId) ?? null;
  const rows = mappings.data ?? [];

  useEffect(() => setBanner(false), [currentId]);

  return (
    <div>
      <PageHeader
        title="Mẫu văn bản"
        description="Chọn mẫu, kiểm tra các chỗ trống được điền tự động, rồi xem trước văn bản hoàn chỉnh."
        actions={
          <button
            type="button"
            disabled={!current}
            onClick={() => setBanner(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Wand2 className="size-4" />
            Tạo văn bản
          </button>
        }
      />

      {banner ? (
        <p className="mb-4 flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          Đã tạo bản nháp “{current?.name}” với {rows.length} chỗ trống được điền tự động. Tính năng
          xuất tệp Word/PDF sẽ được bổ sung ở bước tiếp theo.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]">
        <section className="panel h-fit">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Danh sách mẫu</h2>
          </header>
          {templates.isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Đang tải…</p>
          ) : list.length === 0 ? (
            <EmptyState title="Chưa có mẫu nào" description="Hãy thêm mẫu văn bản để bắt đầu." />
          ) : (
            <ul className="divide-y divide-border">
              {list.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={cn(
                      "flex w-full items-start gap-2 px-4 py-3 text-left transition-colors",
                      t.id === currentId ? "bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{t.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.category ?? "—"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Ánh xạ dữ liệu</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Chỗ trống trong mẫu được nối với trường dữ liệu nguồn.
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Chỗ trống</th>
                  <th className="px-4 py-2.5 font-medium">Trường nguồn</th>
                  <th className="px-4 py-2.5 font-medium">Giá trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2.5">
                      <span className="num rounded bg-muted px-1.5 py-0.5 text-xs">
                        {`{{${m.placeholder}}}`}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{m.label}</span>
                    </td>
                    <td className="num px-4 py-2.5 text-xs text-muted-foreground">
                      {m.source_field ?? "Nhập tay"}
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        defaultValue={m.value ?? ""}
                        readOnly={!canWrite}
                        onBlur={async (e) => {
                          const next = e.target.value;
                          if (next === (m.value ?? "")) return;
                          await supabase
                            .from("template_mappings")
                            .update({ value: next || null })
                            .eq("id", m.id);
                          void queryClient.invalidateQueries({
                            queryKey: ["template_mappings", currentId],
                          });
                        }}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 read-only:bg-muted"
                      />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Mẫu này chưa khai báo chỗ trống nào.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Xem trước</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Phần nền hổ phách là dữ liệu được điền tự động.
            </p>
          </header>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {current ? renderPreview(current.body ?? "", rows) : "Chọn một mẫu để xem trước."}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}

function renderPreview(body: string, mappings: Mapping[]) {
  const parts = body.split(/(\{\{[A-Z0-9_]+\}\})/g);
  return parts.map((part, i) => {
    const match = part.match(/^\{\{([A-Z0-9_]+)\}\}$/);
    if (!match) return <Fragment key={i}>{part}</Fragment>;
    const key = match[1];
    const mapping = mappings.find((m) => m.placeholder === key);
    const value = mapping?.value?.trim();
    return (
      <mark
        key={i}
        className={cn(
          "rounded px-1 py-0.5",
          value
            ? "bg-warning/25 text-foreground"
            : "bg-destructive/10 text-destructive line-through",
        )}
      >
        {value || `Chưa có: ${key}`}
      </mark>
    );
  });
}

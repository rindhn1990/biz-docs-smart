import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { FieldGroupEditor, type FieldRow } from "@/components/FieldGroupEditor";
import { KHLCNT_DOC_TYPE } from "@/lib/khlcnt";
import { DEFAULT_METHOD, TENDER_METHODS, type TenderMethod } from "@/lib/methods";
import { renderAndDownloadDocx, type DelimiterStyle } from "@/lib/docx";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/du-lieu")({
  head: () => ({
    meta: [
      { title: "Dữ liệu gói thầu — OfficeFlow" },
      {
        name: "description",
        content:
          "Bảng dữ liệu tổng hợp đã quét từ Tờ trình KHLCNT: xem, sửa 39 trường theo nhóm và xuất văn bản Word theo hình thức lựa chọn nhà thầu.",
      },
      { property: "og:title", content: "Dữ liệu gói thầu — OfficeFlow" },
      {
        property: "og:description",
        content: "Tổng hợp dữ liệu quét được của từng gói thầu và xuất văn bản Word tương ứng.",
      },
    ],
  }),
  component: DataPage,
});

function DataPage() {
  const { canWrite } = useAuth();
  const [docId, setDocId] = useState<string | null>(null);
  const [method, setMethod] = useState<TenderMethod>(DEFAULT_METHOD);
  const [exporting, setExporting] = useState<string | null>(null);

  const docs = useQuery({
    queryKey: ["khlcnt_documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id,file_name,status,created_at")
        .eq("doc_type", KHLCNT_DOC_TYPE)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const list = docs.data ?? [];
  const defaultDoc = list.find((d) => d.status === "approved") ?? list[0];
  const currentId = docId ?? defaultDoc?.id ?? null;

  const fields = useQuery({
    queryKey: ["document_fields", currentId],
    enabled: !!currentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_fields")
        .select("*")
        .eq("document_id", currentId!)
        .order("sort_order");
      if (error) throw error;
      return data as FieldRow[];
    },
  });

  const templates = useQuery({
    queryKey: ["templates", "by-method", method],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("id,name,description,source_docx_path,delimiter_style,method")
        .eq("method", method)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(() => fields.data ?? [], [fields.data]);

  async function exportTemplate(tpl: {
    id: string;
    name: string;
    source_docx_path: string | null;
    delimiter_style: string | null;
  }) {
    if (!tpl.source_docx_path) {
      toast.error("Mẫu này chưa có tệp Word gốc", {
        description: "Hãy tải lên tệp .docx trong trang Mẫu văn bản.",
      });
      return;
    }
    setExporting(tpl.id);
    try {
      const { data: mappings } = await supabase
        .from("template_mappings")
        .select("placeholder,source_field,value")
        .eq("template_id", tpl.id);

      const byKey: Record<string, string> = {};
      for (const f of rows) if (f.value) byKey[f.field_key] = f.value;

      const values: Record<string, string> = {};
      for (const m of mappings ?? []) {
        const manual = m.value?.trim();
        values[m.placeholder] =
          manual || (m.source_field ? (byKey[m.source_field] ?? "") : (byKey[m.placeholder] ?? ""));
      }
      for (const key of Object.keys(byKey)) values[key] ??= byKey[key]!;

      const { data, error } = await supabase.storage
        .from("templates")
        .download(tpl.source_docx_path);
      if (error) throw error;
      await renderAndDownloadDocx(
        await data.arrayBuffer(),
        (tpl.delimiter_style as DelimiterStyle) ?? "curly",
        values,
        `${tpl.name}.docx`,
      );
      toast.success("Đã xuất file Word", { description: `${tpl.name}.docx` });
    } catch (e) {
      toast.error("Không xuất được file", { description: (e as Error).message });
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Dữ liệu"
        description="Toàn bộ dữ liệu máy đọc được của một gói thầu, gom theo nhóm để đối chiếu và sửa nhanh, sau đó xuất thẳng ra văn bản Word."
        actions={
          <select
            value={currentId ?? ""}
            onChange={(e) => setDocId(e.target.value)}
            className="min-w-[260px] rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          >
            {list.length === 0 ? <option value="">Chưa có hồ sơ Tờ trình KHLCNT</option> : null}
            {list.map((d) => (
              <option key={d.id} value={d.id}>
                {d.file_name} · {new Date(d.created_at).toLocaleDateString("vi-VN")}
                {d.status === "approved" ? " · đã duyệt" : ""}
              </option>
            ))}
          </select>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Chưa có hồ sơ Tờ trình KHLCNT"
          description="Hãy tải lên một hồ sơ Tờ trình KHLCNT ở mục Hồ sơ đấu thầu để xem dữ liệu tổng hợp tại đây."
        />
      ) : (
        <div className="space-y-4">
          <section className="panel">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Dữ liệu gói thầu ({rows.length} trường)</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Mọi chỉnh sửa được lưu ngay khi bạn rời khỏi ô nhập và dùng luôn cho phần xuất văn
                bản bên dưới.
              </p>
            </header>
            {fields.isLoading ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Đang tải…</p>
            ) : rows.length === 0 ? (
              <EmptyState
                title="Hồ sơ này chưa có dữ liệu trích xuất"
                description="Hãy chờ hồ sơ chạy xong bước trích xuất dữ liệu."
              />
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <FieldGroupEditor rows={rows} readOnly={!canWrite} />
              </div>
            )}
          </section>

          <section className="panel">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Xuất văn bản</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Chọn hình thức lựa chọn nhà thầu để xem các mẫu Word tương ứng.
              </p>
            </header>
            <div className="border-b border-border px-4 py-3">
              <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
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
            </div>
            <div className="p-4">
              {templates.isLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Đang tải…</p>
              ) : (templates.data ?? []).length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Chưa có mẫu cho hình thức này"
                  description="Tải lên file .docx trong trang Mẫu văn bản để bắt đầu."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {(templates.data ?? []).map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                      <FileText className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t.name}</span>
                        {t.description ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {t.description}
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        disabled={exporting !== null}
                        onClick={() => void exportTemplate(t)}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                        {exporting === t.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Download className="size-4" />
                        )}
                        Xuất file Word
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, FileUp, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import {
  extractPlaceholdersFromFile,
  prettifyPlaceholder,
  renderAndDownloadDocx,
  type DelimiterStyle,
} from "@/lib/docx";
import { KHLCNT_DOC_TYPE, KHLCNT_FIELDS } from "@/lib/khlcnt";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/mau-van-ban")({
  head: () => ({
    meta: [
      { title: "Mẫu văn bản — OfficeFlow" },
      {
        name: "description",
        content:
          "Kho mẫu Word thật: tải lên tệp .docx, tự dò chỗ trống [[Ten_bien]] hoặc {{TEN_BIEN}} và xuất văn bản đã điền dữ liệu.",
      },
      { property: "og:title", content: "Mẫu văn bản — OfficeFlow" },
      {
        property: "og:description",
        content: "Tải lên mẫu Word thật, ánh xạ chỗ trống và xuất file .docx đã điền sẵn.",
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

const KHLCNT_KEYS = new Set(KHLCNT_FIELDS.map((f) => f.key));

function TemplatesPage() {
  const queryClient = useQueryClient();
  const { user, canWrite } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "export" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const templates = useQuery({
    queryKey: ["templates", "with-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("id,name,category,description,body,source_docx_path,delimiter_style")
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

  /** Dữ liệu từ hồ sơ Tờ trình KHLCNT đã xác nhận gần nhất, dùng để điền tự động. */
  const approvedData = useQuery({
    queryKey: ["khlcnt_approved_fields"],
    queryFn: async () => {
      const { data: doc } = await supabase
        .from("documents")
        .select("id")
        .eq("doc_type", KHLCNT_DOC_TYPE)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!doc) return {} as Record<string, string>;
      const { data: fields } = await supabase
        .from("document_fields")
        .select("field_key,value")
        .eq("document_id", doc.id);
      const map: Record<string, string> = {};
      for (const f of fields ?? []) if (f.value) map[f.field_key] = f.value;
      return map;
    },
  });

  const current = list.find((t) => t.id === currentId) ?? null;
  const rows = mappings.data ?? [];
  const auto = approvedData.data ?? {};

  const resolved = useMemo(() => {
    const out: Record<string, string> = {};
    for (const m of rows) {
      const manual = m.value?.trim();
      out[m.placeholder] = manual || (m.source_field ? (auto[m.source_field] ?? "") : "");
    }
    return out;
  }, [rows, auto]);

  useEffect(() => setBusy(null), [currentId]);

  async function handleUploadDocx(file: File) {
    setBusy("upload");
    try {
      const { placeholders, style } = await extractPlaceholdersFromFile(file);
      const name = file.name.replace(/\.docx$/i, "");

      const { data: tpl, error } = await supabase
        .from("templates")
        .insert({
          name,
          category: "Tải lên",
          description: `Mẫu Word gốc do người dùng tải lên · ${placeholders.length} chỗ trống`,
          delimiter_style: style,
          file_name: file.name,
          mime_type: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const path = `templates/${tpl.id}/source.docx`;
      const up = await supabase.storage.from("templates").upload(path, file, { upsert: true });
      if (up.error) throw up.error;

      await supabase.from("templates").update({ source_docx_path: path }).eq("id", tpl.id);

      if (placeholders.length > 0) {
        await supabase.from("template_mappings").insert(
          placeholders.map((p, i) => ({
            template_id: tpl.id,
            placeholder: p,
            label: prettifyPlaceholder(p),
            source_field: KHLCNT_KEYS.has(p) ? p : null,
            sort_order: i + 1,
          })),
        );
      }

      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      setSelectedId(tpl.id);
      toast.success("Đã tải lên mẫu Word", {
        description: `Tìm thấy ${placeholders.length} chỗ trống kiểu ${style === "square" ? "[[...]]" : "{{...}}"}.`,
      });
    } catch (e) {
      toast.error("Không tải lên được mẫu", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function handleExport() {
    if (!current) return;
    if (!current.source_docx_path) {
      toast.error("Mẫu này chưa có tệp Word gốc", {
        description: "Hãy tải lên tệp .docx để xuất văn bản đúng định dạng.",
      });
      return;
    }
    setBusy("export");
    try {
      const { data, error } = await supabase.storage
        .from("templates")
        .download(current.source_docx_path);
      if (error) throw error;
      await renderAndDownloadDocx(
        await data.arrayBuffer(),
        (current.delimiter_style as DelimiterStyle) ?? "curly",
        resolved,
        `${current.name}.docx`,
      );
      toast.success("Đã xuất file Word", { description: `${current.name}.docx` });
    } catch (e) {
      toast.error("Không xuất được file", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Mẫu văn bản"
        description="Tải lên mẫu Word thật, hệ thống tự dò các chỗ trống [[Ten_bien]] hoặc {{TEN_BIEN}} và điền dữ liệu từ hồ sơ đã xác nhận."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleUploadDocx(file);
              }}
            />
            <button
              type="button"
              disabled={!canWrite || busy !== null}
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-2 rounded-md border border-input px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              {busy === "upload" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileUp className="size-4" />
              )}
              Tải lên mẫu (.docx)
            </button>
            <button
              type="button"
              disabled={!current || busy !== null}
              onClick={() => void handleExport()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {busy === "export" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Xuất file Word
            </button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
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
                        {t.source_docx_path ? " · có tệp Word" : " · chỉ văn bản"}
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
              Chỗ trống trong mẫu được nối với trường dữ liệu nguồn. Để trống ô giá trị nếu muốn
              dùng dữ liệu tự động từ hồ sơ đã xác nhận.
            </p>
            {current?.description ? (
              <p className="mt-1 text-xs italic text-muted-foreground">{current.description}</p>
            ) : null}
          </header>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Chỗ trống</th>
                  <th className="px-4 py-2.5 font-medium">Trường nguồn</th>
                  <th className="px-4 py-2.5 font-medium">Giá trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((m) => {
                  const wrap = current?.delimiter_style === "square" ? ["[[", "]]"] : ["{{", "}}"];
                  return (
                    <tr key={m.id}>
                      <td className="px-4 py-2.5">
                        <span className="num rounded bg-muted px-1.5 py-0.5 text-xs">
                          {`${wrap[0]}${m.placeholder}${wrap[1]}`}
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
                          placeholder={
                            m.source_field ? (auto[m.source_field] ?? "Chưa có dữ liệu") : "—"
                          }
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
                  );
                })}
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
              {current ? renderPreview(current.body ?? "", resolved) : "Chọn một mẫu để xem trước."}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}

function renderPreview(body: string, values: Record<string, string>) {
  const parts = body.split(/(\{\{[A-Za-z0-9_]+\}\}|\[\[[A-Za-z0-9_]+\]\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^(?:\{\{|\[\[)([A-Za-z0-9_]+)(?:\}\}|\]\])$/);
    if (!match) return <Fragment key={i}>{part}</Fragment>;
    const key = match[1] ?? "";
    const value = values[key]?.trim();
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

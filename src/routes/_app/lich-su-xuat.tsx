import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileClock, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { DateField, isDateField } from "@/components/DateField";
import { DocxPreviewDialog } from "@/components/DocxPreviewDialog";
import { recordExport } from "@/lib/export-history";
import { formatDateTime } from "@/lib/format";
import {
  formatThousands,
  isMoneyNumberField,
  moneyTextKey,
  readVietnameseMoney,
} from "@/lib/money";
import { renderAndDownloadDocx, type DelimiterStyle } from "@/lib/docx";

export const Route = createFileRoute("/_app/lich-su-xuat")({
  head: () => ({
    meta: [
      { title: "Lịch sử xuất file — OfficeFlow" },
      {
        name: "description",
        content:
          "Xem lại mọi lần xuất văn bản theo từng gói thầu, mở lại dữ liệu đã dùng để chỉnh sửa và xuất lại.",
      },
      { property: "og:title", content: "Lịch sử xuất file — OfficeFlow" },
      {
        property: "og:description",
        content: "Lưu vết người xuất, thời điểm xuất và dữ liệu đã điền vào từng văn bản.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExportHistoryPage,
});

type HistoryRow = {
  id: string;
  tender_id: string | null;
  template_id: string | null;
  template_name: string | null;
  file_name: string;
  module: string;
  data: Record<string, string>;
  exported_by_email: string | null;
  created_at: string;
  tenders: { name: string } | null;
  templates: { source_docx_path: string | null; delimiter_style: string | null } | null;
};

function ExportHistoryPage() {
  const queryClient = useQueryClient();
  const { isAdmin, canWrite, user, profile } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    title: string;
    fileName: string;
    source: ArrayBuffer;
    style: DelimiterStyle;
    data: Record<string, string>;
  } | null>(null);

  const history = useQuery({
    queryKey: ["export_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_history")
        .select(
          "id,tender_id,template_id,template_name,file_name,module,data,exported_by_email,created_at,tenders(name),templates(source_docx_path,delimiter_style)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as HistoryRow[];
    },
  });

  /** Nhóm các lần xuất theo gói thầu để dễ theo dõi. */
  const groups = useMemo(() => {
    const map = new Map<string, { title: string; rows: HistoryRow[] }>();
    for (const row of history.data ?? []) {
      const key = row.tender_id ?? "khac";
      const title = row.tenders?.name ?? "Không thuộc gói thầu nào";
      const found = map.get(key);
      if (found) found.rows.push(row);
      else map.set(key, { title, rows: [row] });
    }
    return [...map.values()];
  }, [history.data]);

  function open(row: HistoryRow) {
    setOpenId(row.id);
    setDraft({ ...(row.data ?? {}) });
  }

  async function loadSource(row: HistoryRow) {
    const path = row.templates?.source_docx_path;
    if (!path) throw new Error("Mẫu gốc của bản xuất này không còn trong kho mẫu");
    const { data, error } = await supabase.storage.from("templates").download(path);
    if (error) throw error;
    return {
      buffer: await data.arrayBuffer(),
      style: ((row.templates?.delimiter_style as DelimiterStyle) ?? "curly") as DelimiterStyle,
    };
  }

  async function saveDraft(row: HistoryRow) {
    setBusy(true);
    const { error } = await supabase
      .from("export_history")
      .update({ data: draft, updated_by: user?.id ?? null })
      .eq("id", row.id);
    setBusy(false);
    if (error) {
      toast.error("Không lưu được chỉnh sửa", { description: error.message });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["export_history"] });
    toast.success("Đã lưu dữ liệu của bản xuất này");
  }

  async function previewRow(row: HistoryRow) {
    setBusy(true);
    try {
      const { buffer, style } = await loadSource(row);
      setPreview({
        title: row.template_name ?? row.file_name,
        fileName: row.file_name,
        source: buffer,
        style,
        data: draft,
      });
    } catch (e) {
      toast.error("Không xem trước được", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function exportAgain(row: HistoryRow) {
    setBusy(true);
    try {
      const { buffer, style } = await loadSource(row);
      await renderAndDownloadDocx(buffer, style, draft, row.file_name);
      await recordExport({
        fileName: row.file_name,
        module: (row.module as "tender" | "hr" | "payment") ?? "tender",
        data: draft,
        tenderId: row.tender_id,
        templateId: row.template_id,
        templateName: row.template_name,
        userId: user?.id ?? null,
        userEmail: profile?.email ?? user?.email ?? null,
      });
      void queryClient.invalidateQueries({ queryKey: ["export_history"] });
      toast.success("Đã xuất lại file Word", { description: row.file_name });
    } catch (e) {
      toast.error("Không xuất lại được", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(id: string) {
    const { error } = await supabase.from("export_history").delete().eq("id", id);
    if (error) {
      toast.error("Không xoá được bản ghi", { description: error.message });
      return;
    }
    if (openId === id) setOpenId(null);
    void queryClient.invalidateQueries({ queryKey: ["export_history"] });
    toast.success("Đã xoá bản ghi lịch sử");
  }

  return (
    <div>
      <PageHeader
        title="Lịch sử xuất file"
        description="Mỗi lần xuất văn bản đều được lưu lại kèm dữ liệu đã điền. Mở một bản để xem, sửa và xuất lại."
      />

      {history.isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Đang tải…</p>
      ) : groups.length === 0 ? (
        <EmptyState
          title="Chưa có lần xuất nào"
          description="Khi bạn xuất một văn bản Word, bản ghi sẽ hiện tại đây theo từng gói thầu."
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.title} className="panel">
              <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                <FileClock className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{group.title}</h2>
                <span className="text-xs text-muted-foreground">({group.rows.length} lần xuất)</span>
              </header>
              <ul className="divide-y divide-border">
                {group.rows.map((row) => (
                  <li key={row.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{row.file_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(row.created_at)}
                          {row.exported_by_email ? ` · ${row.exported_by_email}` : ""}
                          {row.template_name ? ` · Mẫu: ${row.template_name}` : ""}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => (openId === row.id ? setOpenId(null) : open(row))}
                        className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
                      >
                        {openId === row.id ? "Đóng" : "Mở lại"}
                      </button>
                      {isAdmin ? (
                        <ConfirmDelete
                          title="Xoá bản ghi lịch sử này?"
                          description={`Bản xuất "${row.file_name}" sẽ bị xoá khỏi lịch sử. File Word đã tải về không bị ảnh hưởng.`}
                          onConfirm={() => removeRow(row.id)}
                        >
                          <button
                            type="button"
                            aria-label={`Xoá bản ghi ${row.file_name}`}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </ConfirmDelete>
                      ) : null}
                    </div>

                    {openId === row.id ? (
                      <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          {Object.keys(row.data ?? {}).length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Bản xuất này không lưu dữ liệu chi tiết.
                            </p>
                          ) : (
                            Object.keys(row.data ?? {}).map((key) => {
                              const isDate = isDateField(key);
                              const isMoney = isMoneyNumberField(key, key);
                              return (
                                <label key={key}>
                                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                                    {key}
                                  </span>
                                  {isDate ? (
                                    <DateField
                                      value={draft[key] ?? ""}
                                      readOnly={!canWrite}
                                      onChange={(next) => setDraft({ ...draft, [key]: next })}
                                    />
                                  ) : (
                                    <input
                                      value={draft[key] ?? ""}
                                      readOnly={!canWrite}
                                      inputMode={isMoney ? "numeric" : undefined}
                                      onChange={(e) => {
                                        if (isMoney) {
                                          const next = formatThousands(e.target.value);
                                          setDraft({
                                            ...draft,
                                            [key]: next,
                                            [moneyTextKey(key)]: readVietnameseMoney(next),
                                          });
                                          return;
                                        }
                                        setDraft({ ...draft, [key]: e.target.value });
                                      }}
                                      className="input read-only:bg-muted"
                                    />
                                  )}
                                </label>
                              );
                            })
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy || !canWrite}
                            onClick={() => void saveDraft(row)}
                            className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                            Lưu chỉnh sửa
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void previewRow(row)}
                            className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                          >
                            <Eye className="size-4" />
                            Xem trước
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void exportAgain(row)}
                            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            <Download className="size-4" />
                            Xuất lại
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {preview ? (
        <DocxPreviewDialog
          title={preview.title}
          fileName={preview.fileName}
          source={preview.source}
          style={preview.style}
          data={preview.data}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}

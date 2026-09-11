import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  FileUp,
  Download,
  Loader2,
  Plus,
  Trash2,
  Lock,
  Pencil,
  MousePointerClick,
  RefreshCw,
  FileSearch,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TemplateRegionPicker } from "@/components/TemplateRegionPicker";
import { TemplateAutoDetect } from "@/components/TemplateAutoDetect";
import { Button } from "@/components/ui/button";
import {
  extractPlaceholdersFromFile,
  prettifyPlaceholder,
  renderAndDownloadDocx,
  type DelimiterStyle,
} from "@/lib/docx";
import { KHLCNT_DOC_TYPE, KHLCNT_FIELDS } from "@/lib/khlcnt";
import { HR_TEMPLATE_FIELDS } from "@/lib/hr";
import { PAYMENT_TEMPLATE_FIELDS } from "@/lib/payment";
import { DEFAULT_METHOD, TENDER_METHODS, type TenderMethod } from "@/lib/methods";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/mau-van-ban")({
  validateSearch: (search: Record<string, unknown>) => ({
    module:
      search["module"] === "hr"
        ? ("hr" as const)
        : search["module"] === "payment"
          ? ("payment" as const)
          : ("tender" as const),
  }),
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

const ADMIN_ONLY_NOTE = "Chỉ quản trị viên được chỉnh sửa mẫu";

function TemplatesPage() {
  const { module } = Route.useSearch();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [method, setMethod] = useState<TenderMethod>(DEFAULT_METHOD);
  const [busy, setBusy] = useState<"upload" | "export" | "replace" | "delete" | null>(null);
  const [adding, setAdding] = useState(false);
  const [newPlaceholder, setNewPlaceholder] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newSource, setNewSource] = useState("");
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editMethod, setEditMethod] = useState<TenderMethod>(DEFAULT_METHOD);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const templates = useQuery({
    queryKey: ["templates", "with-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("id,name,category,description,body,source_docx_path,delimiter_style,method,module")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const list = useMemo(
    () =>
      (templates.data ?? []).filter(
        (t) => t.module === module && (module === "hr" || t.method === method),
      ),
    [templates.data, method, module],
  );
  const currentId = list.some((t) => t.id === selectedId) ? selectedId : (list[0]?.id ?? null);

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
  const sourceFields = module === "hr" ? HR_TEMPLATE_FIELDS : KHLCNT_FIELDS;
  const sourceKeys = new Set<string>(sourceFields.map((field) => field.key));
  const auto = approvedData.data ?? {};
  const wrap: [string, string] =
    current?.delimiter_style === "square" ? ["[[", "]]"] : ["{{", "}}"];

  const resolved = useMemo(() => {
    const out: Record<string, string> = {};
    for (const m of rows) {
      const manual = m.value?.trim();
      out[m.placeholder] = manual || (m.source_field ? (auto[m.source_field] ?? "") : "");
    }
    return out;
  }, [rows, auto]);

  useEffect(() => {
    setBusy(null);
    setAdding(false);
    setEditing(false);
    setPicking(false);
    setDetecting(false);
  }, [currentId]);

  useEffect(() => {
    if (!current) return;
    setEditName(current.name);
    setEditDescription(current.description ?? "");
    setEditMethod((current.method as TenderMethod) ?? DEFAULT_METHOD);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function uploadOneDocx(file: File) {
      const { placeholders, style } = await extractPlaceholdersFromFile(file);
      const name = file.name.replace(/\.docx$/i, "");

      const { data: tpl, error } = await supabase
        .from("templates")
        .insert({
          name,
          category: "Tải lên",
          description: `Mẫu Word gốc do người dùng tải lên · ${placeholders.length} chỗ trống`,
          delimiter_style: style,
          // Mẫu luôn thuộc đúng hình thức của tab đang mở.
          method: module === "tender" ? method : null,
          module,
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
            source_field: sourceKeys.has(p) ? p : null,
            sort_order: i + 1,
          })),
        );
      }

      return { id: tpl.id };
  }

  async function handleUploadDocx(files: File[]) {
    if (!files.length) return;
    setBusy("upload");
    const results = await Promise.allSettled(files.map(uploadOneDocx));
    const succeeded = results.filter((result) => result.status === "fulfilled");
    const failed = results.length - succeeded.length;
    await queryClient.invalidateQueries({ queryKey: ["templates"] });
    const last = succeeded.at(-1);
    if (last?.status === "fulfilled") setSelectedId(last.value.id);
    if (succeeded.length) toast.success(`Đã tải lên ${succeeded.length} mẫu Word`);
    if (failed) toast.error(`${failed} file không tải lên được`, { description: "Các file hợp lệ còn lại đã được lưu." });
    setBusy(null);
  }

  async function handleAddMapping() {
    if (!currentId) return;
    const placeholder = newPlaceholder.trim().replace(/^[[{]+|[\]}]+$/g, "");
    if (!/^[A-Za-z0-9_]+$/.test(placeholder)) {
      toast.error("Tên chỗ trống chỉ gồm chữ, số và dấu gạch dưới");
      return;
    }
    if (rows.some((r) => r.placeholder === placeholder)) {
      toast.error("Chỗ trống này đã có trong mẫu");
      return;
    }
    const { error } = await supabase.from("template_mappings").insert({
      template_id: currentId,
      placeholder,
      label: newLabel.trim() || prettifyPlaceholder(placeholder),
      source_field: newSource || null,
      sort_order: (rows.at(-1)?.sort_order ?? 0) + 1,
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    });
    if (error) {
      toast.error("Không thêm được chỗ trống", { description: error.message });
      return;
    }
    setNewPlaceholder("");
    setNewLabel("");
    setNewSource("");
    setAdding(false);
    await queryClient.invalidateQueries({ queryKey: ["template_mappings", currentId] });
    toast.success("Đã thêm chỗ trống", {
      description: `Nhớ chèn ${wrap[0]}${placeholder}${wrap[1]} vào file Word rồi tải lại.`,
    });
  }

  async function handleDeleteMapping(id: string) {
    const { error } = await supabase.from("template_mappings").delete().eq("id", id);
    if (error) {
      toast.error("Không xoá được dòng", { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["template_mappings", currentId] });
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

  async function handleSaveTemplateInfo() {
    if (!current) return;
    const name = editName.trim();
    if (!name) {
      toast.error("Tên mẫu không được để trống");
      return;
    }
    const { error } = await supabase
      .from("templates")
      .update({
        name,
        description: editDescription.trim() || null,
        method: module === "tender" ? editMethod : null,
        updated_by: user?.id ?? null,
      })
      .eq("id", current.id);
    if (error) {
      toast.error("Không lưu được thông tin mẫu", { description: error.message });
      return;
    }
    setEditing(false);
    if (module === "tender" && editMethod !== method) setMethod(editMethod);
    setSelectedId(current.id);
    await queryClient.invalidateQueries({ queryKey: ["templates"] });
    toast.success("Đã lưu thông tin mẫu");
  }

  async function handleReplaceDocx(file: File) {
    if (!current) return;
    setBusy("replace");
    try {
      const { placeholders, style } = await extractPlaceholdersFromFile(file);
      const path = current.source_docx_path ?? `templates/${current.id}/source.docx`;
      const up = await supabase.storage.from("templates").upload(path, file, { upsert: true });
      if (up.error) throw up.error;

      const { error } = await supabase
        .from("templates")
        .update({
          source_docx_path: path,
          delimiter_style: style,
          file_name: file.name,
          updated_by: user?.id ?? null,
        })
        .eq("id", current.id);
      if (error) throw error;

      const known = new Set(rows.map((r) => r.placeholder));
      const fresh = placeholders.filter((p) => !known.has(p));
      if (fresh.length > 0) {
        await supabase.from("template_mappings").insert(
          fresh.map((p, i) => ({
            template_id: current.id,
            placeholder: p,
            label: prettifyPlaceholder(p),
            source_field: sourceKeys.has(p) ? p : null,
            sort_order: (rows.at(-1)?.sort_order ?? 0) + i + 1,
          })),
        );
      }

      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      await queryClient.invalidateQueries({ queryKey: ["template_mappings", current.id] });
      toast.success("Đã thay file Word của mẫu", {
        description:
          fresh.length > 0 ? `Thêm ${fresh.length} chỗ trống mới.` : "Giữ nguyên các ánh xạ cũ.",
      });
    } catch (e) {
      toast.error("Không thay được file", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteTemplate() {
    if (!current) return;
    if (!window.confirm(`Xoá mẫu "${current.name}"? Thao tác này không thể hoàn tác.`)) return;
    setBusy("delete");
    try {
      await supabase.from("template_mappings").delete().eq("template_id", current.id);
      const { error } = await supabase.from("templates").delete().eq("id", current.id);
      if (error) throw error;
      if (current.source_docx_path) {
        await supabase.storage.from("templates").remove([current.source_docx_path]);
      }
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Đã xoá mẫu văn bản");
    } catch (e) {
      toast.error("Không xoá được mẫu", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }


  return (
    <div>
      <PageHeader
        title="Mẫu văn bản"
        description={module === "hr" ? "Kho mẫu Word dành riêng cho hồ sơ và hợp đồng nhân sự." : "Chọn hình thức lựa chọn nhà thầu, rồi tải một hoặc nhiều mẫu Word lên."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept=".docx"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) void handleUploadDocx(files);
              }}
            />
            {isAdmin ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-2 rounded-md border border-input px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                {busy === "upload" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileUp className="size-4" />
                )}
                Tải lên nhiều mẫu
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" />
                {ADMIN_ONLY_NOTE}
              </span>
            )}
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

      {module === "tender" ? <div
        role="tablist"
        aria-label="Hình thức lựa chọn nhà thầu"
        className="mb-4 inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1"
      >
        {TENDER_METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={m.value === method}
            onClick={() => {
              setMethod(m.value);
              setSelectedId(null);
            }}
            className={cn(
              "rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
              m.value === method
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div> : null}

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
        <section className="panel h-fit">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Danh sách mẫu</h2>
          </header>
          {templates.isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Đang tải…</p>
          ) : list.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Chưa có mẫu cho hình thức này"
              description="Tải lên file .docx để bắt đầu."
            />
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
          {isAdmin && current ? (
            <div className="border-b border-border bg-muted/30 px-4 py-3">
              <input
                ref={replaceInput}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleReplaceDocx(file);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                >
                  <Pencil className="size-3.5" />
                  Sửa thông tin mẫu
                </button>
                <button
                  type="button"
                  disabled={!current.source_docx_path}
                  onClick={() => setPicking(true)}
                  title={current.source_docx_path ? undefined : "Mẫu này chưa có tệp Word gốc"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <MousePointerClick className="size-3.5" />
                  Định nghĩa vùng dữ liệu
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => replaceInput.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {busy === "replace" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Thay file Word
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!current.source_docx_path || rows.length === 0}
                  onClick={() => setDetecting(true)}
                >
                  <FileSearch />
                  Quét file hoàn chỉnh
                </Button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void handleDeleteTemplate()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                >
                  {busy === "delete" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Xoá mẫu
                </button>
              </div>

              {editing ? (
                <div className="mt-3 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label="Tên mẫu"
                      placeholder="Tên mẫu"
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                    />
                    <input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      aria-label="Mô tả mẫu"
                      placeholder="Mô tả"
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                    />
                    {module === "tender" ? <select
                      value={editMethod}
                      onChange={(e) => setEditMethod(e.target.value as TenderMethod)}
                      aria-label="Hình thức lựa chọn nhà thầu"
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                    >
                      {TENDER_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveTemplateInfo()}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Lưu thông tin
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="rounded-md border border-input px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <header className="border-b border-border px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Ánh xạ dữ liệu</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Chỗ trống trong mẫu được nối với trường dữ liệu nguồn. Để trống ô giá trị nếu
                  muốn dùng dữ liệu tự động từ hồ sơ đã xác nhận.
                </p>
              </div>
              {isAdmin ? (
                <button
                  type="button"
                  disabled={!currentId}
                  onClick={() => setAdding((v) => !v)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <Plus className="size-3.5" />
                  Thêm chỗ trống
                </button>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3.5" />
                  {ADMIN_ONLY_NOTE}
                </span>
              )}
            </div>
            {current?.description ? (
              <p className="mt-1 text-xs italic text-muted-foreground">{current.description}</p>
            ) : null}
          </header>

          {adding && isAdmin ? (
            <div className="space-y-2 border-b border-border bg-muted/40 px-4 py-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  value={newPlaceholder}
                  onChange={(e) => setNewPlaceholder(e.target.value)}
                  placeholder="TEN_GOI_THAU"
                  aria-label="Tên chỗ trống"
                  className="num rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Nhãn hiển thị"
                  aria-label="Nhãn hiển thị"
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
                <select
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  aria-label="Trường nguồn"
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                >
                  <option value="">Nhập tay</option>
                  {sourceFields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label} ({f.key})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleAddMapping()}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Lưu chỗ trống
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                >
                  Huỷ
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Chèn đúng {`${wrap[0]}${newPlaceholder.trim() || "TEN_GOI_THAU"}${wrap[1]}`} (hoặc{" "}
                {`[[${newPlaceholder.trim() || "TEN_GOI_THAU"}]]`} tuỳ mẫu) vào nội dung file Word
                rồi tải lại để xuất chính xác.
              </p>
            </div>
          ) : null}

          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Chỗ trống</th>
                  <th className="px-4 py-2.5 font-medium">Trường nguồn</th>
                  <th className="px-4 py-2.5 font-medium">Giá trị</th>
                  {isAdmin ? <th className="px-2 py-2.5" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((m) => (
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
                        readOnly={!isAdmin}
                        title={isAdmin ? undefined : ADMIN_ONLY_NOTE}
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
                    {isAdmin ? (
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          aria-label={`Xoá chỗ trống ${m.placeholder}`}
                          onClick={() => void handleDeleteMapping(m.id)}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 4 : 3}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      Mẫu này chưa khai báo chỗ trống nào.
                      {isAdmin ? ' Bấm "Thêm chỗ trống" để khai báo thủ công.' : ""}
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
            {!current ? (
              <p className="text-sm text-muted-foreground">Chọn một mẫu để xem trước.</p>
            ) : current.body ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {renderPreview(current.body, resolved)}
              </pre>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Mẫu này là tệp Word tải lên. Mở bản xem trước để đọc nội dung và bôi đen từng
                  vùng cần điền dữ liệu.
                </p>
                <button
                  type="button"
                  disabled={!current.source_docx_path || !isAdmin}
                  onClick={() => setPicking(true)}
                  title={isAdmin ? undefined : ADMIN_ONLY_NOTE}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <MousePointerClick className="size-4" />
                  Mở bản xem trước
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {picking && isAdmin && current?.source_docx_path ? (
        <TemplateRegionPicker
          templateId={current.id}
          templateName={current.name}
          storagePath={current.source_docx_path}
          style={(current.delimiter_style as DelimiterStyle) ?? "curly"}
          module={module}
          onClose={() => setPicking(false)}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ["template_mappings", current.id] });
          }}
        />
      ) : null}
      {detecting && current?.source_docx_path ? (
        <TemplateAutoDetect
          storagePath={current.source_docx_path}
          mappings={rows}
          onClose={() => setDetecting(false)}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ["template_mappings", current.id] })}
        />
      ) : null}
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

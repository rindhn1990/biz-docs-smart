import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileText, Loader2, Plus, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { DocsTabs } from "@/components/DocsTabs";
import { EmptyState } from "@/components/EmptyState";
import { FieldGroupEditor, type FieldRow } from "@/components/FieldGroupEditor";
import { ScanFileDialog } from "@/components/ScanFileDialog";
import { DocxPreviewDialog } from "@/components/DocxPreviewDialog";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KHLCNT_FIELDS, KHLCNT_FIELD_KEYS, KHLCNT_GROUPS } from "@/lib/khlcnt";
import { DEFAULT_METHOD, TENDER_METHODS, type TenderMethod } from "@/lib/methods";
import { renderAndDownloadDocx, type DelimiterStyle } from "@/lib/docx";
import { recordExport } from "@/lib/export-history";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ho-so-dau-thau/du-lieu")({
  validateSearch: (search: Record<string, unknown>) => ({
    doc: typeof search["doc"] === "string" ? (search["doc"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Dữ liệu hồ sơ đấu thầu — OfficeFlow" },
      {
        name: "description",
        content:
          "Bảng dữ liệu tổng hợp đã quét từ hồ sơ đấu thầu: xem, sửa các trường theo nhóm và xuất văn bản Word theo hình thức lựa chọn nhà thầu.",
      },
      { property: "og:title", content: "Dữ liệu hồ sơ đấu thầu — OfficeFlow" },
      {
        property: "og:description",
        content: "Tổng hợp dữ liệu quét được của từng hồ sơ và xuất văn bản Word tương ứng.",
      },
    ],
  }),
  component: DataPage,
});

function DataPage() {
  const { doc } = Route.useSearch();
  const { canWrite, isAdmin, user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [docId, setDocId] = useState<string | null>(null);
  const [method, setMethod] = useState<TenderMethod>(DEFAULT_METHOD);
  const [exporting, setExporting] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newGroup, setNewGroup] = useState<string>(KHLCNT_GROUPS[0]);
  const [scanning, setScanning] = useState(false);
  const [resetAsk, setResetAsk] = useState<string | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  /** Nhóm lớn do quản trị viên tự tạo, giữ lại đến khi có trường đầu tiên. */
  const [extraGroups, setExtraGroups] = useState<string[]>([]);
  const [preview, setPreview] = useState<{
    templateId: string;
    title: string;
    fileName: string;
    source: ArrayBuffer;
    style: DelimiterStyle;
    data: Record<string, string>;
  } | null>(null);

  const docs = useQuery({
    queryKey: ["data_documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id,file_name,status,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const list = docs.data ?? [];
  const fromUrl = doc && list.some((d) => d.id === doc) ? doc : null;
  const currentId = docId ?? fromUrl ?? list[0]?.id ?? null;

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

  /** Trường do quản trị viên tự khai báo thêm trên các mẫu Word (ngoài bộ chuẩn). */
  const customFields = useQuery({
    queryKey: ["template_custom_fields"],
    queryFn: async () => {
      const { data: tpls } = await supabase
        .from("templates")
        .select("id")
        .eq("module", "tender");
      const ids = (tpls ?? []).map((t) => t.id);
      if (ids.length === 0) return [] as { key: string; label: string }[];
      const { data } = await supabase
        .from("template_mappings")
        .select("placeholder,label,template_id")
        .in("template_id", ids);
      const map = new Map<string, string>();
      for (const m of data ?? []) {
        if (KHLCNT_FIELD_KEYS.has(m.placeholder)) continue;
        if (!map.has(m.placeholder)) map.set(m.placeholder, m.label || m.placeholder);
      }
      return [...map.entries()].map(([key, label]) => ({ key, label }));
    },
  });

  /** Các trường chuẩn + trường tự khai báo trên mẫu, dùng để bổ sung vào hồ sơ. */
  const masterFields = useMemo(
    () => [
      ...KHLCNT_FIELDS.map((f) => ({ key: f.key, label: f.label, group: f.group as string })),
      ...(customFields.data ?? []).map((f) => ({
        key: f.key,
        label: f.label,
        group: "Khác" as string,
      })),
    ],
    [customFields.data],
  );

  const missingFields = useMemo(() => {
    const have = new Set(rows.map((f) => f.field_key));
    return masterFields.filter((f) => !have.has(f.key));
  }, [rows, masterFields]);

  /** Trường bị lặp key trong cùng hồ sơ (do nhiều lần trích xuất). */
  const duplicates = useMemo(() => {
    const seen = new Map<string, FieldRow[]>();
    for (const f of rows) {
      const list = seen.get(f.field_key);
      if (list) list.push(f);
      else seen.set(f.field_key, [f]);
    }
    return [...seen.values()].filter((l) => l.length > 1);
  }, [rows]);

  async function addMissingFields(items: { key: string; label: string; group: string }[]) {
    if (!currentId || items.length === 0) return;
    const { error } = await supabase.from("document_fields").insert(
      items.map((f, i) => ({
        document_id: currentId,
        field_key: f.key,
        label: f.label,
        value: null,
        confidence: 0.3,
        needs_review: true,
        field_group: f.group,
        sort_order: rows.length + i + 1,
      })),
    );
    if (error) {
      toast.error("Không bổ sung được trường", { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["document_fields", currentId] });
    toast.success(`Đã bổ sung ${items.length} trường dữ liệu`);
  }

  /** Giữ lại bản đầy đủ nhất, xoá các bản trùng còn lại. */
  async function removeDuplicates() {
    const drop: string[] = [];
    for (const group of duplicates) {
      const keep = [...group].sort(
        (a, b) => (b.value ? 1 : 0) - (a.value ? 1 : 0) || a.sort_order - b.sort_order,
      )[0]!;
      for (const f of group) if (f.id !== keep.id) drop.push(f.id);
    }
    if (drop.length === 0) return;
    const { error } = await supabase.from("document_fields").delete().in("id", drop);
    if (error) {
      toast.error("Không xoá được trường trùng", { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["document_fields", currentId] });
    toast.success(`Đã gộp ${drop.length} trường bị trùng`);
  }

  async function addManualField() {
    if (!currentId) return;
    const key = newKey.trim().replace(/^[[{]+|[\]}]+$/g, "");
    if (!/^[A-Za-z0-9_]+$/.test(key)) {
      toast.error("Mã trường chỉ gồm chữ, số và dấu gạch dưới");
      return;
    }
    if (rows.some((r) => r.field_key === key)) {
      toast.error("Trường này đã có trong hồ sơ");
      return;
    }
    await addMissingFields([{ key, label: newLabel.trim() || key, group: newGroup }]);
    setNewKey("");
    setNewLabel("");
    setAdding(false);
  }

  /** Danh sách nhóm lớn: bộ chuẩn + nhóm đang có trong hồ sơ + nhóm vừa tạo tay. */
  const groupOptions = useMemo(() => {
    const list: string[] = [...KHLCNT_GROUPS];
    for (const r of rows) if (r.field_group && !list.includes(r.field_group)) list.push(r.field_group);
    for (const g of extraGroups) if (!list.includes(g)) list.push(g);
    return list;
  }, [rows, extraGroups]);

  function addGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    if (groupOptions.includes(name)) {
      toast.error("Nhóm này đã có trong danh sách");
      return;
    }
    setExtraGroups((prev) => [...prev, name]);
    setNewGroupName("");
    setAddingGroup(false);
    setNewGroup(name);
    setAdding(true);
    toast.success(`Đã thêm nhóm "${name}"`, {
      description: "Hãy thêm ít nhất một trường vào nhóm để nhóm hiển thị trong bảng dữ liệu.",
    });
  }

  async function renameGroup(oldName: string, nextName: string) {
    if (!currentId) return;
    const { error } = await supabase
      .from("document_fields")
      .update({ field_group: nextName })
      .eq("document_id", currentId)
      .eq("field_group", oldName);
    if (error) {
      toast.error("Không đổi được tên nhóm", { description: error.message });
      return;
    }
    setExtraGroups((prev) => prev.map((g) => (g === oldName ? nextName : g)));
    await queryClient.invalidateQueries({ queryKey: ["document_fields", currentId] });
    toast.success(`Đã đổi tên nhóm thành "${nextName}"`);
  }

  async function deleteGroup(name: string, count: number) {
    if (!currentId) return;
    const { error } = await supabase
      .from("document_fields")
      .delete()
      .eq("document_id", currentId)
      .eq("field_group", name);
    if (error) {
      toast.error("Không xoá được nhóm", { description: error.message });
      return;
    }
    setExtraGroups((prev) => prev.filter((g) => g !== name));
    await queryClient.invalidateQueries({ queryKey: ["document_fields", currentId] });
    toast.success(`Đã xoá nhóm "${name}" cùng ${count} trường dữ liệu`);
  }



  /** Hồ sơ cũ chỉ có một phần trường: tự bổ sung một lần, sau đó tôn trọng thao tác xoá tay. */
  useEffect(() => {
    if (!currentId || !canWrite || fields.isLoading || rows.length === 0) return;
    if (customFields.isLoading) return;
    const mark = `officeflow:backfilled:${currentId}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(mark)) return;
    if (missingFields.length === 0) {
      window.localStorage.setItem(mark, "1");
      return;
    }
    window.localStorage.setItem(mark, "1");
    void addMissingFields(missingFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, canWrite, fields.isLoading, customFields.isLoading, missingFields.length]);

  type Template = {
    id: string;
    name: string;
    source_docx_path: string | null;
    delimiter_style: string | null;
  };

  /** Tải mẫu gốc và ghép dữ liệu hồ sơ — dùng chung cho xem trước và tải xuống. */
  async function prepare(tpl: Template) {
    if (!tpl.source_docx_path) {
      throw new Error("Mẫu này chưa có tệp Word gốc. Hãy tải lên tệp .docx trong trang Mẫu văn bản.");
    }
    const { data: mappings } = await supabase
      .from("template_mappings")
      .select("placeholder,source_field,value")
      .eq("template_id", tpl.id);

    const byKey: Record<string, string> = {};
    for (const f of rows) if (f.value) byKey[f.field_key] = f.value;

    /** Dữ liệu của hồ sơ đang chọn được ưu tiên; ánh xạ tay chỉ dùng khi hồ sơ trống. */
    const values: Record<string, string> = {};
    for (const m of mappings ?? []) {
      const fromDoc = (m.source_field ? byKey[m.source_field] : byKey[m.placeholder])?.trim();
      values[m.placeholder] = fromDoc || (m.value?.trim() ?? "");
    }
    for (const key of Object.keys(byKey)) values[key] ??= byKey[key]!;

    const { data, error } = await supabase.storage.from("templates").download(tpl.source_docx_path);
    if (error) throw error;
    return {
      source: await data.arrayBuffer(),
      style: (tpl.delimiter_style as DelimiterStyle) ?? "curly",
      data: values,
      fileName: `${tpl.name}.docx`,
    };
  }

  /** Ghi lịch sử mỗi lần xuất và hỏi người dùng có làm mới biểu mẫu không. */
  async function afterExport(tpl: Template, ready: { fileName: string; data: Record<string, string> }) {
    await recordExport({
      fileName: ready.fileName,
      module: "tender",
      data: ready.data,
      documentId: currentId,
      templateId: tpl.id,
      templateName: tpl.name,
      userId: user?.id ?? null,
      userEmail: profile?.email ?? user?.email ?? null,
    });
    void queryClient.invalidateQueries({ queryKey: ["export_history"] });
    if (canWrite && rows.some((r) => r.value)) setResetAsk(ready.fileName);
  }

  async function exportTemplate(tpl: Template) {
    setExporting(tpl.id);
    try {
      const ready = await prepare(tpl);
      await renderAndDownloadDocx(ready.source, ready.style, ready.data, ready.fileName);
      toast.success("Đã xuất file Word", { description: ready.fileName });
      await afterExport(tpl, ready);
    } catch (e) {
      toast.error("Không xuất được file", { description: (e as Error).message });
    } finally {
      setExporting(null);
    }
  }

  async function previewTemplate(tpl: Template) {
    setExporting(tpl.id);
    try {
      const ready = await prepare(tpl);
      setPreview({ templateId: tpl.id, title: tpl.name, ...ready });
    } catch (e) {
      toast.error("Không xem trước được", { description: (e as Error).message });
    } finally {
      setExporting(null);
    }
  }

  /** Đưa toàn bộ giá trị của hồ sơ về trống để chuẩn bị nhập hồ sơ mới. */
  async function resetForm() {
    if (!currentId) return;
    const { error } = await supabase
      .from("document_fields")
      .update({ value: null })
      .eq("document_id", currentId);
    if (error) {
      toast.error("Không làm mới được biểu mẫu", { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["document_fields", currentId] });
    toast.success("Đã làm mới biểu mẫu", {
      description: "Dữ liệu vừa xuất vẫn được lưu trong Lịch sử xuất file.",
    });
  }

  /** Điền giá trị quét được từ ảnh/PDF vào các trường của hồ sơ đang mở. */
  async function applyScanned(values: Record<string, string>) {
    if (!currentId) return;
    const updates = rows.filter((r) => values[r.field_key]?.trim());
    if (updates.length === 0) {
      toast.info("Không có trường nào được điền thêm");
      return;
    }
    for (const row of updates) {
      const { error } = await supabase
        .from("document_fields")
        .update({ value: values[row.field_key]!.trim(), needs_review: true })
        .eq("id", row.id);
      if (error) {
        toast.error("Không lưu được dữ liệu quét", { description: error.message });
        return;
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["document_fields", currentId] });
    toast.success(`Đã điền ${updates.length} trường từ tệp`, {
      description: "Hãy kiểm tra lại trước khi xác nhận.",
    });
  }


  return (
    <div>
      <PageHeader
        title="Dữ liệu"
        description="Toàn bộ dữ liệu máy đọc được của một hồ sơ, gom theo nhóm để đối chiếu và sửa nhanh, sau đó xuất thẳng ra văn bản Word."
        actions={
          <select
            value={currentId ?? ""}
            onChange={(e) => setDocId(e.target.value)}
            className="min-w-[260px] rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          >
            {list.length === 0 ? <option value="">Chưa có hồ sơ nào</option> : null}
            {list.map((d) => (
              <option key={d.id} value={d.id}>
                {d.file_name} · {new Date(d.created_at).toLocaleDateString("vi-VN")}
                {d.status === "approved" ? " · đã duyệt" : ""}
              </option>
            ))}
          </select>
        }
      />
      <DocsTabs />

      {list.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Chưa có hồ sơ nào"
          description="Hãy tải lên một hồ sơ ở tab Danh sách hồ sơ để xem dữ liệu tổng hợp tại đây."
        />
      ) : (
        <div className="space-y-4">
          <section className="panel">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Dữ liệu hồ sơ ({rows.length} trường)</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Mọi chỉnh sửa được lưu ngay khi bạn rời khỏi ô nhập và dùng luôn cho phần xuất văn
                bản bên dưới. Bạn có thể đổi tên, xoá từng trường hoặc thêm trường mới.
              </p>
              {canWrite ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdding((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                  >
                    <Plus className="size-3.5" />
                    Thêm trường
                  </button>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setAddingGroup((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                    >
                      <Plus className="size-3.5" />
                      Thêm nhóm
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setScanning(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                  >
                    <ScanLine className="size-3.5" />
                    Quét từ ảnh / PDF / Word
                  </button>
                  {missingFields.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => void addMissingFields(missingFields)}
                      className="rounded-md border border-input px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                    >
                      Bổ sung {missingFields.length} trường từ mẫu
                    </button>
                  ) : null}
                  {duplicates.length > 0 && isAdmin ? (
                    <ConfirmDelete
                      title={`Gộp ${duplicates.length} trường bị trùng?`}
                      description="Hệ thống giữ lại bản có dữ liệu đầy đủ nhất và xoá các bản trùng còn lại."
                      confirmLabel="Gộp và xoá"
                      onConfirm={removeDuplicates}
                    >
                      <button
                        type="button"
                        className="rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                      >
                        Gộp {duplicates.length} trường bị trùng
                      </button>
                    </ConfirmDelete>
                  ) : null}
                </div>
              ) : null}
              {adding && canWrite ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <input
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    aria-label="Mã trường"
                    placeholder="Ma_truong"
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                  />
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    aria-label="Tên hiển thị"
                    placeholder="Tên hiển thị"
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                  />
                  <select
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
                    aria-label="Nhóm dữ liệu"
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                  >
                    {KHLCNT_GROUPS.map((g, i) => (
                      <option key={g} value={g}>
                        {i + 1}. {g}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void addManualField()}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Lưu trường
                  </button>
                </div>
              ) : null}
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
                        onClick={() => void previewTemplate(t)}
                        className="inline-flex items-center gap-2 rounded-md border border-input px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        <Eye className="size-4" />
                        Xem trước
                      </button>
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

      {scanning && currentId ? (
        <ScanFileDialog
          title="Quét dữ liệu từ ảnh chụp / PDF / Word"
          description="Chọn ảnh chụp, bản PDF hoặc tệp Word của hồ sơ; hệ thống đọc và đề xuất giá trị cho các trường bên dưới."
          fields={rows.map((r) => ({ key: r.field_key, label: r.label }))}
          onClose={() => setScanning(false)}
          onApply={(v) => void applyScanned(v)}
        />
      ) : null}

      {preview ? (
        <DocxPreviewDialog
          title={preview.title}
          fileName={preview.fileName}
          source={preview.source}
          style={preview.style}
          data={preview.data}
          onClose={() => setPreview(null)}
          onExported={() => {
            const tpl = (templates.data ?? []).find((t) => t.id === preview.templateId);
            if (tpl)
              void afterExport(tpl as Template, {
                fileName: preview.fileName,
                data: preview.data,
              });
          }}
        />
      ) : null}

      <AlertDialog open={resetAsk !== null} onOpenChange={(o) => !o && setResetAsk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đã xuất xong — làm mới biểu mẫu?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ ô dữ liệu của hồ sơ sẽ về trống để bạn nhập hồ sơ mới. Bản vừa xuất
              {resetAsk ? ` (${resetAsk})` : ""} đã được lưu trong Lịch sử xuất file nên không mất
              dữ liệu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ nguyên dữ liệu</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setResetAsk(null);
                void resetForm();
              }}
            >
              Làm mới biểu mẫu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

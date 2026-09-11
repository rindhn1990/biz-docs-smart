import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { STEP_STATUS } from "@/lib/tender";
import { renderAndDownloadDocx, renderDocxToHtml, type DelimiterStyle } from "@/lib/docx";

export const Route = createFileRoute("/_app/goi-thau/$tenderId/buoc/$stepId")({
  head: () => ({
    meta: [
      { title: "Soạn văn bản theo bước — OfficeFlow" },
      {
        name: "description",
        content:
          "Nhập dữ liệu cho một bước của gói thầu và xem trước ngay bản Word sẽ xuất ra, kèm cảnh báo các chỗ còn thiếu.",
      },
      { property: "og:title", content: "Soạn văn bản theo bước — OfficeFlow" },
      {
        property: "og:description",
        content: "Form dữ liệu bên trái, bản xem trước Word bên phải, xuất file chỉ với một nút.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StepEditor,
});

type Mapping = {
  id: string;
  placeholder: string;
  label: string;
  source_field: string | null;
  value: string | null;
  sort_order: number;
};

function StepEditor() {
  const { tenderId, stepId } = Route.useParams();
  const { canWrite, user } = useAuth();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [html, setHtml] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const step = useQuery({
    queryKey: ["tender_step", stepId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tender_steps")
        .select("*, templates(id,name,source_docx_path,delimiter_style)")
        .eq("id", stepId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const center = useQuery({
    queryKey: ["tender_data", tenderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tender_data")
        .select("data")
        .eq("tender_id", tenderId)
        .maybeSingle();
      if (error) throw error;
      return (data?.data ?? {}) as Record<string, string>;
    },
  });

  const templateId = step.data?.template_id ?? null;

  const mappings = useQuery({
    queryKey: ["template_mappings", templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("template_mappings")
        .select("id,placeholder,label,source_field,value,sort_order")
        .eq("template_id", templateId!)
        .order("sort_order");
      if (error) throw error;
      return data as Mapping[];
    },
  });

  /** Ưu tiên: dữ liệu đã nhập ở bước → dữ liệu chung của gói thầu → giá trị mặc định của mẫu. */
  const resolved = useMemo(() => {
    const stepData = (step.data?.data ?? {}) as Record<string, string>;
    const shared = center.data ?? {};
    const out: Record<string, string> = {};
    for (const m of mappings.data ?? []) {
      const key = m.placeholder;
      const fromShared = m.source_field ? shared[m.source_field] : shared[key];
      out[key] = stepData[key] || fromShared || m.value || "";
    }
    return out;
  }, [step.data, center.data, mappings.data]);

  useEffect(() => setValues(resolved), [resolved]);

  const missing = (mappings.data ?? []).filter((m) => !(values[m.placeholder] ?? "").trim());

  async function loadSource() {
    const tpl = step.data?.templates;
    if (!tpl?.source_docx_path) throw new Error("Bước này chưa gắn tệp Word mẫu");
    const { data, error } = await supabase.storage.from("templates").download(tpl.source_docx_path);
    if (error) throw error;
    return { buffer: await data.arrayBuffer(), tpl };
  }

  async function preview() {
    setPreviewing(true);
    try {
      const { buffer, tpl } = await loadSource();
      setHtml(
        await renderDocxToHtml(
          buffer,
          (tpl.delimiter_style as DelimiterStyle) ?? "curly",
          values,
        ),
      );
    } catch (e) {
      toast.error("Không xem trước được", { description: (e as Error).message });
    } finally {
      setPreviewing(false);
    }
  }

  // Tự dựng bản xem trước sau khi ngừng gõ.
  useEffect(() => {
    if (!step.data?.templates?.source_docx_path) return;
    const id = setTimeout(() => void preview(), 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, step.data?.templates?.source_docx_path]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("tender_steps")
      .update({
        data: values,
        status: step.data?.status === "approved" ? "approved" : "in_progress",
        updated_by: user?.id ?? null,
      })
      .eq("id", stepId);
    setSaving(false);
    if (error) {
      toast.error("Không lưu được", { description: error.message });
      return;
    }
    toast.success("Đã lưu dữ liệu của bước này");
    void queryClient.invalidateQueries({ queryKey: ["tender_step", stepId] });
    void queryClient.invalidateQueries({ queryKey: ["tender_steps", tenderId] });
  }

  async function approve() {
    const { error } = await supabase
      .from("tender_steps")
      .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user?.id ?? null })
      .eq("id", stepId);
    if (error) {
      toast.error("Không duyệt được bước", { description: error.message });
      return;
    }
    toast.success("Đã duyệt bước này");
    void queryClient.invalidateQueries({ queryKey: ["tender_step", stepId] });
    void queryClient.invalidateQueries({ queryKey: ["tender_steps", tenderId] });
    void queryClient.invalidateQueries({ queryKey: ["tender_cases"] });
  }

  async function exportDocx() {
    setExporting(true);
    try {
      const { buffer, tpl } = await loadSource();
      await renderAndDownloadDocx(
        buffer,
        (tpl.delimiter_style as DelimiterStyle) ?? "curly",
        values,
        `${step.data?.name ?? "Van_ban"}.docx`,
      );
      toast.success("Đã xuất file Word");
    } catch (e) {
      toast.error("Không xuất được file", { description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  }

  if (step.isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Đang tải…</p>;
  }
  if (!step.data) return <EmptyState title="Không tìm thấy bước này" />;

  return (
    <div>
      <Link
        to="/goi-thau/$tenderId"
        params={{ tenderId }}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Quay lại hồ sơ gói thầu
      </Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            Bước {step.data.sort_order}: {step.data.name}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {step.data.templates?.name
              ? `Mẫu Word: ${step.data.templates.name}`
              : "Bước này chưa gắn mẫu Word — hãy gắn mẫu ở mục Quy trình mẫu."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={STEP_STATUS[step.data.status]?.tone}>
            {STEP_STATUS[step.data.status]?.label ?? step.data.status}
          </StatusBadge>
          <button
            type="button"
            disabled={!canWrite || saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-md border border-input px-3.5 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Lưu
          </button>
          <button
            type="button"
            disabled={exporting || !step.data.templates?.source_docx_path}
            onClick={() => void exportDocx()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Xuất file Word
          </button>
          <button
            type="button"
            disabled={!canWrite || step.data.status === "approved"}
            onClick={() => void approve()}
            className="inline-flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3.5 py-2 text-sm font-medium text-success hover:bg-success/15 disabled:opacity-50"
          >
            <CheckCircle2 className="size-4" />
            Duyệt bước
          </button>
        </div>
      </div>

      {missing.length > 0 ? (
        <p className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
          <AlertTriangle className="mr-1.5 inline size-4" />
          Văn bản còn {missing.length} chỗ chưa có dữ liệu: {missing.map((m) => m.label).join(", ")}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Dữ liệu điền vào văn bản</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ô trống sẽ tự lấy dữ liệu chung của gói thầu; bạn có thể sửa riêng cho bước này.
            </p>
          </header>
          {(mappings.data ?? []).length === 0 ? (
            <EmptyState
              title="Bước này chưa có chỗ trống nào"
              description="Hãy gắn mẫu Word cho bước và định nghĩa vùng dữ liệu trong trang Mẫu văn bản."
            />
          ) : (
            <div className="max-h-[70vh] divide-y divide-border overflow-y-auto">
              {(mappings.data ?? []).map((m) => (
                <div key={m.id} className="px-4 py-3">
                  <label
                    htmlFor={m.id}
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    {m.label}
                  </label>
                  <input
                    id={m.id}
                    value={values[m.placeholder] ?? ""}
                    readOnly={!canWrite}
                    onChange={(e) => setValues({ ...values, [m.placeholder]: e.target.value })}
                    placeholder="Chưa có dữ liệu"
                    className="input read-only:bg-muted"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Bản xem trước</h2>
            <span className="text-xs text-muted-foreground">
              {previewing ? "Đang dựng lại…" : "Cập nhật theo dữ liệu bạn nhập"}
            </span>
          </header>
          <div className="max-h-[70vh] overflow-y-auto bg-muted/30 p-4">
            {html ? (
              <div
                className="docx-preview mx-auto max-w-[760px] rounded-md bg-background p-6 text-sm leading-relaxed shadow-sm [&_p]:mb-2 [&_table]:w-full [&_table_td]:border [&_table_td]:border-border [&_table_td]:p-1.5"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {step.data.templates?.source_docx_path
                  ? "Đang chuẩn bị bản xem trước…"
                  : "Chưa có mẫu Word để xem trước."}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

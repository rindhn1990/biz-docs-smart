import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import { DocStepper } from "@/components/DocStepper";
import { formatFileSize } from "@/lib/format";

export const Route = createFileRoute("/_app/ho-so-dau-thau/$documentId")({
  head: () => ({
    meta: [
      { title: "Kiểm tra dữ liệu hồ sơ — OfficeFlow" },
      {
        name: "description",
        content:
          "Đối chiếu từng trường dữ liệu máy đọc được với bản scan gốc, chỉnh sửa và xác nhận trước khi lưu vào hồ sơ chính thức.",
      },
      { property: "og:title", content: "Kiểm tra dữ liệu hồ sơ — OfficeFlow" },
      {
        property: "og:description",
        content: "Màn hình đối chiếu dữ liệu trích xuất với tài liệu gốc trước khi xác nhận.",
      },
    ],
  }),
  component: ReviewPage,
});

type FieldRow = {
  id: string;
  document_id: string;
  field_key: string;
  label: string;
  value: string | null;
  confidence: number;
  needs_review: boolean;
  source_page: number | null;
  bbox_top: number | null;
  bbox_left: number | null;
  bbox_width: number | null;
  bbox_height: number | null;
  sort_order: number;
  field_group: string | null;
};

function confidenceStyle(c: number) {
  const pct = Math.round(c * 100);
  if (pct >= 95)
    return { pct, cls: "border-success/30 bg-success/10 text-success", warn: false } as const;
  if (pct >= 85)
    return {
      pct,
      cls: "border-warning/45 bg-warning/18 text-warning-foreground",
      warn: false,
    } as const;
  return {
    pct,
    cls: "border-destructive/40 bg-destructive/12 text-destructive",
    warn: true,
  } as const;
}

function ReviewPage() {
  const { documentId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, canWrite } = useAuth();
  const [activeField, setActiveField] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);

  const doc = useQuery({
    queryKey: ["document", documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, tenders(code,name), contracts(contract_number)")
        .eq("id", documentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const fields = useQuery({
    queryKey: ["document_fields", documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_fields")
        .select("*")
        .eq("document_id", documentId)
        .order("sort_order");
      if (error) throw error;
      return data as FieldRow[];
    },
  });

  const approve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("documents")
        .update({ status: "approved", updated_by: user?.id ?? null })
        .eq("id", documentId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Đã xác nhận và lưu hồ sơ");
      void navigate({ to: "/ho-so-dau-thau" });
    },
    onError: (e: Error) => toast.error("Không lưu được hồ sơ", { description: e.message }),
  });

  const rows = fields.data ?? [];
  const activeBox = useMemo(
    () => rows.find((f) => f.id === activeField) ?? null,
    [rows, activeField],
  );
  const lowConfidence = rows.filter((f) => Math.round(f.confidence * 100) < 85).length;

  if (doc.isLoading || fields.isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Đang tải hồ sơ…</p>;
  }
  if (!doc.data) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Không tìm thấy hồ sơ này.</p>
        <button
          onClick={() => void navigate({ to: "/ho-so-dau-thau" })}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            onClick={() => void navigate({ to: "/ho-so-dau-thau" })}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Danh sách hồ sơ
          </button>
          <h1 className="flex items-center gap-2 truncate text-xl font-semibold">
            <FileTypeIcon
              mime={doc.data.mime_type}
              name={doc.data.file_name}
              pageCount={doc.data.page_count}
            />
            <span className="truncate">{doc.data.file_name}</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {doc.data.page_count ?? "—"} trang · {formatFileSize(doc.data.file_size)}
            {doc.data.contracts?.contract_number
              ? ` · Hợp đồng ${doc.data.contracts.contract_number}`
              : ""}
            {doc.data.tenders?.code ? ` · Gói thầu ${doc.data.tenders.code}` : ""}
          </p>
        </div>
        <DocStepper status={doc.data.status} />
      </div>

      {rejected ? (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Hồ sơ đã được đánh dấu từ chối trên màn hình. Bấm “Xác nhận &amp; lưu hồ sơ” nếu bạn muốn
          duyệt lại.
        </p>
      ) : lowConfidence > 0 ? (
        <p className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
          Có {lowConfidence} trường độ tin cậy thấp cần bạn xác minh trước khi lưu.
        </p>
      ) : null}

      <div className="grid flex-1 gap-4 lg:grid-cols-2">
        {/* Bản scan minh hoạ */}
        <section className="panel p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bản scan tài liệu {activeBox?.source_page ? `· trang ${activeBox.source_page}` : ""}
          </p>
          <div className="relative aspect-[1/1.414] w-full overflow-hidden rounded-md border border-border bg-card p-[6%] shadow-[var(--shadow-raised)]">
            <ScanMock />
            {activeBox && activeBox.bbox_top !== null ? (
              <span
                className="pointer-events-none absolute rounded-sm border-2 border-warning bg-warning/25 transition-all duration-200"
                style={{
                  top: `${activeBox.bbox_top}%`,
                  left: `${activeBox.bbox_left ?? 0}%`,
                  width: `${activeBox.bbox_width ?? 0}%`,
                  height: `${activeBox.bbox_height ?? 0}%`,
                }}
              />
            ) : null}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Di chuột hoặc bấm vào một trường bên phải để xem vị trí tương ứng trên tài liệu.
          </p>
        </section>

        {/* Danh sách trường */}
        <section className="panel flex flex-col">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Dữ liệu trích xuất ({rows.length} trường)</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Mọi chỉnh sửa được lưu ngay khi bạn rời khỏi ô nhập.
            </p>
          </header>

          <div className="flex-1 divide-y divide-border overflow-y-auto">
            {rows.map((field) => (
              <FieldRowEditor
                key={field.id}
                field={field}
                active={activeField === field.id}
                readOnly={!canWrite}
                onFocusField={() => setActiveField(field.id)}
              />
            ))}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={() => setRejected((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <X className="size-4" />
              Từ chối
            </button>
            <button
              type="button"
              disabled={!canWrite || approve.isPending}
              onClick={() => approve.mutate()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {approve.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Xác nhận &amp; lưu hồ sơ
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}

function FieldRowEditor({
  field,
  active,
  readOnly,
  onFocusField,
}: {
  field: FieldRow;
  active: boolean;
  readOnly: boolean;
  onFocusField: () => void;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(field.value ?? "");
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conf = confidenceStyle(Number(field.confidence));

  useEffect(() => setValue(field.value ?? ""), [field.value]);

  const save = async (next: string) => {
    if ((field.value ?? "") === next) return;
    setSaving(true);
    const { error } = await supabase
      .from("document_fields")
      .update({ value: next || null })
      .eq("id", field.id);
    setSaving(false);
    if (error) {
      toast.error("Không lưu được thay đổi", { description: error.message });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["document_fields", field.document_id] });
  };

  return (
    <div
      onMouseEnter={onFocusField}
      onClick={onFocusField}
      className={`px-4 py-3 transition-colors ${active ? "bg-accent/70" : "hover:bg-accent/40"}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={field.id} className="text-xs font-medium text-muted-foreground">
          {field.label}
        </label>
        <span className="flex items-center gap-1.5">
          {saving ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${conf.cls}`}
          >
            {conf.pct}%{conf.warn ? " · Cần xác minh" : ""}
          </span>
        </span>
      </div>
      <input
        id={field.id}
        value={value}
        readOnly={readOnly}
        placeholder={conf.warn ? "Chưa đọc được — vui lòng nhập tay" : "—"}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void save(next), 800);
        }}
        onFocus={onFocusField}
        onBlur={() => {
          if (timer.current) clearTimeout(timer.current);
          void save(value);
        }}
        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30 read-only:bg-muted"
      />
    </div>
  );
}

/** Khối minh hoạ trang tài liệu scan bằng các dòng kẻ ngang. */
function ScanMock() {
  const lines = [
    "w-2/5 mx-auto",
    "w-1/3 mx-auto",
    "h-2",
    "w-1/2 mx-auto mt-4",
    "w-1/4 mx-auto",
    "h-2",
    "w-full",
    "w-11/12",
    "w-4/5",
    "h-2",
    "w-full",
    "w-10/12",
    "w-3/4",
    "h-2",
    "w-full",
    "w-2/3",
    "h-2",
    "w-11/12",
    "w-1/2",
    "h-2",
    "w-5/6",
    "w-3/5",
  ];
  return (
    <div className="flex h-full flex-col gap-2">
      {lines.map((cls, i) => (
        <span
          key={i}
          className={`block h-2 rounded-sm ${cls.includes("h-2") && cls === "h-2" ? "bg-transparent" : "bg-muted"} ${cls}`}
        />
      ))}
    </div>
  );
}

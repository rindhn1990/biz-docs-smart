import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { DocsTabs } from "@/components/DocsTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { DocStepper } from "@/components/DocStepper";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DOC_STATUS } from "@/lib/domain";
import { KHLCNT_DOC_TYPE, KHLCNT_FIELDS, TENDER_DOC_TYPES } from "@/lib/khlcnt";
import { formatDateTime } from "@/lib/format";
import { docxPlainText, matchLabeledValues } from "@/lib/docx";
import { toStorageKey } from "@/lib/utils";

export const Route = createFileRoute("/_app/ho-so-dau-thau/")({
  head: () => ({
    meta: [
      { title: "Hồ sơ đấu thầu — OfficeFlow" },
      {
        name: "description",
        content:
          "Danh sách hồ sơ đấu thầu với tiến trình xử lý: tải lên, nhận dạng, trích xuất dữ liệu, kiểm tra và xác nhận.",
      },
      { property: "og:title", content: "Hồ sơ đấu thầu — OfficeFlow" },
      {
        property: "og:description",
        content: "Theo dõi tiến trình xử lý từng hồ sơ đấu thầu theo 5 bước.",
      },
    ],
  }),
  component: DocumentsPage,
});

const SAMPLE_FIELDS = [
  { key: "tender_code", label: "Mã gói thầu", value: "GT-2026-009", conf: 0.97, t: 14 },
  {
    key: "tender_name",
    label: "Tên gói thầu",
    value: "Cung cấp vật tư điện dự phòng quý III",
    conf: 0.94,
    t: 22,
  },
  {
    key: "investor",
    label: "Chủ đầu tư",
    value: "Tổng Công ty Điện lực Miền Bắc",
    conf: 0.96,
    t: 30,
  },
  { key: "package_value", label: "Giá gói thầu (VNĐ)", value: "8900000000", conf: 0.92, t: 38 },
  { key: "submit_deadline", label: "Hạn nộp hồ sơ", value: "", conf: 0.61, t: 46 },
  { key: "funding_source", label: "Nguồn vốn", value: "Vốn doanh nghiệp", conf: 0.89, t: 54 },
  { key: "duration", label: "Thời gian thực hiện", value: "60 ngày", conf: 0.83, t: 62 },
];

function useDocumentList() {
  return useQuery({
    queryKey: ["documents", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, tenders(code,name), document_fields(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function DocumentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, canWrite } = useAuth();
  const documents = useDocumentList();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [docType, setDocType] = useState<string>("ho_so_du_thau");
  const fileInput = useRef<HTMLInputElement>(null);

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      let completed = 0;
      for (const [fileIndex, file] of files.entries()) {
      const stamp = new Date();
      const seq = `${String(stamp.getTime()).slice(-5)}-${fileIndex + 1}`;
      const isKhlcnt = docType === KHLCNT_DOC_TYPE;
      const prefix = TENDER_DOC_TYPES[docType]?.filePrefix ?? "Ho_so_du_thau";
      const fileName = file.name || `${prefix}_${stamp.getFullYear()}_${seq}.pdf`;
      const storagePath = `uploads/${user?.id ?? "unknown"}/${stamp.getTime()}-${fileIndex}-${toStorageKey(fileName)}`;
      const isWord = /\.docx$/i.test(fileName);
      const scanned = isWord
        ? matchLabeledValues(
            docxPlainText(await file.arrayBuffer()),
            (isKhlcnt ? KHLCNT_FIELDS : SAMPLE_FIELDS).map((f) => ({ key: f.key, label: f.label })),
          )
        : {};
      const uploaded = await supabase.storage.from("documents").upload(storagePath, file);
      if (uploaded.error) throw uploaded.error;

      const { data: doc, error } = await supabase
        .from("documents")
        .insert({
          file_name: fileName,
          storage_path: storagePath,
          mime_type: file.type || "application/pdf",
          file_size: file.size,
          folder: isKhlcnt ? "01_To_trinh" : "02_Ho_so_du_thau",
          doc_type: docType,
          status: "new",
          page_count: isKhlcnt ? 3 : 12,
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      setProcessingId(doc.id);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });

      // Placeholder cho pipeline OCR/AI thật: chạy tuần tự qua từng bước.
      const steps = ["ocr_done", "extracted", "pending_review"] as const;
      for (const status of steps) {
        await wait(1000);
        await supabase.from("documents").update({ status }).eq("id", doc.id);

        if (status === "extracted") {
          const payload = isKhlcnt
            ? KHLCNT_FIELDS.map((f, i) => ({
                document_id: doc.id,
                field_key: f.key,
                label: f.label,
                value: f.value || null,
                confidence: f.conf,
                needs_review: f.conf < 0.85 || !f.value,
                field_group: f.group as string | null,
                source_page: 1,
                bbox_top: 14 + (i % 20) * 4,
                bbox_left: 10,
                bbox_width: 58,
                bbox_height: 4,
                sort_order: i + 1,
              }))
            : SAMPLE_FIELDS.map((f, i) => ({
                document_id: doc.id,
                field_key: f.key,
                label: f.label,
                value: f.value || null,
                confidence: f.conf,
                needs_review: f.conf < 0.85,
                field_group: null,
                source_page: 1,
                bbox_top: f.t,
                bbox_left: 10,
                bbox_width: 58,
                bbox_height: 4,
                sort_order: i + 1,
              }));
          // Với file Word, ưu tiên dữ liệu quét được thật từ nội dung tài liệu.
          const merged = payload.map((row) => {
            const hit = scanned[row.field_key];
            if (!hit) return row;
            return {
              ...row,
              value: hit.value,
              confidence: hit.confidence,
              needs_review: hit.confidence < 0.85,
            };
          });
          await supabase.from("document_fields").insert(merged);
        }
        void queryClient.invalidateQueries({ queryKey: ["documents"] });
      }

      setProcessingId(null);
      completed++;
      }
      return completed;
    },
    onSuccess: (count) => {
      toast.success(`Đã xử lý xong ${filesLabel(count)}`, {
        description: "Dữ liệu đang chờ bạn kiểm tra.",
      });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: Error) => {
      setProcessingId(null);
      toast.error("Không tải lên được hồ sơ", { description: e.message });
    },
  });

  const rows = documents.data ?? [];

  function filesLabel(count: number) {
    return `${count} hồ sơ`;
  }

  return (
    <div>
      <PageHeader
        title="Hồ sơ đấu thầu"
        description="Mỗi hồ sơ đi qua 5 bước: tải lên, nhận dạng, trích xuất dữ liệu, kiểm tra và xác nhận. Chọn một hồ sơ đã có dữ liệu để kiểm tra."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/*,.docx"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length) upload.mutate(files);
              }}
            />
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            >
              {Object.entries(TENDER_DOC_TYPES).map(([key, t]) => (
                <option key={key} value={key}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!canWrite || upload.isPending}
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {upload.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Tải lên nhiều tài liệu (PDF, ảnh, Word)
            </button>
          </div>
        }
      />
      <DocsTabs />


      {!canWrite ? (
        <p className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
          Tài khoản của bạn chỉ có quyền xem nên không thể tải lên hồ sơ mới.
        </p>
      ) : null}

      <div className="panel overflow-x-auto">
        {documents.isLoading ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Đang tải dữ liệu…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Chưa có hồ sơ nào"
            description="Bấm “Tải lên tài liệu” để tạo hồ sơ đầu tiên và xem toàn bộ tiến trình xử lý."
          />
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Tên tệp</th>
                <th className="px-4 py-3 font-medium">Gói thầu liên quan</th>
                <th className="px-4 py-3 font-medium">Ngày tải lên</th>
                <th className="px-4 py-3 font-medium">Tiến trình xử lý</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const hasFields = (row.document_fields?.length ?? 0) > 0;
                const busy = processingId === row.id;
                return (
                  <tr
                    key={row.id}
                    onClick={() => {
                      if (!hasFields) {
                        toast.info("Hồ sơ này chưa có dữ liệu trích xuất để kiểm tra.");
                        return;
                      }
                      void navigate({
                        to: "/ho-so-dau-thau/$documentId",
                        params: { documentId: row.id },
                      });
                    }}
                    className={`transition-colors ${hasFields ? "cursor-pointer hover:bg-accent/60" : "opacity-80"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileTypeIcon
                          mime={row.mime_type}
                          name={row.file_name}
                          pageCount={row.page_count}
                        />
                        <span className="max-w-[280px] truncate font-medium">{row.file_name}</span>
                      </div>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">
                      {row.tenders?.code ? `${row.tenders.code} · ${row.tenders.name}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <DocStepper status={row.status} />
                        {busy ? <Loader2 className="size-3.5 animate-spin text-primary" /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={DOC_STATUS[row.status]?.tone}>
                        {DOC_STATUS[row.status]?.label ?? row.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hasFields ? (
                        <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

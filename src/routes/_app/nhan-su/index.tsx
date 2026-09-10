import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { ModuleTabs } from "@/components/ModuleTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { DocStepper } from "@/components/DocStepper";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DOC_STATUS } from "@/lib/domain";
import { EMPLOYEE_DOC_TYPES, EMPLOYEE_SAMPLE_FIELDS, type EmployeeDocType } from "@/lib/hr";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/nhan-su/")({
  head: () => ({
    meta: [
      { title: "Hồ sơ nhân sự — OfficeFlow" },
      {
        name: "description",
        content:
          "Danh sách hồ sơ nhân sự: quyết định bổ nhiệm, căn cước công dân và bằng cấp, xử lý theo 5 bước từ tải lên đến xác nhận.",
      },
      { property: "og:title", content: "Hồ sơ nhân sự — OfficeFlow" },
      {
        property: "og:description",
        content: "Theo dõi tiến trình xử lý từng hồ sơ nhân sự theo 5 bước.",
      },
    ],
  }),
  component: EmployeeDocumentsPage,
});

function useEmployeeDocuments() {
  return useQuery({
    queryKey: ["employee_documents", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*, employees(full_name), employee_document_fields(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

const ROTATION: EmployeeDocType[] = ["quyet_dinh_bo_nhiem", "cccd", "bang_cap"];

function EmployeeDocumentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, canWrite } = useAuth();
  const documents = useEmployeeDocuments();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [docType, setDocType] = useState<EmployeeDocType>("cccd");

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const upload = useMutation({
    mutationFn: async () => {
      const stamp = new Date();
      const seq = String(stamp.getTime()).slice(-5);
      const type = EMPLOYEE_DOC_TYPES[docType];
      const fileName = `${type.filePrefix}_${stamp.getFullYear()}_${seq}.pdf`;

      const { data: doc, error } = await supabase
        .from("employee_documents")
        .insert({
          file_name: fileName,
          doc_type: docType,
          mime_type: "application/pdf",
          file_size: 940_000,
          page_count: 2,
          status: "new",
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      setProcessingId(doc.id);
      void queryClient.invalidateQueries({ queryKey: ["employee_documents"] });

      // Placeholder cho pipeline OCR/AI thật: chạy tuần tự qua từng bước.
      const steps = ["ocr_done", "extracted", "pending_review"] as const;
      for (const status of steps) {
        await wait(1000);
        await supabase.from("employee_documents").update({ status }).eq("id", doc.id);

        if (status === "extracted") {
          await supabase.from("employee_document_fields").insert(
            EMPLOYEE_SAMPLE_FIELDS[docType].map((f, i) => ({
              document_id: doc.id,
              field_key: f.key,
              label: f.label,
              value: f.value || null,
              confidence: f.conf,
              needs_review: f.conf < 0.85,
              source_page: 1,
              bbox_top: 14 + i * 8,
              bbox_left: 10,
              bbox_width: 55,
              bbox_height: 4,
              sort_order: i + 1,
            })),
          );
        }
        void queryClient.invalidateQueries({ queryKey: ["employee_documents"] });
      }

      setProcessingId(null);
      return doc.id;
    },
    onSuccess: () => {
      toast.success("Đã xử lý xong hồ sơ nhân sự", {
        description: "Dữ liệu đã được trích xuất và đang chờ bạn kiểm tra.",
      });
      void queryClient.invalidateQueries({ queryKey: ["employee_documents"] });
    },
    onError: (e: Error) => {
      setProcessingId(null);
      toast.error("Không tải lên được hồ sơ", { description: e.message });
    },
  });

  const rows = documents.data ?? [];

  return (
    <div>
      <PageHeader
        title="Hồ sơ nhân sự"
        description="Quyết định bổ nhiệm, căn cước công dân và bằng cấp đi qua đúng 5 bước như hồ sơ đấu thầu. Chọn một hồ sơ đã có dữ liệu để kiểm tra."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as EmployeeDocType)}
              className="rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            >
              {ROTATION.map((key) => (
                <option key={key} value={key}>
                  {EMPLOYEE_DOC_TYPES[key].label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!canWrite || upload.isPending}
              onClick={() => upload.mutate()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {upload.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Tải lên tài liệu nhân sự
            </button>
          </div>
        }
      />

      <ModuleTabs />

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
            title="Chưa có hồ sơ nhân sự nào"
            description="Bấm “Tải lên tài liệu nhân sự” để tạo hồ sơ đầu tiên và xem toàn bộ tiến trình xử lý."
          />
        ) : (
          <table className="w-full min-w-[940px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Tên tệp</th>
                <th className="px-4 py-3 font-medium">Loại tài liệu</th>
                <th className="px-4 py-3 font-medium">Nhân viên</th>
                <th className="px-4 py-3 font-medium">Ngày tải lên</th>
                <th className="px-4 py-3 font-medium">Tiến trình xử lý</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const hasFields = (row.employee_document_fields?.length ?? 0) > 0;
                const busy = processingId === row.id;
                const type = EMPLOYEE_DOC_TYPES[row.doc_type as EmployeeDocType];
                return (
                  <tr
                    key={row.id}
                    onClick={() => {
                      if (!hasFields) {
                        toast.info("Hồ sơ này chưa có dữ liệu trích xuất để kiểm tra.");
                        return;
                      }
                      void navigate({
                        to: "/nhan-su/$documentId",
                        params: { documentId: row.id },
                      });
                    }}
                    className={cn(
                      "transition-colors",
                      hasFields ? "cursor-pointer hover:bg-accent/60" : "opacity-80",
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileTypeIcon
                          mime={row.mime_type}
                          name={row.file_name}
                          pageCount={type?.scan ? row.page_count : null}
                        />
                        <span className="max-w-[260px] truncate font-medium">{row.file_name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {type?.label ?? row.doc_type}
                      <span className="ml-1 text-xs opacity-70">
                        {type?.scan ? "(scan)" : "(PDF)"}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                      {row.employees?.full_name ?? "Chưa gán nhân viên"}
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

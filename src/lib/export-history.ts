import { supabase } from "@/integrations/supabase/client";

export type ExportHistoryInput = {
  fileName: string;
  module: "tender" | "hr" | "payment";
  data: Record<string, string>;
  tenderId?: string | null;
  documentId?: string | null;
  templateId?: string | null;
  templateName?: string | null;
  userId?: string | null;
  userEmail?: string | null;
};

/**
 * Ghi lại một lần xuất văn bản: tên file, mẫu đã dùng, dữ liệu đã điền và người xuất.
 * Lỗi ghi lịch sử không được làm hỏng luồng tải file, nên chỉ báo nhẹ ra console.
 */
export async function recordExport(input: ExportHistoryInput) {
  const { error } = await supabase.from("export_history").insert({
    file_name: input.fileName,
    module: input.module,
    data: input.data,
    tender_id: input.tenderId ?? null,
    document_id: input.documentId ?? null,
    template_id: input.templateId ?? null,
    template_name: input.templateName ?? null,
    exported_by: input.userId ?? null,
    exported_by_email: input.userEmail ?? null,
    created_by: input.userId ?? null,
  });
  if (error) console.warn("Không ghi được lịch sử xuất file:", error.message);
}

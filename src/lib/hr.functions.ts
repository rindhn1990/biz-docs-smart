import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteHrEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; kind: "employee" | "document" }) => input)
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (roleError || !roles?.some((r) => r.role === "admin")) throw new Error("Chỉ quản trị viên được xoá nhân sự hoặc hồ sơ.");
    const { error } = await context.supabase.rpc("delete_hr_entity", { _id: data.id, _kind: data.kind });
    if (error) throw new Error(error.code === "23503" ? "Không thể xoá vì còn dữ liệu khác liên kết với nhân sự. Vui lòng kiểm tra liên kết trước khi xoá." : error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pending, error: pendingError } = await supabaseAdmin.from("hr_file_cleanup").select("id,storage_path");
    if (pendingError) return { cleanupPending: true };
    let cleanupPending = false;
    for (const file of pending ?? []) {
      // A shared original must not disappear from an unrelated record.
      const [hr, tender] = await Promise.all([
        supabaseAdmin.from("employee_documents").select("id", { count: "exact", head: true }).eq("storage_path", file.storage_path),
        supabaseAdmin.from("documents").select("id", { count: "exact", head: true }).eq("storage_path", file.storage_path),
      ]);
      if (hr.error || tender.error) { cleanupPending = true; continue; }
      if (!hr.count && !tender.count) {
        const { error: storageError } = await supabaseAdmin.storage.from("documents").remove([file.storage_path]);
        if (storageError) { cleanupPending = true; continue; }
      }
      const { error: queueError } = await supabaseAdmin.from("hr_file_cleanup").delete().eq("id", file.id);
      if (queueError) cleanupPending = true;
    }
    return { cleanupPending };
  });
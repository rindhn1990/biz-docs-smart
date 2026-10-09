import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadInheritedSources, moduleSourceFields, resolveSource } from "@/lib/template-resolve";

/**
 * Đếm vùng sẽ thực sự ra trống khi xuất: chưa có nguồn, không có giá trị cố định,
 * và không tự khớp tên/kế thừa nguồn được. Bấm để mở mẫu trong kho.
 */
export function TemplateMissingBadge({ templateId, module }: { templateId: string; module: "tender" | "hr" | "payment" }) {
  const q = useQuery({
    queryKey: ["template_mappings", "missing", templateId],
    queryFn: async () => {
      const [{ data, error }, inherited] = await Promise.all([
        supabase.from("template_mappings").select("placeholder,source_field,value").eq("template_id", templateId),
        loadInheritedSources(module),
      ]);
      if (error) throw error;
      const keys = moduleSourceFields(module).map((f) => f.key);
      return (data ?? []).filter(
        (m) => !m.source_field && !m.value?.trim() && !resolveSource(m, keys, inherited),
      ).length;
    },
  });
  const n = q.data ?? 0;
  if (n === 0) return null;
  return (
    <Link
      to="/mau-van-ban"
      search={{ module, tpl: templateId }}
      title="Mở mẫu để gán nguồn dữ liệu"
      className="mt-1 inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground hover:bg-warning/25"
    >
      <AlertTriangle className="size-3" />
      {n} vùng chưa có nguồn dữ liệu
    </Link>
  );
}

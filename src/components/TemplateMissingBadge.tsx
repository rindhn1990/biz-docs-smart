import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Đếm vùng "Nhập tay" chưa có giá trị trên một mẫu; bấm để mở mẫu trong kho. */
export function TemplateMissingBadge({ templateId, module }: { templateId: string; module: "tender" | "hr" | "payment" }) {
  const q = useQuery({
    queryKey: ["template_mappings", "missing", templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("template_mappings")
        .select("source_field,value")
        .eq("template_id", templateId);
      if (error) throw error;
      return (data ?? []).filter((m) => !m.source_field && !m.value?.trim()).length;
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

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { groupFieldExamples } from "@/lib/field-examples";
import type { TemplateModule } from "@/lib/template-resolve";

export function useFieldExamples(module?: TemplateModule) {
  return useQuery({
    queryKey: ["template_field_examples", module],
    enabled: !!module,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!module) return groupFieldExamples([]);
      const rows: { source_field: string | null; value: string | null }[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("template_mappings")
          .select("source_field,value,templates!inner(module)")
          .eq("templates.module", module)
          .not("source_field", "is", null)
          .order("updated_at", { ascending: false }).order("id")
          .range(offset, offset + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      return groupFieldExamples(rows);
    },
  });
}
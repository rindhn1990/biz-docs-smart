import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function useHrUnits() {
  return useQuery({ queryKey: ["hr_units"], queryFn: async () => {
    const { data, error } = await supabase.from("hr_unit_counts").select("*").order("sort_order").order("name");
    if (error) throw error;
    return (data ?? []).flatMap((unit) => {
      if (!unit.id || !unit.name) return [];
      return [{ ...unit, id: unit.id, name: unit.name, sort_order: unit.sort_order ?? 0, employee_count: unit.employee_count ?? 0 }];
    });
  } });
}

export function useHrCounts() {
  return useQuery({ queryKey: ["hr_counts"], queryFn: async () => {
    const [all, none] = await Promise.all([
      supabase.from("employees").select("id", { count: "exact", head: true }),
      supabase.from("employees").select("id", { count: "exact", head: true }).is("unit_id", null),
    ]);
    if (all.error || none.error) throw all.error ?? none.error;
    return { all: all.count ?? 0, none: none.count ?? 0 };
  } });
}

export function useAssignHrUnit() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async ({ ids, unitId }: { ids: string[]; unitId: string | null }) => {
    const { error } = await supabase.from("employees").update({ unit_id: unitId }).in("id", ids);
    if (error) throw error;
  }, onSuccess: () => {
    void client.invalidateQueries({ predicate: (q) => /^(employee|hr_)/.test(String(q.queryKey[0])) });
    toast.success("Đã cập nhật đầu mục");
  }, onError: (e: Error) => toast.error("Không đổi được đầu mục", { description: e.message }) });
}
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { deleteHrEntity } from "@/lib/hr.functions";

export function HrDelete({ id, name, kind }: { id: string; name: string; kind: "employee" | "document" }) {
  const { isAdmin } = useAuth();
  const client = useQueryClient();
  const remove = useServerFn(deleteHrEntity);
  const counts = useQuery({
    queryKey: ["hr_delete_counts", kind, id], enabled: isAdmin && kind === "employee",
    queryFn: async () => {
      const [docs, contracts] = await Promise.all([
        supabase.from("employee_documents").select("id", { count: "exact", head: true }).eq("employee_id", id),
        supabase.from("employee_contracts").select("id", { count: "exact", head: true }).eq("employee_id", id),
      ]);
      if (docs.error || contracts.error) throw docs.error ?? contracts.error;
      return { docs: docs.count ?? 0, contracts: contracts.count ?? 0 };
    },
  });
  const mutation = useMutation({
    mutationFn: () => remove({ data: { id, kind } }),
    onSuccess: (result) => {
      void client.invalidateQueries({ predicate: (q) => /^(employee|hr_)/.test(String(q.queryKey[0])) });
      if (result.cleanupPending) toast.warning("Đã xoá dữ liệu; một số file đang chờ dọn lại khi thao tác xoá tiếp theo.");
      else toast.success(kind === "employee" ? "Đã xoá nhân sự và dữ liệu liên quan" : "Đã xoá hồ sơ và file gốc");
    },
    onError: (e: Error) => toast.error("Không thể xoá", { description: e.message }),
  });
  if (!isAdmin) return null;
  const description = kind === "employee"
    ? `Xoá ${name} cùng ${counts.data?.docs ?? 0} hồ sơ/tài liệu, toàn bộ trường trích xuất, file gốc và ${counts.data?.contracts ?? 0} hợp đồng lao động liên kết. Không thể hoàn tác.`
    : `Xoá hồ sơ ${name}, các trường trích xuất và file gốc. Không xoá nhân sự hay hợp đồng lao động. Không thể hoàn tác.`;
  return <span onClick={(e) => e.stopPropagation()}>
    <ConfirmDelete title={`Xoá ${name}?`} description={description} onConfirm={() => mutation.mutateAsync().then(() => undefined)}>
      <Button variant="ghost" size="icon" className="text-destructive" aria-label={`Xoá ${name}`} title={`Xoá ${name}`} disabled={mutation.isPending || (kind === "employee" && !counts.data)}><Trash2 className="size-4" /></Button>
    </ConfirmDelete>
  </span>;
}
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Dải nhắc việc động: đếm nhanh những thứ đang chờ người dùng xử lý. */
export function ReminderBanner() {
  const reminders = useQuery({
    queryKey: ["reminders"],
    staleTime: 60_000,
    queryFn: async () => {
      const [steps, docs, contracts] = await Promise.all([
        supabase
          .from("tender_steps")
          .select("id", { count: "exact", head: true })
          .neq("status", "approved")
          .eq("required", true),
        supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending_review"),
        supabase
          .from("contracts")
          .select("id", { count: "exact", head: true })
          .in("status", ["expiring", "expired"]),
      ]);
      return {
        steps: steps.count ?? 0,
        docs: docs.count ?? 0,
        contracts: contracts.count ?? 0,
      };
    },
  });

  const d = reminders.data;
  if (!d) return null;

  const items: { text: string; to: string }[] = [];
  if (d.steps > 0)
    items.push({ text: `Còn ${d.steps} bước hồ sơ thầu chưa được duyệt.`, to: "/goi-thau" });
  if (d.docs > 0)
    items.push({ text: `${d.docs} hồ sơ đang chờ bạn kiểm tra dữ liệu.`, to: "/ho-so-dau-thau" });
  if (d.contracts > 0)
    items.push({ text: `${d.contracts} hợp đồng sắp hết hạn hoặc đã quá hạn.`, to: "/hop-dong" });

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-warning/10 px-4 py-2 text-sm text-warning-foreground">
      <Bell className="size-4 shrink-0" />
      {items.map((item) => (
        <Link key={item.to} to={item.to} className="underline-offset-2 hover:underline">
          {item.text}
        </Link>
      ))}
    </div>
  );
}

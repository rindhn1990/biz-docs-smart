import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/format";

export function NotificationBell() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });

  const unread = (data ?? []).filter((n) => !n.read_at);

  const markAll = async () => {
    const ids = unread.map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unread.length > 0 ? (
            <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Thông báo</span>
          {unread.length ? (
            <button
              type="button"
              onClick={markAll}
              className="text-xs font-normal text-primary hover:underline"
            >
              Đánh dấu đã đọc
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(data ?? []).length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">Chưa có thông báo.</p>
        ) : (
          (data ?? []).map((n) => (
            <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5 whitespace-normal">
              <p className="text-sm font-medium">{n.title}</p>
              {n.body ? <p className="text-xs text-muted-foreground">{n.body}</p> : null}
              <p className="text-[11px] text-muted-foreground">{formatDateTime(n.created_at)}</p>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

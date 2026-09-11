import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ModuleTabs } from "@/components/ModuleTabs";
import { EmptyState } from "@/components/EmptyState";
import { DeadlineBadge, deadlineLevel } from "@/components/DeadlineBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { EMPLOYEE_CONTRACT_STATUS } from "@/lib/hr";
import { formatCurrency, formatDate, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/nhan-su/hop-dong")({
  head: () => ({
    meta: [
      { title: "Hợp đồng nhân sự — OfficeFlow" },
      {
        name: "description",
        content:
          "Theo dõi hợp đồng lao động của nhân viên với cảnh báo hạn theo số ngày còn lại và bộ lọc nhanh theo trạng thái.",
      },
      { property: "og:title", content: "Hợp đồng nhân sự — OfficeFlow" },
      {
        property: "og:description",
        content: "Quản lý hợp đồng lao động, loại hợp đồng và hạn kết thúc trong một bảng.",
      },
    ],
  }),
  component: EmployeeContractsPage,
});

const FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "active", label: "Đang hiệu lực" },
  { key: "soon", label: "Sắp hết hạn (≤30 ngày)" },
  { key: "expired", label: "Đã hết hạn" },
  { key: "done", label: "Đã hoàn thành" },
] as const;

function EmployeeContractsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const contracts = useQuery({
    queryKey: ["employee_contracts", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_contracts")
        .select("*, employees(full_name, department)")
        .order("end_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const rows = contracts.data ?? [];

  const match = (c: (typeof rows)[number], key: (typeof FILTERS)[number]["key"]) => {
    const finished = c.status === "completed";
    const d = daysUntil(c.end_date);
    if (key === "active") return c.status === "active" && (d === null || d >= 0);
    if (key === "soon") return !finished && d !== null && d >= 0 && d <= 30;
    if (key === "expired") return c.status === "expired" || (!finished && d !== null && d < 0);
    if (key === "done") return finished;
    return true;
  };

  const filtered = useMemo(() => rows.filter((c) => match(c, filter)), [rows, filter]);

  return (
    <div>
      <PageHeader
        title="Hợp đồng nhân sự"
        description="Cảnh báo hạn hợp đồng lao động dùng đúng ngưỡng màu như hợp đồng kinh tế: dưới 7 ngày đỏ, 15 ngày cam, 30 ngày hổ phách, 60 ngày vàng, 90 ngày teal."
        actions={
          <button
            type="button"
            onClick={() => void navigate({ to: "/mau-van-ban", search: { module: "hr" } })}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <FilePlus2 className="size-4" />
            Tạo hợp đồng từ mẫu
          </button>
        }
      />

      <ModuleTabs />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            {f.label}
            <span className="num ml-1.5 text-xs opacity-70">
              {rows.filter((c) => match(c, f.key)).length}
            </span>
          </button>
        ))}
      </div>

      <div className="panel overflow-x-auto">
        {contracts.isLoading ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Đang tải dữ liệu…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Không có hợp đồng lao động phù hợp"
            description="Thử chọn bộ lọc khác để xem các hợp đồng còn lại."
          />
        ) : (
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Mã hợp đồng</th>
                <th className="px-4 py-3 font-medium">Họ tên nhân viên</th>
                <th className="px-4 py-3 font-medium">Chức vụ</th>
                <th className="px-4 py-3 font-medium">Loại hợp đồng</th>
                <th className="px-4 py-3 text-right font-medium">Lương cơ bản</th>
                <th className="px-4 py-3 font-medium">Ngày bắt đầu</th>
                <th className="px-4 py-3 font-medium">Ngày kết thúc</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Cảnh báo hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => {
                const level = deadlineLevel(
                  c.end_date,
                  c.status === "completed" ? "completed" : null,
                );
                return (
                  <tr key={c.id} className="transition-colors hover:bg-accent/50">
                    <td className="px-4 py-3 font-medium">{c.contract_number}</td>
                    <td className="max-w-[200px] truncate px-4 py-3">
                      {c.employees?.full_name ?? "—"}
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.employees?.department ?? ""}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">
                      {c.position ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {c.contract_type ?? "—"}
                    </td>
                    <td className="num whitespace-nowrap px-4 py-3 text-right font-medium">
                      {formatCurrency(Number(c.base_salary))}
                    </td>
                    <td className="num whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDate(c.start_date)}
                    </td>
                    <td
                      className={cn(
                        "num whitespace-nowrap px-4 py-3",
                        level.key === "overdue" || level.key === "d7"
                          ? "font-medium text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatDate(c.end_date)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={EMPLOYEE_CONTRACT_STATUS[c.status]?.tone}>
                        {EMPLOYEE_CONTRACT_STATUS[c.status]?.label ?? c.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <DeadlineBadge
                        endDate={c.end_date}
                        status={c.status === "completed" ? "completed" : null}
                      />
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

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { DeadlineBadge, deadlineLevel } from "@/components/DeadlineBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { useContracts } from "@/hooks/useData";
import { CONTRACT_STATUS } from "@/lib/domain";
import { formatCurrency, formatDate, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/hop-dong")({
  head: () => ({
    meta: [
      { title: "Hợp đồng — OfficeFlow" },
      {
        name: "description",
        content:
          "Danh sách hợp đồng kèm cảnh báo hạn theo số ngày còn lại, lọc nhanh theo trạng thái thực hiện.",
      },
      { property: "og:title", content: "Hợp đồng — OfficeFlow" },
      {
        property: "og:description",
        content: "Theo dõi hạn hợp đồng, giá trị và người phụ trách trong một bảng duy nhất.",
      },
    ],
  }),
  component: ContractsPage,
});

const FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "active", label: "Đang thực hiện" },
  { key: "soon", label: "Sắp hết hạn (≤30 ngày)" },
  { key: "expired", label: "Đã hết hạn" },
  { key: "done", label: "Đã hoàn thành" },
] as const;

function ContractsPage() {
  const contracts = useContracts();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const rows = contracts.data ?? [];

  const filtered = useMemo(() => {
    return rows.filter((c) => {
      const finished = c.status === "completed" || c.status === "liquidated";
      const d = daysUntil(c.end_date);
      switch (filter) {
        case "active":
          return !finished && (d === null || d >= 0);
        case "soon":
          return !finished && d !== null && d >= 0 && d <= 30;
        case "expired":
          return !finished && d !== null && d < 0;
        case "done":
          return finished;
        default:
          return true;
      }
    });
  }, [rows, filter]);

  const count = (key: (typeof FILTERS)[number]["key"]) =>
    rows.filter((c) => {
      const finished = c.status === "completed" || c.status === "liquidated";
      const d = daysUntil(c.end_date);
      if (key === "active") return !finished && (d === null || d >= 0);
      if (key === "soon") return !finished && d !== null && d >= 0 && d <= 30;
      if (key === "expired") return !finished && d !== null && d < 0;
      if (key === "done") return finished;
      return true;
    }).length;

  return (
    <div>
      <PageHeader
        title="Hợp đồng"
        description="Cảnh báo hạn được tính theo ngày hiện tại của hệ thống: dưới 7 ngày là đỏ, dưới 15 ngày cam, dưới 30 ngày hổ phách, dưới 60 ngày vàng, dưới 90 ngày xanh teal."
      />

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
            <span className="num ml-1.5 text-xs opacity-70">{count(f.key)}</span>
          </button>
        ))}
      </div>

      <div className="panel overflow-x-auto">
        {contracts.isLoading ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Đang tải dữ liệu…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Không có hợp đồng phù hợp"
            description="Thử chọn bộ lọc khác để xem các hợp đồng còn lại."
          />
        ) : (
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Số hợp đồng</th>
                <th className="px-4 py-3 font-medium">Khách hàng</th>
                <th className="px-4 py-3 text-right font-medium">Giá trị</th>
                <th className="px-4 py-3 font-medium">Ngày ký</th>
                <th className="px-4 py-3 font-medium">Ngày kết thúc</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Cảnh báo hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => {
                const level = deadlineLevel(c.end_date, c.status);
                return (
                  <tr key={c.id} className="transition-colors hover:bg-accent/50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.contract_number}</p>
                      <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                        {c.title ?? "—"}
                      </p>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">
                      {c.customers?.name ?? "—"}
                    </td>
                    <td className="num whitespace-nowrap px-4 py-3 text-right font-medium">
                      {formatCurrency(Number(c.total_value))}
                    </td>
                    <td className="num whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDate(c.sign_date)}
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
                      <StatusBadge tone={CONTRACT_STATUS[c.status]?.tone}>
                        {CONTRACT_STATUS[c.status]?.label ?? c.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <DeadlineBadge endDate={c.end_date} status={c.status} />
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

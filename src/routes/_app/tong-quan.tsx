import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Gavel,
  FileSignature,
  Wallet,
  FileStack,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useContracts, useDocuments, usePayments, useTenders } from "@/hooks/useData";
import { contractAlert, CONTRACT_STATUS, DOC_STATUS } from "@/lib/domain";
import { formatCompact, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/tong-quan")({
  head: () => ({
    meta: [
      { title: "Tổng quan — OfficeFlow" },
      {
        name: "description",
        content:
          "Bảng điều khiển tổng quan: gói thầu, hợp đồng, thanh toán và hồ sơ đang chờ xử lý trong toàn doanh nghiệp.",
      },
      { property: "og:title", content: "Tổng quan — OfficeFlow" },
      {
        property: "og:description",
        content: "Theo dõi toàn bộ hoạt động đấu thầu, hợp đồng và thanh toán trên một màn hình.",
      },
    ],
  }),
  component: Overview,
});

type Module =
  | { to: string; title: string; desc: string; ready: true }
  | { title: string; desc: string; ready: false };

const MODULES: Module[] = [
  {
    to: "/ho-so-dau-thau",
    title: "Hồ sơ đấu thầu",
    desc: "Tải lên, nhận dạng, kiểm tra dữ liệu",
    ready: true,
  },
  { to: "/mau-van-ban", title: "Mẫu văn bản", desc: "Ánh xạ trường, điền tự động", ready: true },
  { to: "/hop-dong", title: "Hợp đồng", desc: "Theo dõi hạn, cảnh báo màu", ready: true },
  { title: "Văn bản – Hồ sơ", desc: "Luồng công văn đến/đi", ready: false },
  { title: "Báo cáo – Thống kê", desc: "Theo kỳ, xuất Excel/CSV", ready: false },
  { title: "Quản lý tài liệu", desc: "Thư mục hồ sơ, phiên bản", ready: false },
  { title: "Cài đặt hệ thống", desc: "Người dùng, quyền, cảnh báo", ready: false },
];

function Overview() {
  const tenders = useTenders();
  const contracts = useContracts();
  const payments = usePayments();
  const documents = useDocuments();

  const t = tenders.data ?? [];
  const c = contracts.data ?? [];
  const p = payments.data ?? [];
  const d = documents.data ?? [];

  const expiring = c.filter((x) => {
    const a = contractAlert(x.end_date);
    return a && a.days >= 0 && a.days <= 90 && x.status !== "completed" && x.status !== "liquidated";
  });
  const pendingDocs = d.filter((x) => x.status === "pending_review");
  const pendingPayments = p.filter((x) => x.status === "pending");

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        description="Bức tranh chung của toàn hệ thống. Chọn một phân hệ để đi sâu vào nghiệp vụ."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Gói thầu" value={t.length} icon={Gavel} sub={`${t.filter((x) => x.status === "won").length} gói trúng thầu`} />
        <KpiCard
          label="Hợp đồng đang thực hiện"
          value={c.filter((x) => x.status === "in_progress").length}
          icon={FileSignature}
          tone="info"
          sub={`${c.length} hợp đồng trong hệ thống`}
        />
        <KpiCard
          label="Hồ sơ chờ kiểm tra"
          value={pendingDocs.length}
          icon={FileStack}
          tone="warning"
          sub="Cần người dùng xác nhận dữ liệu"
        />
        <KpiCard
          label="Thanh toán chờ duyệt"
          value={pendingPayments.length}
          icon={Wallet}
          tone={pendingPayments.length ? "warning" : "default"}
          sub={`${formatCompact(pendingPayments.reduce((s, x) => s + Number(x.total_amount ?? 0), 0))} VNĐ`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="panel lg:col-span-2">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-warning-foreground" />
              Hợp đồng sắp đến hạn
            </h2>
            <Link to="/hop-dong" className="text-xs text-primary hover:underline">
              Xem tất cả
            </Link>
          </header>
          {expiring.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Không có hợp đồng nào đến hạn trong 90 ngày tới.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {expiring.slice(0, 6).map((x) => {
                const alert = contractAlert(x.end_date)!;
                return (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{x.contract_number}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {x.customers?.name ?? "Chưa gán khách hàng"} · hết hạn {formatDate(x.end_date)}
                      </p>
                    </div>
                    <StatusBadge tone={alert.tone}>{alert.label}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Hồ sơ mới nhất</h2>
            <Link to="/ho-so-dau-thau" className="text-xs text-primary hover:underline">
              Xử lý
            </Link>
          </header>
          {d.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Chưa có tài liệu nào được tải lên.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {d.slice(0, 6).map((x) => (
                <li key={x.id} className="px-4 py-3">
                  <p className="truncate text-sm">{x.file_name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge tone={DOC_STATUS[x.status]?.tone}>
                      {DOC_STATUS[x.status]?.label ?? x.status}
                    </StatusBadge>
                    <span className="text-xs text-muted-foreground">{formatDate(x.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <TrendingUp className="size-4" />
        Các phân hệ
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MODULES.map((m) =>
          m.ready ? (
            <Link
              key={m.title}
              to={m.to}
              className="panel group flex flex-col justify-between gap-4 p-4 transition-shadow hover:shadow-[var(--shadow-raised)]"
            >
              <div>
                <p className="text-sm font-semibold">{m.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{m.desc}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <div
              key={m.title}
              aria-disabled="true"
              className="panel flex cursor-not-allowed flex-col justify-between gap-4 p-4 opacity-60"
            >
              <div>
                <p className="text-sm font-semibold">{m.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{m.desc}</p>
              </div>
              <span className="inline-flex w-fit items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <Lock className="size-2.5" />
                Sắp mở rộng
              </span>
            </div>
          ),
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {(["not_started", "in_progress", "completed"] as const).map((s) => (
          <div key={s} className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {CONTRACT_STATUS[s]?.label}
            </p>
            <p className="num mt-1 text-xl font-semibold">
              {c.filter((x) => x.status === s).length}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

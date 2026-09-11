import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileCheck2, FileWarning, Files, Gauge } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DocsTabs } from "@/components/DocsTabs";
import { KpiCard } from "@/components/KpiCard";
import { supabase } from "@/integrations/supabase/client";
import { DOC_STATUS } from "@/lib/domain";

export const Route = createFileRoute("/_app/ho-so-dau-thau/bao-cao")({
  head: () => ({
    meta: [
      { title: "Báo cáo hồ sơ đấu thầu — OfficeFlow" },
      {
        name: "description",
        content:
          "Thống kê hồ sơ đấu thầu theo trạng thái, tiến độ xử lý theo tháng và chất lượng nhận dạng dữ liệu, kèm xuất báo cáo CSV.",
      },
      { property: "og:title", content: "Báo cáo hồ sơ đấu thầu — OfficeFlow" },
      {
        property: "og:description",
        content: "Số liệu hồ sơ theo trạng thái, theo tháng và chất lượng nhận dạng.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportPage,
});

const TONE_COLOR: Record<string, string> = {
  neutral: "var(--color-muted-foreground)",
  info: "var(--color-primary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-destructive)",
};

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function ReportPage() {
  const documents = useQuery({
    queryKey: ["report", "documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id,file_name,status,doc_type,created_at")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const fields = useQuery({
    queryKey: ["report", "fields"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_fields")
        .select("id,confidence,needs_review,value");
      if (error) throw error;
      return data;
    },
  });

  const docs = useMemo(() => documents.data ?? [], [documents.data]);
  const fieldRows = useMemo(() => fields.data ?? [], [fields.data]);

  const byStatus = useMemo(
    () =>
      Object.entries(DOC_STATUS).map(([key, meta]) => ({
        key,
        name: meta.label,
        tone: meta.tone,
        value: docs.filter((d) => d.status === key).length,
      })),
    [docs],
  );

  const byMonth = useMemo(() => {
    const map = new Map<string, { month: string; total: number; approved: number }>();
    for (const d of docs) {
      const k = monthKey(d.created_at);
      const row = map.get(k) ?? { month: k, total: 0, approved: 0 };
      row.total += 1;
      if (d.status === "approved") row.approved += 1;
      map.set(k, row);
    }
    return [...map.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map((r) => ({ ...r, label: `${r.month.slice(5)}/${r.month.slice(2, 4)}` }));
  }, [docs]);

  const quality = useMemo(() => {
    const total = fieldRows.length;
    const needsReview = fieldRows.filter((f) => f.needs_review).length;
    const empty = fieldRows.filter((f) => !f.value?.trim()).length;
    const avg = total ? fieldRows.reduce((s, f) => s + Number(f.confidence ?? 0), 0) / total : 0;
    return { total, needsReview, empty, avg };
  }, [fieldRows]);

  const approved = docs.filter((d) => d.status === "approved").length;
  const pending = docs.filter((d) => d.status === "pending_review").length;

  function exportCsv() {
    const lines: string[] = [];
    lines.push("Báo cáo hồ sơ đấu thầu");
    lines.push("");
    lines.push("Trạng thái,Số hồ sơ");
    for (const s of byStatus) lines.push(`"${s.name}",${s.value}`);
    lines.push("");
    lines.push("Tháng,Tải lên,Đã xác nhận");
    for (const m of byMonth) lines.push(`${m.month},${m.total},${m.approved}`);
    lines.push("");
    lines.push("Chất lượng nhận dạng");
    lines.push(`Tổng số trường,${quality.total}`);
    lines.push(`Trường cần kiểm tra lại,${quality.needsReview}`);
    lines.push(`Trường còn trống,${quality.empty}`);
    lines.push(`Độ tin cậy trung bình,${(quality.avg * 100).toFixed(1)}%`);
    lines.push("");
    lines.push("Danh sách hồ sơ");
    lines.push("Tên tệp,Loại,Trạng thái,Ngày tạo");
    for (const d of docs) {
      lines.push(
        `"${d.file_name.replace(/"/g, '""')}","${d.doc_type ?? ""}","${
          DOC_STATUS[d.status]?.label ?? d.status
        }",${d.created_at.slice(0, 10)}`,
      );
    }
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bao-cao-ho-so-dau-thau-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Báo cáo hồ sơ đấu thầu"
        description="Tổng hợp số lượng hồ sơ theo trạng thái, tiến độ xử lý theo tháng và chất lượng dữ liệu nhận dạng."
        actions={
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Download className="size-4" />
            Xuất báo cáo (Excel/CSV)
          </button>
        }
      />
      <DocsTabs />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Tổng hồ sơ" value={String(docs.length)} icon={Files} />
        <KpiCard label="Đã xác nhận" value={String(approved)} icon={FileCheck2} tone="success" />
        <KpiCard label="Chờ kiểm tra" value={String(pending)} icon={FileWarning} tone="warning" />
        <KpiCard
          label="Độ tin cậy trung bình"
          value={`${(quality.avg * 100).toFixed(0)}%`}
          icon={Gauge}
          tone="info"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel p-4">
          <h2 className="text-sm font-semibold">Hồ sơ theo trạng thái</h2>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" name="Số hồ sơ" radius={[4, 4, 0, 0]}>
                  {byStatus.map((s) => (
                    <Cell key={s.key} fill={TONE_COLOR[s.tone] ?? "var(--color-primary)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-4">
          <h2 className="text-sm font-semibold">Tiến độ theo tháng</h2>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byMonth} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Tải lên"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="approved"
                  name="Đã xác nhận"
                  stroke="var(--color-success)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel xl:col-span-2">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Chất lượng nhận dạng</h2>
          </header>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-2.5 text-muted-foreground">Tổng số trường đã bóc tách</td>
                <td className="num px-4 py-2.5 text-right font-medium">{quality.total}</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-muted-foreground">Trường cần kiểm tra lại</td>
                <td className="num px-4 py-2.5 text-right font-medium">
                  {quality.needsReview}
                  {quality.total
                    ? ` (${((quality.needsReview / quality.total) * 100).toFixed(1)}%)`
                    : ""}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-muted-foreground">Trường còn trống</td>
                <td className="num px-4 py-2.5 text-right font-medium">{quality.empty}</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-muted-foreground">Độ tin cậy trung bình</td>
                <td className="num px-4 py-2.5 text-right font-medium">
                  {(quality.avg * 100).toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

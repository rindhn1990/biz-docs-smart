import { useMemo, useState } from "react";
import { useContracts, usePayments, useTenders } from "@/hooks/useData";
import { TENDER_STATUS } from "@/lib/domain";
import { formatNumber } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all";

/** Báo cáo xuyên suốt: gói thầu → hợp đồng → thanh toán (chỉ tính đợt "Đã thanh toán"). */
export function TenderReport() {
  const { data: tenders = [] } = useTenders();
  const { data: contracts = [] } = useContracts();
  const { data: payments = [] } = usePayments();
  const [contractor, setContractor] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const paidBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payments) {
      if (p.status !== "paid") continue;
      m.set(p.contract_id, (m.get(p.contract_id) ?? 0) + Number(p.total_amount ?? 0));
    }
    return m;
  }, [payments]);

  const contractors = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contracts) if (c.contractor_id && c.contractors?.name) m.set(c.contractor_id, c.contractors.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [contracts]);

  const rows = useMemo(
    () =>
      tenders
        .filter((t) => status === ALL || t.status === status)
        .map((t) => {
          const list = contracts
            .filter((c) => c.tender_id === t.id)
            .filter((c) => contractor === ALL || c.contractor_id === contractor)
            .map((c) => {
              const value = Number(c.total_value ?? 0);
              const paid = paidBy.get(c.id) ?? 0;
              return { c, value, paid };
            });
          const value = list.reduce((s, x) => s + x.value, 0);
          const paid = list.reduce((s, x) => s + x.paid, 0);
          return { t, list, value, paid };
        })
        .filter((r) => contractor === ALL || r.list.length > 0),
    [tenders, contracts, paidBy, status, contractor],
  );

  const pct = (paid: number, value: number) => (value > 0 ? `${((paid / value) * 100).toFixed(1)}%` : "—");
  const money = (v: number | null | undefined) => (v ? formatNumber(Number(v)) : "—");

  return (
    <section className="panel mt-6 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-semibold">Báo cáo theo gói thầu</h2>
        <Select value={contractor} onValueChange={setContractor}>
          <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Nhà thầu" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tất cả nhà thầu</SelectItem>
            {contractors.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mọi trạng thái</SelectItem>
            {Object.entries(TENDER_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pr-2">Gói thầu / Hợp đồng</th>
              <th className="pr-2">Nhà thầu</th>
              <th className="pr-2 text-right">Giá gói</th>
              <th className="pr-2 text-right">Giá trúng</th>
              <th className="pr-2 text-right">Giá trị HĐ</th>
              <th className="pr-2 text-right">Đã thanh toán</th>
              <th className="pr-2 text-right">Còn lại</th>
              <th className="text-right">% giải ngân</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Không có gói thầu phù hợp.</td></tr>
            ) : rows.map(({ t, list, value, paid }) => (
              <FragmentRows key={t.id}>
                <tr className="border-t border-border bg-muted/40 font-medium">
                  <td className="py-2 pr-2">{t.code ? `${t.code} · ` : ""}{t.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{TENDER_STATUS[t.status]?.label}</span>
                  </td>
                  <td className="pr-2 text-muted-foreground">{list.length} hợp đồng</td>
                  <td className="num pr-2 text-right">{money(t.package_value)}</td>
                  <td className="num pr-2 text-right">{money(t.won_value)}</td>
                  <td className="num pr-2 text-right">{money(value)}</td>
                  <td className="num pr-2 text-right">{money(paid)}</td>
                  <td className="num pr-2 text-right">{money(value - paid)}</td>
                  <td className="num text-right">{pct(paid, value)}</td>
                </tr>
                {list.map(({ c, value: v, paid: p }) => (
                  <tr key={c.id} className="border-t border-border/60">
                    <td className="py-1.5 pl-4 pr-2">{c.contract_number}</td>
                    <td className="pr-2">{c.contractors?.name ?? "—"}</td>
                    <td /><td />
                    <td className="num pr-2 text-right">{money(v)}</td>
                    <td className="num pr-2 text-right">{money(p)}</td>
                    <td className="num pr-2 text-right">{money(v - p)}</td>
                    <td className="num text-right">{pct(p, v)}</td>
                  </tr>
                ))}
              </FragmentRows>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Đã thanh toán chỉ tính các đợt ở trạng thái "Đã thanh toán".</p>
    </section>
  );
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

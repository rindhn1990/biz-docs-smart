/** Tổng hợp giá trị hợp đồng / đã thanh toán / còn lại. "Đã thanh toán" chỉ tính đợt status = 'paid'. */
export type SummaryContract = { id: string; total_value: number | string | null };
export type SummaryPayment = { contract_id: string; status: string; total_amount: number | string | null };

export type ContractSummary = {
  contractId: string;
  value: number;
  paid: number;
  pending: number;
  remaining: number;
  overpaid: boolean;
  percent: number | null;
};

const PENDING = new Set(["pending", "approved", "draft"]);
const round2 = (n: number) => Math.round(n * 100) / 100;

function finish(contractId: string, value: number, paid: number, pending: number): ContractSummary {
  value = round2(value);
  paid = round2(paid);
  pending = round2(pending);
  const remaining = round2(value - paid);
  return {
    contractId,
    value,
    paid,
    pending,
    remaining,
    overpaid: remaining < 0,
    percent: value > 0 ? (paid / value) * 100 : null,
  };
}

export function summarizePayments(contracts: SummaryContract[], payments: SummaryPayment[]) {
  const paid = new Map<string, number>();
  const pending = new Map<string, number>();
  for (const p of payments) {
    const amt = Number(p.total_amount ?? 0) || 0;
    if (p.status === "paid") paid.set(p.contract_id, (paid.get(p.contract_id) ?? 0) + amt);
    else if (PENDING.has(p.status)) pending.set(p.contract_id, (pending.get(p.contract_id) ?? 0) + amt);
  }
  const rows = contracts.map((c) =>
    finish(c.id, Number(c.total_value ?? 0) || 0, paid.get(c.id) ?? 0, pending.get(c.id) ?? 0),
  );
  const total = finish(
    "__total",
    rows.reduce((s, r) => s + r.value, 0),
    rows.reduce((s, r) => s + r.paid, 0),
    rows.reduce((s, r) => s + r.pending, 0),
  );
  return { rows, total };
}

export function formatPercent(p: number | null) {
  return p === null ? "—" : `${p.toFixed(1)}%`;
}

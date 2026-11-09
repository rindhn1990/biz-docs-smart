import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PAYMENT_STATUS } from "@/lib/domain";
import { formatCurrency } from "@/lib/format";
import { formatPercent, summarizePayments, type SummaryPayment } from "@/lib/payment-summary";
import { DateField, formatVnDate, parseVnDate } from "@/components/DateField";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ScopeContract = {
  id: string;
  contract_number: string;
  total_value: number | string | null;
  contractors?: { name: string | null } | null;
};

export function PaymentSummaryPanel({ contracts, payments }: { contracts: ScopeContract[]; payments: SummaryPayment[] }) {
  const { rows, total } = useMemo(() => summarizePayments(contracts, payments), [contracts, payments]);
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const remain = (r: { remaining: number; overpaid: boolean }) =>
    r.overpaid ? <span className="font-medium text-destructive">Vượt giá trị hợp đồng ({formatCurrency(-r.remaining)})</span> : formatCurrency(r.remaining);
  const bar = (p: number | null) => (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, p ?? 0)}%` }} />
      </div>
      <span className="num w-12 text-right">{formatPercent(p)}</span>
    </div>
  );

  return (
    <div className="space-y-3 border-b border-border px-4 py-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Giá trị hợp đồng" value={formatCurrency(total.value)} note={`${contracts.length} hợp đồng`} />
        <Card label="Đã thanh toán" value={formatCurrency(total.paid)} note={`Đang chờ thanh toán: ${formatCurrency(total.pending)}`} />
        <Card
          label="Còn lại"
          value={total.overpaid ? "Vượt giá trị hợp đồng" : formatCurrency(total.remaining)}
          note={total.overpaid ? `Vượt ${formatCurrency(-total.remaining)}` : undefined}
          warn={total.overpaid}
        />
        <Card label="% đã thanh toán" value={formatPercent(total.percent)} />
      </div>
      {rows.length >= 2 && (
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-2 font-medium">Hợp đồng</th>
              <th className="pr-2 font-medium">Nhà thầu</th>
              <th className="pr-2 text-right font-medium">Giá trị hợp đồng</th>
              <th className="pr-2 text-right font-medium">Đã thanh toán</th>
              <th className="pr-2 text-right font-medium">Còn lại</th>
              <th className="text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.contractId}>
                <td className="py-1.5 pr-2 font-medium">{byId.get(r.contractId)?.contract_number}</td>
                <td className="pr-2 text-muted-foreground">{byId.get(r.contractId)?.contractors?.name ?? "—"}</td>
                <td className="num pr-2 text-right">{formatCurrency(r.value)}</td>
                <td className="num pr-2 text-right">{formatCurrency(r.paid)}</td>
                <td className="num pr-2 text-right">{remain(r)}</td>
                <td>{bar(r.percent)}</td>
              </tr>
            ))}
            <tr className="bg-muted/40 font-semibold">
              <td className="py-1.5 pr-2" colSpan={2}>Tổng cộng</td>
              <td className="num pr-2 text-right">{formatCurrency(total.value)}</td>
              <td className="num pr-2 text-right">{formatCurrency(total.paid)}</td>
              <td className="num pr-2 text-right">{remain(total)}</td>
              <td>{bar(total.percent)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function Card({ label, value, note, warn }: { label: string; value: string; note?: string; warn?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${warn ? "border-destructive/50 bg-destructive/5" : "border-border"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`num mt-1 text-lg font-semibold ${warn ? "text-destructive" : ""}`}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

type StatusKey = "draft" | "pending" | "approved" | "rejected" | "paid";

export function PaymentStatusControl({ payment }: { payment: { id: string; status: string; paid_date: string | null; installment_no: number } }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [date, setDate] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const save = async (status: string, paidDate: string | null) => {
    setBusy(true);
    const { error } = await supabase
      .from("payments")
      .update({ status: status as StatusKey, paid_date: paidDate, updated_by: user?.id ?? null })
      .eq("id", payment.id);
    setBusy(false);
    if (error) {
      toast.error("Không cập nhật được trạng thái", { description: error.message });
      return;
    }
    toast.success(`Đợt ${payment.installment_no}: ${PAYMENT_STATUS[status as StatusKey]?.label ?? status}`);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["payments"] }),
      qc.invalidateQueries({ queryKey: ["contracts"] }),
    ]);
  };

  const onChange = (next: string) => {
    if (next === payment.status) return;
    if (next === "paid") {
      setDate(formatVnDate(new Date()));
      setPayOpen(true);
    } else if (payment.status === "paid") {
      setPendingStatus(next);
    } else {
      void save(next, null);
    }
  };

  const toIso = (vn: string) => {
    const d = parseVnDate(vn);
    if (!d) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <>
      <Select value={payment.status} onValueChange={onChange} disabled={busy}>
        <SelectTrigger aria-label={`Trạng thái đợt ${payment.installment_no}`} className="h-8 w-40 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PAYMENT_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Đánh dấu đã thanh toán</DialogTitle>
            <DialogDescription>Chọn ngày thanh toán cho đợt {payment.installment_no}.</DialogDescription>
          </DialogHeader>
          <label className="text-xs font-medium" htmlFor={`paid-${payment.id}`}>Ngày thanh toán</label>
          <DateField id={`paid-${payment.id}`} value={date} onChange={setDate} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Huỷ</Button>
            <Button
              disabled={busy || !toIso(date)}
              onClick={async () => { await save("paid", toIso(date)); setPayOpen(false); }}
            >
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingStatus !== null} onOpenChange={(o) => !o && setPendingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bỏ trạng thái "Đã thanh toán"?</AlertDialogTitle>
            <AlertDialogDescription>
              Đợt {payment.installment_no} sẽ chuyển sang "{PAYMENT_STATUS[(pendingStatus ?? "") as StatusKey]?.label}" và
              ngày thanh toán sẽ bị xoá. Số đã thanh toán sẽ giảm tương ứng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const s = pendingStatus; setPendingStatus(null); if (s) void save(s, null); }}>
              Đồng ý
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

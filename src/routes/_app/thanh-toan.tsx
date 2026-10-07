import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle, Download, Eye, FileText, Loader2, Receipt, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { TemplateMissingBadge } from "@/components/TemplateMissingBadge";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { ScanFileDialog } from "@/components/ScanFileDialog";
import { DocxPreviewDialog } from "@/components/DocxPreviewDialog";
import { usePayments } from "@/hooks/useData";
import { PAYMENT_STATUS } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatThousands, parseThousands, readVietnameseMoney } from "@/lib/money";
import { renderAndDownloadDocx, type DelimiterStyle } from "@/lib/docx";
import { recordExport } from "@/lib/export-history";
import { CONTRACTOR_SCAN_FIELDS } from "@/lib/contractor";

export const Route = createFileRoute("/_app/thanh-toan")({
  head: () => ({
    meta: [
      { title: "Thanh toán — OfficeFlow" },
      {
        name: "description",
        content:
          "Theo dõi các đợt thanh toán theo hợp đồng và xuất hồ sơ thanh toán bằng mẫu Word, dữ liệu lấy sẵn từ thông tin nhà thầu.",
      },
      { property: "og:title", content: "Thanh toán — OfficeFlow" },
      {
        property: "og:description",
        content: "Quản lý đợt thanh toán và xuất hồ sơ thanh toán từ mẫu Word có sẵn.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const payments = usePayments();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tenderId, setTenderId] = useState("");
  const [contractId, setContractId] = useState("");
  /** Giá trị tự điền từ gói thầu/hợp đồng, người dùng vẫn sửa tay được. */
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [contractorId, setContractorId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [content, setContent] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  /** Thông tin nhà thầu quét được từ PDF / ảnh, dùng đè lên nhà thầu đang chọn. */
  const [scanned, setScanned] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{
    title: string;
    fileName: string;
    source: ArrayBuffer;
    style: DelimiterStyle;
    data: Record<string, string>;
  } | null>(null);

  const contractors = useQuery({
    queryKey: ["contractors", "for-payment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contractors")
        .select(
          "id,name,tax_code,address,representative,representative_title,phone,email,bank_account,bank_name",
        )
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const tenders = useQuery({
    queryKey: ["tenders", "for-payment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenders").select("id,code,name").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const contractsQ = useQuery({
    queryKey: ["contracts", "for-payment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("id,contract_number,title,tender_id,sign_date,total_value,contractor_id,contractors(name,tax_code)")
        .order("sign_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const tenderContracts = (contractsQ.data ?? []).filter((c) => c.tender_id === tenderId);

  function pickContract(id: string) {
    setContractId(id);
    setPaymentId("");
    const c = (contractsQ.data ?? []).find((x) => x.id === id);
    const t = (tenders.data ?? []).find((x) => x.id === (c?.tender_id ?? tenderId));
    if (c?.contractor_id) setContractorId(c.contractor_id);
    setEdits({
      GT_ten: t?.name ?? "",
      GT_ma: t?.code ?? "",
      HD_ten: c?.title ?? "",
      HD_so: c?.contract_number ?? "",
      HD_ngay: c?.sign_date ? formatDate(c.sign_date) : "",
      HD_giatri: c?.total_value ? formatThousands(String(Math.round(Number(c.total_value)))) : "",
      NT_ten: c?.contractors?.name ?? "",
      NT_mst: c?.contractors?.tax_code ?? "",
    });
  }

  const templates = useQuery({
    queryKey: ["templates", "payment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("id,name,description,source_docx_path,delimiter_style")
        .eq("module", "payment")
        .order("sort_order").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const rows = payments.data ?? [];
  const selected = (contractors.data ?? []).find((c) => c.id === contractorId) ?? null;
  const payment = rows.find((p) => p.id === paymentId) ?? null;

  /** Nhà thầu nhận thanh toán: lấy từ danh bạ, thông tin quét từ PDF/ảnh được ưu tiên. */
  const contractor = useMemo(() => {
    const base = {
      name: selected?.name ?? "",
      tax_code: selected?.tax_code ?? "",
      address: selected?.address ?? "",
      representative: selected?.representative ?? "",
      representative_title: selected?.representative_title ?? "",
      phone: selected?.phone ?? "",
      email: selected?.email ?? "",
      bank_account: selected?.bank_account ?? "",
      bank_name: selected?.bank_name ?? "",
    };
    const merged = { ...base };
    for (const [key, value] of Object.entries(scanned)) {
      if (value.trim()) merged[key as keyof typeof base] = value.trim();
    }
    return merged.name || selected ? merged : null;
  }, [selected, scanned]);

  const amountNumber = parseThousands(amount) ?? Number(payment?.total_amount ?? 0);

  /** Bộ giá trị dùng chung cho mọi mẫu văn bản thanh toán. */
  const values = useMemo<Record<string, string>>(() => {
    const contract = payment?.contracts ?? null;
    const base: Record<string, string> = {
      NT_ten: contractor?.name ?? "",
      NT_mst: contractor?.tax_code ?? "",
      NT_diachi: contractor?.address ?? "",
      NT_daidien: contractor?.representative ?? "",
      NT_chucdanh: contractor?.representative_title ?? "",
      NT_dienthoai: contractor?.phone ?? "",
      NT_email: contractor?.email ?? "",
      NT_taikhoan: contractor?.bank_account ?? "",
      NT_nganhang: contractor?.bank_name ?? "",
      HD_so: contract?.contract_number ?? "",
      HD_ngay: "",
      HD_giatri: contract?.total_value ? formatThousands(String(contract.total_value)) : "",
      TT_dot: payment ? String(payment.installment_no) : "",
      TT_noidung: content || (payment?.description ?? ""),
      TT_sotien: formatThousands(String(Math.round(amountNumber || 0))),
      TT_sotien_chu: readVietnameseMoney(amountNumber),
      TT_vat: payment?.vat_rate ? String(payment.vat_rate) : "",
      TT_tongtien: payment ? formatThousands(String(Math.round(Number(payment.total_amount)))) : "",
      TT_ngay: payment?.request_date ? formatDate(payment.request_date) : "",
      TT_hanthanhtoan: payment?.due_date ? formatDate(payment.due_date) : "",
      GT_ten: "",
      GT_ma: "",
      HD_ten: "",
    };
    const out: Record<string, string> = { ...base };
    for (const [k, v] of Object.entries(edits)) if (v.trim()) out[k] = v.trim();
    return out;
  }, [contractor, payment, content, amountNumber, edits]);

  type Template = {
    id: string;
    name: string;
    source_docx_path: string | null;
    delimiter_style: string | null;
  };

  /** Tải mẫu gốc và ghép dữ liệu — dùng chung cho xem trước và tải xuống. */
  async function prepare(tpl: Template) {
    if (!tpl.source_docx_path) {
      throw new Error("Mẫu này chưa có tệp Word gốc. Hãy tải lên tệp .docx trong kho mẫu.");
    }
    if (!contractor) throw new Error("Hãy chọn nhà thầu hoặc quét thông tin nhà thầu trước.");

    const { data: mappings } = await supabase
      .from("template_mappings")
      .select("placeholder,source_field,value")
      .eq("template_id", tpl.id);

    const filled: Record<string, string> = { ...values };
    for (const m of mappings ?? []) {
      const fromData = (m.source_field ? values[m.source_field] : values[m.placeholder])?.trim();
      filled[m.placeholder] = fromData || (m.value?.trim() ?? "");
    }

    const { data, error } = await supabase.storage.from("templates").download(tpl.source_docx_path);
    if (error) throw error;
    return {
      source: await data.arrayBuffer(),
      style: (tpl.delimiter_style as DelimiterStyle) ?? "curly",
      data: filled,
      fileName: `${tpl.name}.docx`,
    };
  }

  async function exportTemplate(tpl: Template) {
    setExporting(tpl.id);
    try {
      const ready = await prepare(tpl);
      await renderAndDownloadDocx(ready.source, ready.style, ready.data, ready.fileName);
      let savedPaymentId: string | null = paymentId || null;
      const linkedContract = contractId || payment?.contract_id || null;
      if (!savedPaymentId && contractId && amountNumber > 0) {
        const { data: lastRow } = await supabase
          .from("payments")
          .select("installment_no")
          .eq("contract_id", contractId)
          .order("installment_no", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextNo = (lastRow?.installment_no ?? 0) + 1;
        const { data: created, error: payErr } = await supabase
          .from("payments")
          .insert({
            contract_id: contractId,
            installment_no: nextNo,
            description: content || `Thanh toán đợt ${nextNo}`,
            amount: amountNumber,
            total_amount: amountNumber,
            request_date: new Date().toISOString().slice(0, 10),
            status: "pending",
            created_by: user?.id ?? null,
          })
          .select("id")
          .single();
        if (payErr) toast.error("Chưa lưu được đợt thanh toán", { description: payErr.message });
        else {
          savedPaymentId = created.id;
          ready.data["TT_dot"] = String(nextNo);
          void qc.invalidateQueries({ queryKey: ["payments"] });
        }
      }
      const linkedTender =
        tenderId || (contractsQ.data ?? []).find((c) => c.id === linkedContract)?.tender_id || null;
      await recordExport({
        tenderId: linkedTender,
        contractId: linkedContract,
        paymentId: savedPaymentId,
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        fileName: ready.fileName,
        module: "payment",
        data: ready.data,
        templateId: tpl.id,
        templateName: tpl.name,
      });
      void qc.invalidateQueries({ queryKey: ["export_history"] });
      toast.success("Đã xuất hồ sơ thanh toán", { description: ready.fileName });
    } catch (e) {
      toast.error("Không xuất được file", { description: (e as Error).message });
    } finally {
      setExporting(null);
    }
  }

  async function previewTemplate(tpl: Template) {
    setExporting(tpl.id);
    try {
      const ready = await prepare(tpl);
      setPreview({ title: tpl.name, ...ready });
    } catch (e) {
      toast.error("Không xem trước được", { description: (e as Error).message });
    } finally {
      setExporting(null);
    }
  }


  return (
    <div>
      <PageHeader
        title="Thanh toán"
        description="Theo dõi các đợt thanh toán của hợp đồng và xuất hồ sơ thanh toán bằng mẫu Word có sẵn; thông tin nhà thầu được điền tự động."
        actions={
          <Link
            to="/mau-van-ban"
            search={{ module: "payment" as const }}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <FileText className="size-4" />
            Kho mẫu thanh toán
          </Link>
        }
      />

      <div className="space-y-4">
        <section className="panel overflow-x-auto">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Đợt thanh toán ({rows.length})</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Chọn một đợt để đưa số liệu sang phần xuất văn bản bên dưới.
            </p>
          </header>
          {payments.isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Đang tải…</p>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Chưa có đợt thanh toán nào"
              description="Các đợt thanh toán sẽ hiện ở đây khi hợp đồng có kế hoạch giải ngân."
            />
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Hợp đồng</th>
                  <th className="px-4 py-3 font-medium">Đợt</th>
                  <th className="px-4 py-3 font-medium">Nội dung</th>
                  <th className="px-4 py-3 text-right font-medium">Số tiền</th>
                  <th className="px-4 py-3 font-medium">Hạn thanh toán</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className={`transition-colors hover:bg-accent/50 ${p.id === paymentId ? "bg-accent/60" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium">
                      {p.contracts?.contract_number ?? "—"}
                    </td>
                    <td className="num px-4 py-3">Đợt {p.installment_no}</td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-muted-foreground">
                      {p.description ?? "—"}
                    </td>
                    <td className="num whitespace-nowrap px-4 py-3 text-right font-medium">
                      {formatCurrency(Number(p.total_amount))}
                    </td>
                    <td className="num whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDate(p.due_date)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={PAYMENT_STATUS[p.status]?.tone}>
                        {PAYMENT_STATUS[p.status]?.label ?? p.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentId(p.id);
                          setAmount(formatThousands(String(Math.round(Number(p.total_amount)))));
                          setContent(p.description ?? "");
                        }}
                        className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                      >
                        Chọn
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Xuất hồ sơ thanh toán</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Thông tin nhà thầu, hợp đồng và số tiền bên dưới sẽ được điền thẳng vào mẫu Word.
            </p>
          </header>

          <div className="grid gap-3 border-b border-border p-4 md:grid-cols-2">
            <label className="text-xs font-medium text-muted-foreground">
              Gói thầu
              <select
                value={tenderId}
                onChange={(e) => { setTenderId(e.target.value); setContractId(""); setEdits({}); }}
                className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              >
                <option value="">— Chọn gói thầu —</option>
                {(tenders.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.code ? `${t.code} · ` : ""}{t.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Hợp đồng
              <select
                value={contractId}
                disabled={!tenderId}
                onChange={(e) => pickContract(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
              >
                <option value="">{tenderId && tenderContracts.length === 0 ? "Gói này chưa có hợp đồng" : "— Chọn hợp đồng —"}</option>
                {tenderContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contract_number}{c.contractors?.name ? ` · ${c.contractors.name}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {contractId ? (
              <div className="grid gap-2 rounded-md border border-border bg-muted/40 p-3 md:col-span-2 md:grid-cols-4">
                {[
                  ["GT_ten", "Tên gói thầu"],
                  ["GT_ma", "Mã gói thầu"],
                  ["HD_ten", "Tên hợp đồng"],
                  ["HD_so", "Số hợp đồng"],
                  ["HD_ngay", "Ngày ký"],
                  ["HD_giatri", "Giá trị hợp đồng"],
                  ["NT_ten", "Tên nhà thầu"],
                  ["NT_mst", "Mã số thuế"],
                ].map(([k, label]) => (
                  <label key={k} className="text-[11px] font-medium text-muted-foreground">
                    {label}
                    <input
                      value={edits[k!] ?? ""}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [k!]: k === "HD_giatri" ? formatThousands(e.target.value) : e.target.value }))}
                      className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </label>
                ))}
              </div>
            ) : null}
            <label className="text-xs font-medium text-muted-foreground">
              <span className="flex flex-wrap items-center justify-between gap-2">
                Nhà thầu nhận thanh toán
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent"
                >
                  <ScanLine className="size-3.5" />
                  Quét từ PDF / ảnh
                </button>
              </span>
              <select
                value={contractorId}
                onChange={(e) => setContractorId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              >
                <option value="">— Chọn nhà thầu —</option>
                {(contractors.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-medium text-muted-foreground">
              Số tiền thanh toán (VNĐ)
              <input
                value={amount}
                inputMode="numeric"
                onChange={(e) => setAmount(formatThousands(e.target.value))}
                placeholder="0"
                className="num mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
              <span className="mt-1 block text-[11px] italic text-muted-foreground">
                Bằng chữ: {amountNumber > 0 ? readVietnameseMoney(amountNumber) : "—"}
              </span>
            </label>

            <label className="text-xs font-medium text-muted-foreground md:col-span-2">
              Nội dung thanh toán
              <input
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Ví dụ: Thanh toán đợt 1 theo hợp đồng số…"
                className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </label>

            {selected?.bank_account && scanned["bank_account"] &&
            selected.bank_account.replace(/\D/g, "") !== scanned["bank_account"].replace(/\D/g, "") ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs md:col-span-2">
                <AlertTriangle className="size-4 shrink-0 text-warning" />
                <span className="flex-1">
                  Số tài khoản quét được (<b>{scanned["bank_account"]}</b>) khác với hồ sơ nhà thầu (<b>{selected.bank_account}</b>). Đang dùng số quét được.
                </span>
                <button
                  type="button"
                  onClick={() => setScanned((p) => ({ ...p, bank_account: selected.bank_account ?? "", bank_name: selected.bank_name ?? p["bank_name"] ?? "" }))}
                  className="rounded-md border border-input bg-background px-2 py-1 font-medium hover:bg-accent"
                >
                  Dùng số trong hồ sơ
                </button>
              </div>
            ) : null}

            {contractor ? (
              <dl className="grid gap-1 rounded-md border border-border bg-muted/40 p-3 text-xs md:col-span-2 md:grid-cols-2">
                <Info label="Mã số thuế" value={contractor.tax_code} />
                <Info label="Người đại diện" value={contractor.representative} />
                <Info label="Địa chỉ" value={contractor.address} />
                <Info label="Số tài khoản" value={contractor.bank_account} />
                <Info label="Ngân hàng" value={contractor.bank_name} />
                <Info label="Điện thoại" value={contractor.phone} />
              </dl>
            ) : null}
          </div>

          <div className="p-4">
            {templates.isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Đang tải…</p>
            ) : (templates.data ?? []).length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Chưa có mẫu thanh toán"
                description="Hãy tải lên tệp .docx trong kho mẫu Thanh toán để bắt đầu."
              />
            ) : (
              <ul className="divide-y divide-border">
                {(templates.data ?? []).map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                    <FileText className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{t.name}</span>
                        <TemplateMissingBadge templateId={t.id} module="payment" />
                      {t.description ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {t.description}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      disabled={exporting !== null}
                      onClick={() => void previewTemplate(t)}
                      className="inline-flex items-center gap-2 rounded-md border border-input px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      <Eye className="size-4" />
                      Xem trước
                    </button>
                    <button
                      type="button"
                      disabled={exporting !== null}
                      onClick={() => void exportTemplate(t)}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {exporting === t.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Download className="size-4" />
                      )}
                      Xuất file Word
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {scanning ? (
        <ScanFileDialog
          title="Quét thông tin nhà thầu nhận thanh toán"
          description="Chọn đề nghị thanh toán, hoá đơn, hợp đồng… dạng ảnh chụp, PDF hoặc Word. Thông tin đọc được sẽ dùng thay cho nhà thầu đang chọn."
          fields={[
            ...CONTRACTOR_SCAN_FIELDS.map((f) => ({ key: f.key, label: f.label })),
            { key: "pay_amount", label: "Số tiền thanh toán" },
            { key: "pay_amount_text", label: "Số tiền bằng chữ" },
          ]}
          note="Đây là đơn vị thụ hưởng khoản thanh toán."
          onClose={() => setScanning(false)}
          onApply={(v) => {
            const { pay_amount, pay_amount_text: _text, ...rest } = v;
            setScanned(rest);
            if (pay_amount) setAmount(formatThousands(pay_amount.replace(/[^\d]/g, "")));
            toast.success("Đã lấy thông tin nhà thầu từ tệp", {
              description: "Thông tin này sẽ được điền vào mẫu thanh toán.",
            });
          }}
        />
      ) : null}

      {preview ? (
        <DocxPreviewDialog
          title={preview.title}
          fileName={preview.fileName}
          source={preview.source}
          style={preview.style}
          data={preview.data}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 truncate font-medium">{value || "—"}</dd>
    </div>
  );
}

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, FileText, Loader2, Receipt, ScanLine } from "lucide-react";
import { toast } from "sonner";
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

  const templates = useQuery({
    queryKey: ["templates", "payment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("id,name,description,source_docx_path,delimiter_style")
        .eq("module", "payment")
        .order("created_at");
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
    return {
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
    };
  }, [contractor, payment, content, amountNumber]);

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

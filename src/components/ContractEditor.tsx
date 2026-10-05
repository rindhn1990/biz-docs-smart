import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DateField, formatVnDate, parseVnDate } from "@/components/DateField";
import { supabase } from "@/integrations/supabase/client";
import { useTenders } from "@/hooks/useData";
import { formatThousands, parseThousands } from "@/lib/money";

export type EditableContract = {
  id: string;
  contract_number: string;
  title: string | null;
  tender_id: string | null;
  contractor_id: string | null;
  sign_date: string | null;
  end_date: string | null;
  total_value: number;
};

const toIso = (vn: string) => {
  const d = parseVnDate(vn);
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const fromIso = (iso: string | null) => (iso ? formatVnDate(new Date(`${iso}T00:00:00`)) : "");

/** Hộp thoại tạo / sửa hợp đồng; nhà thầu chọn trong danh sách tham dự gói thầu, ưu tiên nhà thầu trúng. */
export function ContractEditor({
  contract,
  userId,
  onClose,
}: {
  contract: EditableContract | null;
  userId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const tenders = useTenders();
  const [tenderId, setTenderId] = useState(contract?.tender_id ?? "");
  const [contractorId, setContractorId] = useState(contract?.contractor_id ?? "");
  const [number, setNumber] = useState(contract?.contract_number ?? "");
  const [title, setTitle] = useState(contract?.title ?? "");
  const [signDate, setSignDate] = useState(fromIso(contract?.sign_date ?? null));
  const [endDate, setEndDate] = useState(fromIso(contract?.end_date ?? null));
  const [value, setValue] = useState(
    contract?.total_value ? formatThousands(String(contract.total_value)) : "",
  );
  const [saving, setSaving] = useState(false);

  const links = useQuery({
    queryKey: ["tender_contractors", tenderId],
    enabled: Boolean(tenderId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tender_contractors")
        .select("id, role, price, contractor_id, contractors(name, tax_code)")
        .eq("tender_id", tenderId);
      if (error) throw error;
      return data;
    },
  });

  const options = useMemo(() => {
    const map = new Map<string, { id: string; name: string; winner: boolean; price: number | null }>();
    for (const l of links.data ?? []) {
      const prev = map.get(l.contractor_id);
      const winner = l.role === "winner";
      if (!prev || (winner && !prev.winner)) {
        map.set(l.contractor_id, {
          id: l.contractor_id,
          name: l.contractors?.name ?? "—",
          winner: winner || Boolean(prev?.winner),
          price: winner ? l.price : (prev?.price ?? null),
        });
      }
    }
    return [...map.values()].sort((a, b) => Number(b.winner) - Number(a.winner));
  }, [links.data]);

  function chooseContractor(id: string) {
    setContractorId(id);
    const opt = options.find((o) => o.id === id);
    if (opt?.winner && opt.price && !value) setValue(formatThousands(String(opt.price)));
  }

  async function save() {
    if (!number.trim()) {
      toast.error("Nhập số hợp đồng");
      return;
    }
    setSaving(true);
    const row = {
      contract_number: number.trim(),
      title: title.trim() || null,
      tender_id: tenderId || null,
      contractor_id: contractorId || null,
      sign_date: toIso(signDate),
      end_date: toIso(endDate),
      total_value: parseThousands(value) ?? 0,
      updated_by: userId,
    };
    const { error } = contract
      ? await supabase.from("contracts").update(row).eq("id", contract.id)
      : await supabase.from("contracts").insert({ ...row, created_by: userId });
    setSaving(false);
    if (error) {
      toast.error("Không lưu được hợp đồng", { description: error.message });
      return;
    }
    toast.success(contract ? "Đã cập nhật hợp đồng" : "Đã tạo hợp đồng");
    void qc.invalidateQueries({ queryKey: ["contracts"] });
    onClose();
  }

  const label = "mb-1 block text-xs font-medium text-muted-foreground";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{contract ? "Sửa hợp đồng" : "Thêm hợp đồng"}</h2>
          <Button variant="ghost" size="icon" aria-label="Đóng" onClick={onClose}>
            <X />
          </Button>
        </header>
        <div className="grid gap-3 overflow-y-auto p-5 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className={label}>Gói thầu</span>
            <select
              className="input"
              value={tenderId}
              onChange={(e) => {
                setTenderId(e.target.value);
                setContractorId("");
              }}
            >
              <option value="">— Không gắn gói thầu —</option>
              {(tenders.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code ? `${t.code} — ` : ""}
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className={label}>Nhà thầu ký hợp đồng</span>
            <select
              className="input"
              value={contractorId}
              disabled={!tenderId}
              onChange={(e) => chooseContractor(e.target.value)}
            >
              <option value="">
                {tenderId
                  ? options.length
                    ? "— Chọn nhà thầu —"
                    : "Gói thầu chưa có nhà thầu tham dự"
                  : "Chọn gói thầu trước"}
              </option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.winner ? "★ Trúng thầu · " : ""}
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={label}>Số hợp đồng</span>
            <input className="input" value={number} onChange={(e) => setNumber(e.target.value)} />
          </label>
          <label>
            <span className={label}>Giá trị hợp đồng (đồng)</span>
            <input
              className="input text-right"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(formatThousands(e.target.value))}
            />
            <span className="mt-1 block text-xs italic text-muted-foreground">
              Bằng chữ: {value ? readVietnameseMoney(value) : "—"}
            </span>
          </label>
          <label className="md:col-span-2">
            <span className={label}>Tên hợp đồng</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <div>
            <span className={label}>Ngày ký</span>
            <DateField value={signDate} onChange={setSignDate} />
          </div>
          <div>
            <span className={label}>Ngày kết thúc</span>
            <DateField value={endDate} onChange={setEndDate} />
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Lưu hợp đồng
          </Button>
        </footer>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
  Mail,
  Plus,
  Save,
  Search,
  Send,
  StopCircle,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ModuleTabs } from "@/components/ModuleTabs";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHrUnits } from "@/hooks/useHrUnits";
import { formatCurrency, formatDateTime, parseVnNumber } from "@/lib/format";
import { readVietnameseMoney } from "@/lib/money";
import { withTimestampedName } from "@/lib/docx";
import {
  buildSalaryMail,
  employeesInUnits,
  isValidEmail,
  matchExcelRow,
  normalizeName,
  recipientStatus,
  RECIPIENT_STATUS_LABEL,
  SALARY_PLACEHOLDERS,
  salaryMailValues,
  type EmployeeRef,
  type ExcelMatchResult,
  type ExcelSalaryRow,
  type RecipientStatus,
} from "@/lib/salary-mail";
import { getSalaryMailConfig, sendSalaryBatch, type SalarySendResult } from "@/lib/salary-mail.functions";

export const Route = createFileRoute("/_app/nhan-su/thong-bao-luong")({
  head: () => ({
    meta: [
      { title: "Thông báo lương — OfficeFlow" },
      { name: "description", content: "Gửi thông báo lương qua email cho nhiều nhân sự theo đầu mục, chỉ dành cho quản trị viên." },
      { property: "og:title", content: "Thông báo lương — OfficeFlow" },
      { property: "og:description", content: "Nhập lương theo kỳ, soạn mẫu email và gửi thông báo lương hàng loạt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalaryMailPage,
});

type Employee = {
  id: string;
  full_name: string | null;
  email: string | null;
  position: string | null;
  department: string | null;
  unit_id: string | null;
  id_number: string | null;
};
type SalaryRow = {
  id: string;
  employee_id: string;
  period: string;
  amount: number;
  note: string | null;
  source: string;
};
type Template = { id: string; name: string; subject: string; body: string; updated_at: string };
type MailLog = {
  id: string;
  employee_id: string | null;
  employee_name: string | null;
  email: string | null;
  period: string | null;
  subject: string | null;
  amount: number | null;
  kind: string;
  status: string;
  error: string | null;
  created_at: string;
};

const SALARY_SOURCE_LABEL: Record<string, string> = {
  manual: "Nhập tay",
  excel: "Excel",
  contract: "Hợp đồng",
};

const SEND_BATCH = 10;

const DEFAULT_TEMPLATE_BODY = `Kính gửi anh/chị {{Ten_NV}},

Phòng Hành chính – Nhân sự xin thông báo lương tháng {{Thang}} của anh/chị như sau:

- Đầu mục: {{Don_vi}}
- Chức vụ: {{Chuc_vu}}
- Số tiền lương: {{Luong}} đồng
- Bằng chữ: {{Luong_chu}}

Anh/chị vui lòng kiểm tra và phản hồi lại nếu có sai sót.

Trân trọng.`;

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function SalaryMailPage() {
  const { isAdmin, loading } = useAuth();
  const [period, setPeriod] = useState("");
  useEffect(() => {
    if (!period) setPeriod(currentPeriod());
  }, [period]);

  const config = useQuery({
    queryKey: ["salary_mail_config"],
    enabled: isAdmin,
    queryFn: () => getSalaryMailConfig(),
  });

  const employees = useQuery({
    queryKey: ["salary_employees"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id,full_name,email,position,department,unit_id,id_number")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Employee[];
    },
  });

  const salaries = useQuery({
    queryKey: ["hr_salaries", period],
    enabled: isAdmin && Boolean(period),
    queryFn: async () => {
      const { data, error } = await supabase.from("hr_salaries").select("*").eq("period", period);
      if (error) throw error;
      return (data ?? []) as SalaryRow[];
    },
  });

  const templates = useQuery({
    queryKey: ["hr_email_templates"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_email_templates")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const logs = useQuery({
    queryKey: ["salary_mail_log", period],
    enabled: isAdmin && Boolean(period),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_salary_mail_log")
        .select("*")
        .eq("period", period)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MailLog[];
    },
  });

  const baseSalaries = useQuery({
    queryKey: ["salary_base"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_summary_view").select("id,base_salary");
      if (error) throw error;
      return new Map(
        (data ?? []).flatMap((r) =>
          r.id ? [[r.id, r.base_salary == null ? null : Number(r.base_salary)] as const] : [],
        ),
      );
    },
  });

  const salaryByEmp = useMemo(
    () => new Map((salaries.data ?? []).map((s) => [s.employee_id, s])),
    [salaries.data],
  );
  const sentSet = useMemo(
    () =>
      new Set(
        (logs.data ?? [])
          .filter((l) => l.kind === "real" && l.status === "sent" && l.employee_id)
          .map((l) => l.employee_id as string),
      ),
    [logs.data],
  );

  if (loading) return null;
  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Thông báo lương" description="Gửi thông báo lương qua email." />
        <ModuleTabs />
        <EmptyState
          title="Chỉ quản trị viên"
          description="Chức năng thông báo lương chỉ dành cho tài khoản quản trị viên."
        />
      </div>
    );
  }

  const configured = config.data?.configured === true;

  return (
    <div>
      <PageHeader
        title="Thông báo lương"
        description="Nhập lương theo kỳ, soạn mẫu email và gửi thông báo cho nhiều nhân sự theo đầu mục."
      />
      <ModuleTabs />

      {config.data && !configured && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Chưa cấu hình gửi email</p>
            <p className="text-muted-foreground">
              Chưa có khoá Resend hoặc địa chỉ gửi. Bạn vẫn có thể nhập lương, soạn mẫu và xem trước;
              nút gửi thật và gửi thử sẽ mở lại sau khi cấu hình.
            </p>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Label htmlFor="salary-period" className="text-sm">
          Kỳ lương
        </Label>
        <Input
          id="salary-period"
          type="month"
          className="w-[170px]"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        />
      </div>

      <Tabs defaultValue="salary">
        <TabsList>
          <TabsTrigger value="salary">Lương theo kỳ</TabsTrigger>
          <TabsTrigger value="template">Mẫu email</TabsTrigger>
          <TabsTrigger value="send">Gửi thư</TabsTrigger>
          <TabsTrigger value="history">Lịch sử gửi</TabsTrigger>
        </TabsList>

        <TabsContent value="salary">
          <SalaryTab
            period={period}
            employees={employees.data ?? []}
            salaryByEmp={salaryByEmp}
            baseSalaries={baseSalaries.data ?? new Map()}
            loading={employees.isLoading || salaries.isLoading}
          />
        </TabsContent>
        <TabsContent value="template">
          <TemplateTab
            templates={templates.data ?? []}
            employees={employees.data ?? []}
            salaryByEmp={salaryByEmp}
            period={period}
          />
        </TabsContent>
        <TabsContent value="send">
          <SendTab
            period={period}
            employees={employees.data ?? []}
            templates={templates.data ?? []}
            salaryByEmp={salaryByEmp}
            sentSet={sentSet}
            configured={configured}
          />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab period={period} logs={logs.data ?? []} employees={employees.data ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Tab 1: Lương theo kỳ ============

function AmountCell({ employeeId, period, existing }: { employeeId: string; period: string; existing: SalaryRow | undefined }) {
  const client = useQueryClient();
  const shown = existing ? existing.amount.toLocaleString("vi-VN") : "";
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);

  const save = async () => {
    const trimmed = text.trim();
    if (trimmed === shown) return;
    if (!trimmed) {
      if (existing) {
        const { error } = await supabase.from("hr_salaries").delete().eq("id", existing.id);
        if (error) toast.error("Không xoá được lương", { description: error.message });
        else {
          toast.success("Đã xoá lương kỳ này");
          void client.invalidateQueries({ queryKey: ["hr_salaries"] });
        }
      }
      return;
    }
    const amount = parseVnNumber(trimmed);
    if (amount === null || amount < 0) {
      toast.error("Số tiền không hợp lệ", { description: trimmed });
      setText(shown);
      return;
    }
    const { error } = await supabase.from("hr_salaries").upsert(
      {
        employee_id: employeeId,
        period,
        amount,
        note: existing?.note ?? null,
        source: existing?.source ?? "manual",
      },
      { onConflict: "employee_id,period" },
    );
    if (error) {
      toast.error("Không lưu được lương", { description: error.message });
      setText(shown);
      return;
    }
    void client.invalidateQueries({ queryKey: ["hr_salaries"] });
  };

  const parsed = parseVnNumber(text.trim());
  return (
    <div className="space-y-0.5">
      <Input
        aria-label="Số tiền lương"
        className="num h-8 w-[170px] text-right"
        inputMode="numeric"
        value={text}
        placeholder="Chưa có"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setText(shown);
        }}
      />
      {parsed !== null && parsed > 0 && (
        <p className="max-w-[260px] text-xs italic text-muted-foreground">{readVietnameseMoney(parsed)}</p>
      )}
    </div>
  );
}

function NoteCell({ existing }: { existing: SalaryRow | undefined }) {
  const client = useQueryClient();
  const shown = existing?.note ?? "";
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);

  const save = async () => {
    const trimmed = text.trim();
    if (trimmed === shown) return;
    if (!existing) {
      toast.info("Nhập số tiền trước rồi mới ghi chú.");
      setText("");
      return;
    }
    const { error } = await supabase.from("hr_salaries").update({ note: trimmed || null }).eq("id", existing.id);
    if (error) {
      toast.error("Không lưu được ghi chú", { description: error.message });
      setText(shown);
      return;
    }
    void client.invalidateQueries({ queryKey: ["hr_salaries"] });
  };

  return (
    <Input
      aria-label="Ghi chú lương"
      className="h-8 w-[200px]"
      value={text}
      placeholder={existing ? "Ghi chú…" : "Nhập số tiền trước"}
      disabled={!existing}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setText(shown);
      }}
    />
  );
}

type ParsedExcelRow = { row: ExcelSalaryRow; result: ExcelMatchResult };

function ExcelImportDialog({
  period,
  employees,
  onImported,
}: {
  period: string;
  employees: Employee[];
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedExcelRow[]>([]);
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setChoices({});
    if (fileRef.current) fileRef.current.value = "";
  };

  const parseFile = async (file: File) => {
    setParsing(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error("Tệp không có trang tính nào.");
      const ws = wb.Sheets[sheetName]!;
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const refs: EmployeeRef[] = employees.map((e) => ({
        id: e.id,
        full_name: e.full_name,
        id_number: e.id_number,
      }));
      const parsed: ParsedExcelRow[] = raw
        .map((r) => {
          const norm: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(r)) norm[normalizeName(k)] = v;
          const row: ExcelSalaryRow = {
            cccd: String(norm["so cccd"] ?? norm["cccd"] ?? "").trim() || null,
            name:
              String(norm["ho ten"] ?? norm["ho va ten"] ?? norm["ten nhan vien"] ?? norm["ten"] ?? "").trim() ||
              null,
            amount: parseVnNumber(String(norm["so tien"] ?? norm["luong"] ?? norm["so tien luong"] ?? "").trim()),
            note: String(norm["ghi chu"] ?? "").trim() || null,
            email: String(norm["email"] ?? "").trim() || null,
          };
          return row;
        })
        .filter((r) => r.cccd || r.name)
        .map((row) => ({ row, result: matchExcelRow(row, refs) }));
      if (parsed.length === 0) throw new Error("Không đọc được dòng nào có Số CCCD hoặc Họ tên.");
      setRows(parsed);
    } catch (e) {
      toast.error("Không đọc được tệp Excel", { description: (e as Error).message });
      reset();
    } finally {
      setParsing(false);
    }
  };

  const matched = rows.filter((r) => r.result.kind === "matched");
  const ambiguous = rows.filter((r) => r.result.kind === "ambiguous");
  const unmatched = rows.filter((r) => r.result.kind === "unmatched");
  const resolvedCount = matched.length + ambiguous.filter((r) => choices[rows.indexOf(r)]).length;

  const confirm = async () => {
    setSaving(true);
    try {
      const toSave: { empId: string; row: ExcelSalaryRow }[] = [];
      for (const r of rows) {
        if (r.result.kind === "matched") toSave.push({ empId: r.result.employee.id, row: r.row });
        else if (r.result.kind === "ambiguous") {
          const picked = choices[rows.indexOf(r)];
          if (picked) toSave.push({ empId: picked, row: r.row });
        }
      }
      const withAmount = toSave.filter((t) => t.row.amount !== null);
      if (withAmount.length > 0) {
        const { error } = await supabase.from("hr_salaries").upsert(
          withAmount.map((t) => ({
            employee_id: t.empId,
            period,
            amount: t.row.amount!,
            note: t.row.note ?? null,
            source: "excel",
          })),
          { onConflict: "employee_id,period" },
        );
        if (error) throw error;
      }
      // Cập nhật email nếu dòng Excel có email hợp lệ.
      for (const t of toSave) {
        if (t.row.email && isValidEmail(t.row.email)) {
          await supabase.from("employees").update({ email: t.row.email.trim() }).eq("id", t.empId);
        }
      }
      toast.success(`Đã nhập lương cho ${withAmount.length} nhân sự`);
      setOpen(false);
      reset();
      onImported();
    } catch (e) {
      toast.error("Không lưu được dữ liệu Excel", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const th = "px-3 py-2 font-medium whitespace-nowrap";
  const td = "px-3 py-1.5 whitespace-nowrap text-muted-foreground";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="mr-2 size-4" />
        Nhập từ Excel
      </Button>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nhập lương từ Excel</DialogTitle>
          <DialogDescription>
            Cột cần có: Số CCCD hoặc Họ tên, Số tiền; tuỳ chọn: Ghi chú, Email. Hệ thống khớp theo số CCCD
            trước, sau đó theo họ tên.
          </DialogDescription>
        </DialogHeader>
        <Input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={parsing}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void parseFile(f);
          }}
        />
        {parsing && <p className="text-sm text-muted-foreground">Đang đọc tệp…</p>}
        {rows.length > 0 && (
          <div className="max-h-[50vh] space-y-4 overflow-y-auto text-sm">
            <p>
              <span className="font-medium text-green-700">{matched.length} dòng khớp</span>
              {" · "}
              <span className="font-medium text-amber-600">{ambiguous.length} dòng trùng tên</span>
              {" · "}
              <span className="font-medium text-destructive">{unmatched.length} dòng không khớp</span>
            </p>
            {ambiguous.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Trùng tên — chọn đúng nhân sự:</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className={th}>Dòng Excel</th>
                      <th className={th}>Số tiền</th>
                      <th className={th}>Chọn nhân sự</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ambiguous.map((r) => {
                      const idx = rows.indexOf(r);
                      const candidates = r.result.kind === "ambiguous" ? r.result.candidates : [];
                      return (
                        <tr key={idx}>
                          <td className="px-3 py-1.5 font-medium">{r.row.name}</td>
                          <td className={`num ${td}`}>
                            {r.row.amount !== null ? formatCurrency(r.row.amount) : "—"}
                          </td>
                          <td className={td}>
                            <Select
                              value={choices[idx] ?? ""}
                              onValueChange={(v) => setChoices((prev) => ({ ...prev, [idx]: v }))}
                            >
                              <SelectTrigger className="h-8 w-[240px]">
                                <SelectValue placeholder="Bỏ qua dòng này" />
                              </SelectTrigger>
                              <SelectContent>
                                {candidates.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.full_name} {c.id_number ? `(${c.id_number})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {unmatched.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Không khớp — sẽ bỏ qua:</p>
                <ul className="list-inside list-disc text-muted-foreground">
                  {unmatched.slice(0, 20).map((r, i) => (
                    <li key={i}>
                      {r.row.name || r.row.cccd || "(trống)"}
                      {r.row.amount !== null ? ` — ${formatCurrency(r.row.amount)}` : ""}
                    </li>
                  ))}
                  {unmatched.length > 20 && <li>… và {unmatched.length - 20} dòng khác</li>}
                </ul>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Huỷ
          </Button>
          <Button disabled={rows.length === 0 || resolvedCount === 0 || saving} onClick={() => void confirm()}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Lưu {resolvedCount > 0 ? `${resolvedCount} dòng` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SalaryTab({
  period,
  employees,
  salaryByEmp,
  baseSalaries,
  loading,
}: {
  period: string;
  employees: Employee[];
  salaryByEmp: Map<string, SalaryRow>;
  baseSalaries: Map<string, number | null>;
  loading: boolean;
}) {
  const client = useQueryClient();
  const units = useHrUnits();
  const [search, setSearch] = useState("");
  const [confirmFill, setConfirmFill] = useState(false);
  const [filling, setFilling] = useState(false);

  const unitName = (id: string | null) =>
    id === null ? "Chưa phân loại" : (units.data ?? []).find((u) => u.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const term = normalizeName(search);
    if (!term) return employees;
    return employees.filter(
      (e) => normalizeName(e.full_name).includes(term) || (e.id_number ?? "").includes(search.trim()),
    );
  }, [employees, search]);

  const fillCandidates = useMemo(
    () =>
      employees.filter((e) => !salaryByEmp.has(e.id) && (baseSalaries.get(e.id) ?? null) !== null),
    [employees, salaryByEmp, baseSalaries],
  );

  const fillFromContracts = async () => {
    setFilling(true);
    try {
      const rows = fillCandidates.map((e) => ({
        employee_id: e.id,
        period,
        amount: baseSalaries.get(e.id)!,
        source: "contract",
      }));
      const { error } = await supabase.from("hr_salaries").upsert(rows, { onConflict: "employee_id,period" });
      if (error) throw error;
      toast.success(`Đã điền lương cơ bản cho ${rows.length} dòng còn trống`, {
        description: "Các dòng nguồn Hợp đồng cần được xem lại trước khi gửi.",
      });
      setConfirmFill(false);
      void client.invalidateQueries({ queryKey: ["hr_salaries"] });
    } catch (e) {
      toast.error("Không điền được từ hợp đồng", { description: (e as Error).message });
    } finally {
      setFilling(false);
    }
  };

  const th = "px-3 py-3 font-medium whitespace-nowrap";
  const td = "px-3 py-2 whitespace-nowrap text-muted-foreground";

  return (
    <div className="panel overflow-x-auto p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Tìm theo tên, số CCCD…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ExcelImportDialog
          period={period}
          employees={employees}
          onImported={() => {
            void client.invalidateQueries({ queryKey: ["hr_salaries"] });
            void client.invalidateQueries({ queryKey: ["salary_employees"] });
          }}
        />
        <Button variant="outline" disabled={fillCandidates.length === 0} onClick={() => setConfirmFill(true)}>
          Điền từ lương cơ bản trong hợp đồng ({fillCandidates.length} dòng trống)
        </Button>
      </div>

      {loading ? (
        <p className="px-2 py-10 text-center text-sm text-muted-foreground">Đang tải dữ liệu…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="Không có nhân sự" description="Thử đổi từ khoá tìm kiếm." />
      ) : (
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className={th}>Họ và tên</th>
              <th className={th}>Đầu mục</th>
              <th className={th}>Email</th>
              <th className={`${th} text-right`}>Số tiền (VNĐ)</th>
              <th className={th}>Ghi chú</th>
              <th className={th}>Nguồn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((e) => {
              const s = salaryByEmp.get(e.id);
              return (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{e.full_name}</td>
                  <td className={td}>{unitName(e.unit_id)}</td>
                  <td className={td}>{e.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <AmountCell employeeId={e.id} period={period} existing={s} />
                  </td>
                  <td className="px-3 py-2">
                    <NoteCell existing={s} />
                  </td>
                  <td className={td}>{s ? (SALARY_SOURCE_LABEL[s.source] ?? s.source) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <Dialog open={confirmFill} onOpenChange={setConfirmFill}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Điền lương từ hợp đồng</DialogTitle>
            <DialogDescription>
              Hệ thống sẽ điền lương cơ bản trong hợp đồng vào {fillCandidates.length} dòng còn TRỐNG của kỳ{" "}
              {period}. Các dòng đã có số tiền không bị thay đổi. Dữ liệu nguồn "Hợp đồng" cần bạn xem lại
              trước khi gửi thư.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmFill(false)}>
              Huỷ
            </Button>
            <Button disabled={filling} onClick={() => void fillFromContracts()}>
              {filling && <Loader2 className="mr-2 size-4 animate-spin" />}
              Điền {fillCandidates.length} dòng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Tab 2: Mẫu email ============

function TemplateTab({
  templates,
  employees,
  salaryByEmp,
  period,
}: {
  templates: Template[];
  employees: Employee[];
  salaryByEmp: Map<string, SalaryRow>;
  period: string;
}) {
  const client = useQueryClient();
  const units = useHrUnits();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const startNew = () => {
    setEditingId(null);
    setName("");
    setSubject("Thông báo lương tháng {{Thang}}");
    setBody(DEFAULT_TEMPLATE_BODY);
  };

  const loadTemplate = (t: Template) => {
    setEditingId(t.id);
    setName(t.name);
    setSubject(t.subject);
    setBody(t.body);
  };

  useEffect(() => {
    if (templates.length > 0 && editingId === null && !name && !body) loadTemplate(templates[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

  const insertPlaceholder = (key: string) => {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast.error("Cần nhập đủ tên mẫu, tiêu đề và nội dung.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("hr_email_templates")
          .update({ name: name.trim(), subject: subject.trim(), body })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("hr_email_templates")
          .insert({ name: name.trim(), subject: subject.trim(), body })
          .select("id")
          .single();
        if (error) throw error;
        setEditingId(data.id);
      }
      toast.success("Đã lưu mẫu email");
      void client.invalidateQueries({ queryKey: ["hr_email_templates"] });
    } catch (e) {
      toast.error("Không lưu được mẫu", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editingId) return;
    const { error } = await supabase.from("hr_email_templates").delete().eq("id", editingId);
    if (error) {
      toast.error("Không xoá được mẫu", { description: error.message });
      return;
    }
    toast.success("Đã xoá mẫu");
    setEditingId(null);
    setName("");
    setSubject("");
    setBody("");
    void client.invalidateQueries({ queryKey: ["hr_email_templates"] });
  };

  const previewEmp = employees.find((e) => e.id === previewId) ?? employees[0];
  const preview = useMemo(() => {
    if (!previewEmp) return null;
    const unitName =
      previewEmp.unit_id === null
        ? "Chưa phân loại"
        : (units.data ?? []).find((u) => u.id === previewEmp.unit_id)?.name ?? null;
    const values = salaryMailValues({
      fullName: previewEmp.full_name,
      period: period || "2026-01",
      amount: salaryByEmp.get(previewEmp.id)?.amount ?? null,
      unitName,
      position: previewEmp.position,
      department: previewEmp.department,
    });
    return buildSalaryMail(subject, body, values);
  }, [previewEmp, subject, body, salaryByEmp, period, units.data]);

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <div className="panel p-3">
        <Button variant="outline" size="sm" className="mb-2 w-full" onClick={startNew}>
          <Plus className="mr-2 size-4" />
          Mẫu mới
        </Button>
        <ul className="space-y-1">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => loadTemplate(t)}
                className={`w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                  t.id === editingId ? "bg-accent font-medium" : "hover:bg-accent/60"
                }`}
              >
                {t.name}
              </button>
            </li>
          ))}
          {templates.length === 0 && (
            <li className="px-2 py-4 text-center text-xs text-muted-foreground">
              Chưa có mẫu nào. Bấm "Mẫu mới" để soạn.
            </li>
          )}
        </ul>
      </div>

      <div className="panel space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="tpl-name">Tên mẫu</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Thông báo lương hàng tháng"
            />
          </div>
          <div>
            <Label htmlFor="tpl-subject">Tiêu đề thư</Label>
            <Input
              id="tpl-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="VD: Thông báo lương tháng {{Thang}}"
            />
          </div>
        </div>
        <div>
          <Label>Nội dung thư (văn bản thường, xuống dòng được giữ nguyên)</Label>
          <Textarea
            ref={bodyRef}
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="font-mono text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Chèn vùng:</span>
          {SALARY_PLACEHOLDERS.map((p) => (
            <Button
              key={p.key}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              title={p.label}
              onClick={() => insertPlaceholder(p.key)}
            >
              {`{{${p.key}}}`}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Lưu mẫu
          </Button>
          {editingId && (
            <Button variant="outline" onClick={() => void remove()}>
              <Trash2 className="mr-2 size-4" />
              Xoá mẫu
            </Button>
          )}
        </div>

        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Xem trước với nhân sự:</span>
            <Select value={previewEmp?.id ?? ""} onValueChange={setPreviewId}>
              <SelectTrigger className="h-8 w-[260px]">
                <SelectValue placeholder="Chọn nhân sự" />
              </SelectTrigger>
              <SelectContent>
                {employees.slice(0, 200).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {preview ? (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="mb-2 font-medium">Tiêu đề: {preview.subject}</p>
              {/* Giá trị đã được escape HTML trong buildSalaryMail */}
              <div dangerouslySetInnerHTML={{ __html: preview.html }} />
              {preview.missing.length > 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  Nhân sự này thiếu: {preview.missing.join(", ")} — sẽ bị chặn khi gửi thật.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có nhân sự để xem trước.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Tab 3: Gửi thư ============

function SendTab({
  period,
  employees,
  templates,
  salaryByEmp,
  sentSet,
  configured,
}: {
  period: string;
  employees: Employee[];
  templates: Template[];
  salaryByEmp: Map<string, SalaryRow>;
  sentSet: Set<string>;
  configured: boolean;
}) {
  const client = useQueryClient();
  const units = useHrUnits();
  const [templateId, setTemplateId] = useState("");
  const [unitKeys, setUnitKeys] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [resend, setResend] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<SalarySendResult[]>([]);
  const stopRef = useRef(false);

  useEffect(() => {
    if (!templateId && templates.length > 0) setTemplateId(templates[0]!.id);
  }, [templates, templateId]);

  const unitOptions = useMemo(() => {
    const list = (units.data ?? []).map((u) => ({
      key: u.id,
      name: u.name,
      count: employees.filter((e) => e.unit_id === u.id).length,
    }));
    return [
      ...list,
      { key: "none", name: "Chưa phân loại", count: employees.filter((e) => e.unit_id === null).length },
    ];
  }, [units.data, employees]);

  const candidates = useMemo(() => {
    const inUnits = employeesInUnits(employees, unitKeys);
    const term = normalizeName(search);
    if (!term) return inUnits;
    return inUnits.filter((e) => normalizeName(e.full_name).includes(term));
  }, [employees, unitKeys, search]);

  const selected = useMemo(() => candidates.filter((e) => !excluded.has(e.id)), [candidates, excluded]);

  const statusOf = (e: Employee): RecipientStatus =>
    recipientStatus({
      email: e.email,
      amount: salaryByEmp.get(e.id)?.amount ?? null,
      sentReal: sentSet.has(e.id),
      resend,
    });

  const ready = selected.filter((e) => statusOf(e) === "ready");
  const totalAmount = ready.reduce((sum, e) => sum + (salaryByEmp.get(e.id)?.amount ?? 0), 0);
  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const runSend = async (ids: string[], isResend: boolean) => {
    setSending(true);
    stopRef.current = false;
    setResults([]);
    setProgress({ done: 0, total: ids.length });
    const all: SalarySendResult[] = [];
    for (let i = 0; i < ids.length; i += SEND_BATCH) {
      if (stopRef.current) break;
      const chunk = ids.slice(i, i + SEND_BATCH);
      try {
        const res = await sendSalaryBatch({
          data: { period, templateId, employeeIds: chunk, resend: isResend },
        });
        all.push(...res.results);
      } catch (e) {
        all.push(
          ...chunk.map((id) => ({ employeeId: id, status: "failed" as const, error: (e as Error).message })),
        );
      }
      setProgress({ done: Math.min(i + SEND_BATCH, ids.length), total: ids.length });
      setResults([...all]);
    }
    setSending(false);
    void client.invalidateQueries({ queryKey: ["salary_mail_log"] });
  };

  const sendTest = async () => {
    if (!isValidEmail(testEmail)) {
      toast.error("Email gửi thử không hợp lệ.");
      return;
    }
    const first = ready[0] ?? selected[0];
    if (!first) {
      toast.error("Chưa chọn nhân sự nào để gửi thử.");
      return;
    }
    setTesting(true);
    try {
      const res = await sendSalaryBatch({
        data: { period, templateId, employeeIds: [first.id], resend: true, testEmail: testEmail.trim() },
      });
      const r = res.results[0];
      if (r?.status === "sent") toast.success(`Đã gửi thư thử của ${first.full_name} tới ${testEmail}`);
      else toast.error("Gửi thử thất bại", { description: r?.error ?? "Không rõ lỗi" });
      void client.invalidateQueries({ queryKey: ["salary_mail_log"] });
    } catch (e) {
      toast.error("Gửi thử thất bại", { description: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const failed = results.filter((r) => r.status === "failed");
  const sent = results.filter((r) => r.status === "sent");
  const skipped = results.filter((r) => r.status === "skipped");

  const th = "px-3 py-2.5 font-medium whitespace-nowrap";
  const td = "px-3 py-2 whitespace-nowrap text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-4">
        <p className="text-sm font-medium">Bước 1 — Chọn mẫu email</p>
        <Select value={templateId} onValueChange={setTemplateId}>
          <SelectTrigger className="w-[320px]">
            <SelectValue placeholder="Chọn mẫu email" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {templates.length === 0 && (
          <p className="text-sm text-muted-foreground">Chưa có mẫu nào — hãy tạo ở tab "Mẫu email".</p>
        )}
      </div>

      <div className="panel space-y-3 p-4">
        <p className="text-sm font-medium">Bước 2 — Chọn đầu mục và người nhận</p>
        <div className="flex flex-wrap gap-3">
          {unitOptions.map((u) => (
            <label key={u.key} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={unitKeys.includes(u.key)}
                onCheckedChange={(v) =>
                  setUnitKeys((prev) => (v ? [...prev, u.key] : prev.filter((k) => k !== u.key)))
                }
              />
              {u.name} ({u.count})
            </label>
          ))}
        </div>
        {unitKeys.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px]">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Tìm nhân sự…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExcluded(new Set())}
                disabled={candidates.length === 0}
              >
                Chọn tất cả ({candidates.length})
              </Button>
              <Button variant="outline" size="sm" onClick={() => setExcluded(new Set(candidates.map((e) => e.id)))}>
                Bỏ chọn hết
              </Button>
              <span className="text-sm text-muted-foreground">Đã chọn {selected.length} người</span>
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className={th}>Chọn</th>
                    <th className={th}>Họ và tên</th>
                    <th className={th}>Đầu mục</th>
                    <th className={th}>Email</th>
                    <th className={`${th} text-right`}>Số tiền</th>
                    <th className={th}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {candidates.map((e) => {
                    const st = statusOf(e);
                    const tone =
                      st === "ready" ? "success" : st === "sent" ? "info" : ("danger" as const);
                    return (
                      <tr key={e.id}>
                        <td className="px-3 py-2">
                          <Checkbox
                            aria-label={`Chọn ${e.full_name}`}
                            checked={!excluded.has(e.id)}
                            onCheckedChange={(v) =>
                              setExcluded((prev) => {
                                const next = new Set(prev);
                                if (v) next.delete(e.id);
                                else next.add(e.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-medium">{e.full_name}</td>
                        <td className={td}>
                          {e.unit_id === null
                            ? "Chưa phân loại"
                            : (units.data ?? []).find((u) => u.id === e.unit_id)?.name ?? "—"}
                        </td>
                        <td className={td}>{e.email ?? "—"}</td>
                        <td className={`num ${td} text-right`}>
                          {salaryByEmp.has(e.id) ? formatCurrency(salaryByEmp.get(e.id)!.amount) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge tone={tone}>{RECIPIENT_STATUS_LABEL[st]}</StatusBadge>
                        </td>
                      </tr>
                    );
                  })}
                  {candidates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        Không có nhân sự nào trong các đầu mục đã chọn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span>
                Sẵn sàng gửi: <strong>{ready.length}</strong> người
              </span>
              <span>
                Tổng số tiền: <strong className="num">{formatCurrency(totalAmount)}</strong>
              </span>
              <label className="flex cursor-pointer items-center gap-2">
                <Switch checked={resend} onCheckedChange={setResend} />
                Gửi lại cả người đã gửi kỳ này
              </label>
            </div>
          </>
        )}
      </div>

      <div className="panel space-y-3 p-4">
        <p className="text-sm font-medium">Bước 3 — Gửi thử và gửi hàng loạt</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-[260px]"
            type="email"
            placeholder="Email nhận thư thử"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={!configured || testing || sending || !templateId || selected.length === 0}
            onClick={() => void sendTest()}
          >
            {testing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mail className="mr-2 size-4" />}
            Gửi thử
          </Button>
          <Button
            disabled={!configured || sending || !templateId || ready.length === 0}
            onClick={() => setConfirmOpen(true)}
          >
            <Send className="mr-2 size-4" />
            Gửi {ready.length > 0 ? `${ready.length} thư` : "hàng loạt"}
          </Button>
          {sending && (
            <Button variant="outline" onClick={() => (stopRef.current = true)}>
              <StopCircle className="mr-2 size-4" />
              Dừng sau lô hiện tại
            </Button>
          )}
        </div>
        {!configured && (
          <p className="text-xs text-muted-foreground">
            Nút gửi đang tắt vì chưa cấu hình gửi email (khoá Resend / địa chỉ gửi).
          </p>
        )}
        {sending && (
          <div className="space-y-1">
            <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
            <p className="text-xs text-muted-foreground">
              Đã xử lý {progress.done}/{progress.total} thư…
            </p>
          </div>
        )}
        {results.length > 0 && !sending && (
          <div className="space-y-2 rounded-md border border-border p-3 text-sm">
            <p>
              Đã gửi: <strong className="text-green-700">{sent.length}</strong>
              {" · "}Lỗi: <strong className="text-destructive">{failed.length}</strong>
              {" · "}Bỏ qua: <strong>{skipped.length}</strong>
            </p>
            {failed.length > 0 && (
              <>
                <ul className="max-h-40 list-inside list-disc overflow-y-auto text-muted-foreground">
                  {failed.map((f) => (
                    <li key={f.employeeId}>
                      {empById.get(f.employeeId)?.full_name ?? f.employeeId}: {f.error}
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!configured}
                  onClick={() => void runSend(failed.map((f) => f.employeeId), true)}
                >
                  Gửi lại {failed.length} thư lỗi
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận gửi thông báo lương</DialogTitle>
            <DialogDescription>
              Gửi {ready.length} thư cho kỳ {period}, tổng số tiền{" "}
              <strong className="num">{formatCurrency(totalAmount)}</strong>. Mỗi nhân sự nhận một thư riêng,
              không ai thấy thư của người khác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Huỷ
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                void runSend(
                  ready.map((e) => e.id),
                  resend,
                );
              }}
            >
              <Send className="mr-2 size-4" />
              Gửi ngay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Tab 4: Lịch sử gửi ============

function HistoryTab({ period, logs, employees }: { period: string; logs: MailLog[]; employees: Employee[] }) {
  const [status, setStatus] = useState("all");
  const [unit, setUnit] = useState("all");
  const [exporting, setExporting] = useState(false);
  const units = useHrUnits();
  const unitByEmp = useMemo(() => new Map(employees.map((e) => [e.id, e.unit_id])), [employees]);

  const filtered = logs.filter((l) => {
    if (status !== "all" && l.status !== status) return false;
    if (unit !== "all") {
      const u = l.employee_id ? (unitByEmp.get(l.employee_id) ?? null) : null;
      if (unit === "none" ? u !== null : u !== unit) return false;
    }
    return true;
  });

  const unitName = (id: string | null) =>
    id === null ? "Chưa phân loại" : (units.data ?? []).find((u) => u.id === id)?.name ?? "—";

  const exportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.json_to_sheet(
        filtered.map((l, i) => ({
          STT: i + 1,
          "Thời gian": formatDateTime(l.created_at),
          "Họ và tên": l.employee_name ?? "",
          "Đầu mục": unitName(l.employee_id ? (unitByEmp.get(l.employee_id) ?? null) : null),
          Email: l.email ?? "",
          "Kỳ lương": l.period ?? "",
          "Số tiền": l.amount != null ? Number(l.amount) : "",
          "Loại thư": l.kind === "test" ? "Gửi thử" : "Gửi thật",
          "Trạng thái": l.status === "sent" ? "Đã gửi" : "Lỗi",
          "Lý do lỗi": l.error ?? "",
        })),
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Lich su gui luong");
      XLSX.writeFile(wb, withTimestampedName("Lich_su_gui_luong.docx").replace(/\.docx$/, ".xlsx"));
      toast.success(`Đã xuất ${filtered.length} dòng ra Excel`);
    } catch (e) {
      toast.error("Xuất Excel thất bại", { description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const th = "px-3 py-2.5 font-medium whitespace-nowrap";
  const td = "px-3 py-2 whitespace-nowrap text-muted-foreground";

  return (
    <div className="panel overflow-x-auto p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi trạng thái</SelectItem>
            <SelectItem value="sent">Đã gửi</SelectItem>
            <SelectItem value="failed">Lỗi</SelectItem>
          </SelectContent>
        </Select>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả đầu mục</SelectItem>
            {(units.data ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
            <SelectItem value="none">Chưa phân loại</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={exporting || filtered.length === 0} onClick={() => void exportExcel()}>
          {exporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileSpreadsheet className="mr-2 size-4" />}
          Xuất Excel
        </Button>
        <span className="text-sm text-muted-foreground">
          {filtered.length} bản ghi kỳ {period}
        </span>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="Chưa có lịch sử gửi" description="Các thư đã gửi trong kỳ này sẽ hiện ở đây." />
      ) : (
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className={th}>Thời gian</th>
              <th className={th}>Họ và tên</th>
              <th className={th}>Đầu mục</th>
              <th className={th}>Email</th>
              <th className={`${th} text-right`}>Số tiền</th>
              <th className={th}>Loại</th>
              <th className={th}>Trạng thái</th>
              <th className={th}>Lý do lỗi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((l) => (
              <tr key={l.id}>
                <td className={`num ${td}`}>{formatDateTime(l.created_at)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-medium">{l.employee_name ?? "—"}</td>
                <td className={td}>{unitName(l.employee_id ? (unitByEmp.get(l.employee_id) ?? null) : null)}</td>
                <td className={td}>{l.email ?? "—"}</td>
                <td className={`num ${td} text-right`}>{l.amount != null ? formatCurrency(Number(l.amount)) : "—"}</td>
                <td className={td}>{l.kind === "test" ? "Gửi thử" : "Gửi thật"}</td>
                <td className="px-3 py-2">
                  <StatusBadge tone={l.status === "sent" ? "success" : "danger"}>
                    {l.status === "sent" ? "Đã gửi" : "Lỗi"}
                  </StatusBadge>
                </td>
                <td className={`max-w-[260px] truncate ${td}`}>{l.error ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { ModuleTabs } from "@/components/ModuleTabs";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { EMPLOYEE_CONTRACT_STATUS } from "@/lib/hr";
import { formatCurrency, formatDate } from "@/lib/format";
import { withTimestampedName } from "@/lib/docx";

export const Route = createFileRoute("/_app/nhan-su/du-lieu")({
  head: () => ({
    meta: [
      { title: "Dữ liệu nhân sự — OfficeFlow" },
      { name: "description", content: "Bảng tổng hợp mỗi nhân viên một dòng: thông tin cá nhân, bằng cấp và hợp đồng hiện tại." },
      { property: "og:title", content: "Dữ liệu nhân sự — OfficeFlow" },
      { property: "og:description", content: "Tra cứu, lọc và xuất Excel dữ liệu tổng hợp theo từng nhân sự." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeeDataPage,
});

const PAGE_SIZE = 50;
type SortKey = "full_name" | "start_date" | "end_date";

type Filters = { q: string; dept: string; status: string; sort: SortKey; asc: boolean };

const COLS = "id,full_name,date_of_birth,id_number,id_issue_date,id_issue_place,hometown,position,department,degree_name,degree_major,degree_school,contract_number,contract_type,base_salary,start_date,end_date,contract_status,latest_document_id";

function buildQuery(f: Filters, withCount: boolean) {
  let q = supabase
    .from("employee_summary_view")
    .select(COLS, withCount ? { count: "exact" } : undefined);
  const term = f.q.trim().replace(/[,%()]/g, " ");
  if (term) q = q.or(`full_name.ilike.%${term}%,department.ilike.%${term}%,id_number.ilike.%${term}%`);
  if (f.dept) q = q.eq("department", f.dept);
  if (f.status === "none") q = q.is("contract_status", null);
  else if (f.status) q = q.eq("contract_status", f.status);
  return q.order(f.sort, { ascending: f.asc, nullsFirst: false }).order("id");
}

function EmployeeDataPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<SortKey>("full_name");
  const [asc, setAsc] = useState(true);
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(search), 350);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(0), [q, dept, status, sort, asc]);

  const filters: Filters = { q, dept, status, sort, asc };

  const data = useQuery({
    queryKey: ["employee_summary", filters, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const { data, error, count } = await buildQuery(filters, true).range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
  });

  const depts = useQuery({
    queryKey: ["employee_summary", "departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("department").not("department", "is", null).limit(5000);
      if (error) throw error;
      return [...new Set((data ?? []).map((r) => r.department as string))].sort((a, b) => a.localeCompare(b, "vi"));
    },
  });

  const rows = data.data?.rows ?? [];
  const total = data.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSort = (k: SortKey) => {
    if (sort === k) setAsc(!asc);
    else {
      setSort(k);
      setAsc(true);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const all: typeof rows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await buildQuery(filters, false).range(from, from + 999);
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.json_to_sheet(
        all.map((r, i) => ({
          STT: i + 1,
          "Họ và tên": r.full_name,
          "Ngày sinh": r.date_of_birth ?? "",
          "Số CCCD": r.id_number ?? "",
          "Ngày cấp CCCD": r.id_issue_date ?? "",
          "Nơi cấp CCCD": r.id_issue_place ?? "",
          "Quê quán": r.hometown ?? "",
          "Chức vụ": r.position ?? "",
          "Phòng ban": r.department ?? "",
          "Số hợp đồng": r.contract_number ?? "",
          "Loại hợp đồng": r.contract_type ?? "",
          "Lương cơ bản": r.base_salary != null ? Number(r.base_salary) : "",
          "Ngày bắt đầu": r.start_date ? formatDate(r.start_date) : "",
          "Ngày kết thúc": r.end_date ? formatDate(r.end_date) : "",
          "Trạng thái HĐ": r.contract_status ? (EMPLOYEE_CONTRACT_STATUS[r.contract_status]?.label ?? r.contract_status) : "",
          "Bằng cấp": r.degree_name ?? "",
          "Chuyên ngành": r.degree_major ?? "",
          "Trường cấp bằng": r.degree_school ?? "",
        })),
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Du lieu nhan su");
      XLSX.writeFile(wb, withTimestampedName("Du_lieu_nhan_su.docx").replace(/\.docx$/, ".xlsx"));
      toast.success(`Đã xuất ${all.length} nhân sự ra Excel`);
    } catch (e) {
      toast.error(`Xuất Excel thất bại: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const SortHead = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="px-3 py-3 font-medium">
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase hover:text-foreground">
        {label}
        {sort !== k ? <ArrowUpDown className="size-3 opacity-50" /> : asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      </button>
    </th>
  );
  const th = "px-3 py-3 font-medium whitespace-nowrap";
  const td = "px-3 py-2.5 whitespace-nowrap text-muted-foreground";

  return (
    <div>
      <PageHeader
        title="Dữ liệu nhân sự"
        description="Mỗi nhân viên một dòng, gộp thông tin gốc, dữ liệu mới nhất từ hồ sơ đã quét và hợp đồng hiện tại. Chỉ xem, không chỉnh sửa tại đây."
        actions={
          <Button onClick={() => void exportExcel()} disabled={exporting || total === 0}>
            {exporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileSpreadsheet className="mr-2 size-4" />}
            Xuất Excel
          </Button>
        }
      />
      <ModuleTabs />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Tìm theo tên, phòng ban, số CCCD…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">Tất cả phòng ban</option>
          {(depts.data ?? []).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Mọi trạng thái hợp đồng</option>
          {Object.entries(EMPLOYEE_CONTRACT_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
          <option value="none">Chưa có hợp đồng</option>
        </select>
      </div>

      <div className="panel overflow-x-auto">
        {data.isLoading ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Đang tải dữ liệu…</p>
        ) : data.isError ? (
          <p className="px-4 py-12 text-center text-sm text-destructive">Không tải được dữ liệu: {(data.error as Error).message}</p>
        ) : rows.length === 0 ? (
          <EmptyState title="Không có nhân sự phù hợp" description="Thử đổi từ khoá hoặc bộ lọc." />
        ) : (
          <table className="w-full min-w-[1800px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <SortHead k="full_name" label="Họ và tên" />
                <th className={th}>Ngày sinh</th>
                <th className={th}>Số CCCD</th>
                <th className={th}>Quê quán</th>
                <th className={th}>Chức vụ</th>
                <th className={th}>Phòng ban</th>
                <th className={th}>Số hợp đồng</th>
                <th className={th}>Loại hợp đồng</th>
                <th className={`${th} text-right`}>Lương cơ bản</th>
                <SortHead k="start_date" label="Ngày vào" />
                <SortHead k="end_date" label="Hạn hợp đồng" />
                <th className={th}>Trạng thái</th>
                <th className={th}>Bằng cấp</th>
                <th className={th}>Chuyên ngành</th>
                <th className={th}>Trường</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-border ${data.isFetching ? "opacity-60" : ""}`}>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer transition-colors hover:bg-accent/50"
                  onClick={() =>
                    r.latest_document_id
                      ? void navigate({ to: "/nhan-su/$documentId", params: { documentId: r.latest_document_id } })
                      : void navigate({ to: "/nhan-su" })
                  }
                >
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium">{r.full_name}</td>
                  <td className={`num ${td}`}>{r.date_of_birth ?? "—"}</td>
                  <td className={`num ${td}`}>{r.id_number ?? "—"}</td>
                  <td className={`max-w-[220px] truncate ${td}`}>{r.hometown ?? "—"}</td>
                  <td className={td}>{r.position ?? "—"}</td>
                  <td className={td}>{r.department ?? "—"}</td>
                  <td className={td}>{r.contract_number ?? "—"}</td>
                  <td className={td}>{r.contract_type ?? "—"}</td>
                  <td className={`num ${td} text-right`}>{r.base_salary != null ? formatCurrency(Number(r.base_salary)) : "—"}</td>
                  <td className={`num ${td}`}>{r.start_date ? formatDate(r.start_date) : "—"}</td>
                  <td className={`num ${td}`}>{r.end_date ? formatDate(r.end_date) : "—"}</td>
                  <td className="px-3 py-2.5">
                    {r.contract_status ? (
                      <StatusBadge tone={EMPLOYEE_CONTRACT_STATUS[r.contract_status]?.tone}>
                        {EMPLOYEE_CONTRACT_STATUS[r.contract_status]?.label ?? r.contract_status}
                      </StatusBadge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={td}>{r.degree_name ?? "—"}</td>
                  <td className={td}>{r.degree_major ?? "—"}</td>
                  <td className={`max-w-[220px] truncate ${td}`}>{r.degree_school ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} nhân sự · trang {page + 1}/{pages}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-4" /> Trước
          </Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            Sau <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

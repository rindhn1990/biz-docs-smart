import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HrUnitSelect } from "@/components/HrUnitSelect";
import { employeeEditPatch, type EmployeeEditValues } from "@/lib/employee-edit";

const emptyValues: EmployeeEditValues = { full_name: "", email: "", address: "", hometown: "", id_number: "", position: "", department: "", date_of_birth: "", unit_id: "none" };

export function HrEmployeeDialog({ employee }: { employee?: { id: string; full_name: string | null; unit_id: string | null; email?: string | null } }) {
  const { canWrite, isAdmin } = useAuth(); const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<EmployeeEditValues>(emptyValues);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const change = (key: keyof EmployeeEditValues, value: string) => setValues((prev) => ({ ...prev, [key]: value }));
  const openEditor = async () => {
    setLoadError(false);
    setValues(emptyValues);
    if (!employee) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("employees").select("full_name,email,address,hometown,id_number,position,department,date_of_birth,unit_id").eq("id", employee.id).single();
      if (error) throw error;
      setValues({ full_name: data.full_name, email: data.email ?? "", address: data.address ?? "", hometown: data.hometown ?? "", id_number: data.id_number ?? "", position: data.position ?? "", department: data.department ?? "", date_of_birth: data.date_of_birth ?? "", unit_id: data.unit_id ?? "none" });
    } catch (e) {
      setLoadError(true);
      toast.error("Không tải được thông tin nhân sự", { description: (e as Error).message });
    } finally { setLoading(false); }
  };
  const save = useMutation({ mutationFn: async () => {
    if (loading || loadError || !canWrite) throw new Error("Không thể lưu thông tin nhân sự.");
    const patch = employeeEditPatch(values, isAdmin);
    const result = employee ? await supabase.from("employees").update(patch).eq("id", employee.id).select("id").single() : await supabase.from("employees").insert(patch).select("id").single();
    if (result.error) throw result.error;
  }, onSuccess: () => { setOpen(false); setValues(emptyValues); void client.invalidateQueries({ predicate: (q) => /^(employee|hr_|salary_)/.test(String(q.queryKey[0])) }); toast.success("Đã lưu nhân sự"); }, onError: (e: Error) => toast.error("Không lưu được nhân sự", { description: e.message }) });
  if (!canWrite) return null;
  return <span onClick={(e) => e.stopPropagation()}><Dialog open={open} onOpenChange={(v) => { if (save.isPending) return; setOpen(v); if (v) void openEditor(); }}>
    <DialogTrigger asChild><Button variant="outline" size={employee ? "icon" : "default"} aria-label={employee ? `Sửa ${employee.full_name}` : "Thêm nhân sự"} title={employee ? "Sửa nhân sự" : "Thêm nhân sự"}>{employee ? <Pencil className="size-4" /> : <><UserPlus className="size-4" />Thêm nhân sự</>}</Button></DialogTrigger>
    <DialogContent aria-describedby={undefined} className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{employee ? "Sửa nhân sự" : "Thêm nhân sự"}</DialogTitle></DialogHeader>
      {loading && <p className="text-sm text-muted-foreground">Đang tải thông tin…</p>}
      {loadError && <p className="text-sm text-destructive">Không tải được thông tin. Vui lòng đóng và mở lại.</p>}
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <fieldset disabled={loading || loadError || save.isPending} className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 sm:col-span-2"><span className="text-sm">Họ và tên</span><Input aria-label="Họ và tên" value={values.full_name} onChange={(e) => change("full_name", e.target.value)} required /></label>
        {isAdmin && <label className="block space-y-2 sm:col-span-2"><span className="text-sm">Email (nhận thông báo lương)</span><Input aria-label="Email" type="email" value={values.email} onChange={(e) => change("email", e.target.value)} placeholder="ten@congty.vn" /></label>}
        <label className="block space-y-2 sm:col-span-2"><span className="text-sm">Địa chỉ liên hệ</span><Input aria-label="Địa chỉ liên hệ" value={values.address} onChange={(e) => change("address", e.target.value)} /></label>
        {([['hometown', 'Quê quán'], ['id_number', 'Số CCCD'], ['position', 'Chức vụ'], ['department', 'Phòng ban']] as const).map(([key, label]) => <label key={key} className="block space-y-2"><span className="text-sm">{label}</span><Input aria-label={label} value={values[key]} onChange={(e) => change(key, e.target.value)} /></label>)}
        <label className="block space-y-2"><span className="text-sm">Ngày sinh</span><Input aria-label="Ngày sinh" type="date" value={values.date_of_birth} onChange={(e) => change("date_of_birth", e.target.value)} /></label>
        <div className="space-y-2"><span className="text-sm">Đầu mục</span><HrUnitSelect value={values.unit_id} onChange={(v) => change("unit_id", v)} /></div>
        </fieldset>
        <Button type="submit" disabled={loading || loadError || !values.full_name.trim() || save.isPending}>Lưu nhân sự</Button>
      </form>
    </DialogContent>
  </Dialog></span>;
}
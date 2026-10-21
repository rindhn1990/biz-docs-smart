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

export function HrEmployeeDialog({ employee }: { employee?: { id: string; full_name: string | null; unit_id: string | null; email?: string | null } }) {
  const { canWrite } = useAuth(); const client = useQueryClient();
  const [open, setOpen] = useState(false); const [name, setName] = useState(employee?.full_name ?? ""); const [unit, setUnit] = useState(employee?.unit_id ?? "none");
  const [email, setEmail] = useState(employee?.email ?? "");
  const save = useMutation({ mutationFn: async () => {
    const values = { full_name: name.trim(), unit_id: unit === "none" ? null : unit, email: email.trim() || null };
    const result = employee ? await supabase.from("employees").update(values).eq("id", employee.id) : await supabase.from("employees").insert(values);
    if (result.error) throw result.error;
  }, onSuccess: () => { setOpen(false); if (!employee) { setName(""); setUnit("none"); } void client.invalidateQueries({ predicate: (q) => /^(employee|hr_)/.test(String(q.queryKey[0])) }); toast.success("Đã lưu nhân sự"); }, onError: (e: Error) => toast.error("Không lưu được nhân sự", { description: e.message }) });
  if (!canWrite) return null;
  return <span onClick={(e) => e.stopPropagation()}><Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v && employee) { setName(employee.full_name ?? ""); setUnit(employee.unit_id ?? "none"); setEmail(employee.email ?? ""); } }}>
    <DialogTrigger asChild><Button variant="outline" size={employee ? "icon" : "default"} aria-label={employee ? `Sửa ${employee.full_name}` : "Thêm nhân sự"} title={employee ? "Sửa nhân sự" : "Thêm nhân sự"}>{employee ? <Pencil className="size-4" /> : <><UserPlus className="size-4" />Thêm nhân sự</>}</Button></DialogTrigger>
    <DialogContent aria-describedby={undefined}><DialogHeader><DialogTitle>{employee ? "Sửa nhân sự" : "Thêm nhân sự"}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <label className="block space-y-2"><span className="text-sm">Họ và tên</span><Input aria-label="Họ và tên" value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="block space-y-2"><span className="text-sm">Email (nhận thông báo lương)</span><Input aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ten@congty.vn" /></label>
        <div className="space-y-2"><span className="text-sm">Đầu mục</span><HrUnitSelect value={unit} onChange={setUnit} /></div>
        <Button type="submit" disabled={!name.trim() || save.isPending}>Lưu nhân sự</Button>
      </form>
    </DialogContent>
  </Dialog></span>;
}
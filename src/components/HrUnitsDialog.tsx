import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, FolderTree, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { useAuth } from "@/hooks/useAuth";
import { useHrUnits } from "@/hooks/useHrUnits";
import { supabase } from "@/integrations/supabase/client";

export function HrUnitsDialog() {
  const { canWrite, isAdmin } = useAuth();
  const units = useHrUnits();
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const mutation = useMutation({ mutationFn: async (action: { kind: "add" | "rename" | "delete" | "reorder"; id?: string; name?: string; ids?: string[] }) => {
    const result = action.kind === "add"
      ? await supabase.from("hr_units").insert({ name: action.name?.trim() ?? "", sort_order: Math.max(0, ...(units.data ?? []).map((u) => u.sort_order ?? 0)) + 1 })
      : action.kind === "rename" && action.id ? await supabase.from("hr_units").update({ name: action.name?.trim() ?? "" }).eq("id", action.id)
      : action.kind === "delete" && action.id ? await supabase.from("hr_units").delete().eq("id", action.id)
      : await supabase.rpc("reorder_hr_units", { _ids: action.ids ?? [] });
    if (result.error) throw new Error(result.error.code === "23505" ? "Tên đầu mục đã tồn tại (không phân biệt hoa/thường)." : result.error.message);
    return action;
  }, onSuccess: (action) => {
    if (action.kind === "add") setName("");
    if (action.id) setNames((prev) => { const next = { ...prev }; delete next[action.id ?? ""]; return next; });
    void client.invalidateQueries({ predicate: (q) => /^(employee|hr_)/.test(String(q.queryKey[0])) });
    toast.success(action.kind === "delete" ? "Đã xoá đầu mục; nhân sự chuyển về Chưa phân loại" : "Đã lưu đầu mục");
  }, onError: (e: Error) => toast.error("Không lưu được đầu mục", { description: e.message }) });
  const move = (index: number, delta: number) => {
    const ids = (units.data ?? []).flatMap((u) => u.id ? [u.id] : []);
    const current = ids[index]; const other = ids[index + delta];
    if (!current || !other) return;
    ids[index] = other; ids[index + delta] = current;
    mutation.mutate({ kind: "reorder", ids });
  };
  return <Dialog><DialogTrigger asChild><Button variant="outline"><FolderTree className="size-4" />Quản lý đầu mục</Button></DialogTrigger>
    <DialogContent className="max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>Quản lý đầu mục nhân sự</DialogTitle></DialogHeader>
      {canWrite && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) mutation.mutate({ kind: "add", name }); }}>
        <Input aria-label="Tên đầu mục mới" placeholder="Tên đầu mục mới" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={!name.trim() || mutation.isPending}><Plus className="size-4" />Thêm</Button>
      </form>}
      {units.isError && <p className="text-sm text-destructive">Không tải được đầu mục.</p>}
      <div className="divide-y divide-border">
        {(units.data ?? []).map((u, index) => u.id && <div key={u.id} className="flex items-center gap-2 py-3">
          <div className="min-w-0 flex-1"><Input aria-label={`Tên đầu mục ${u.name}`} value={names[u.id] ?? u.name ?? ""} readOnly={!canWrite} onChange={(e) => setNames({ ...names, [u.id ?? ""]: e.target.value })} />
            <span className="text-xs text-muted-foreground">{u.employee_count ?? 0} nhân sự</span></div>
          {canWrite && <>
            <Button variant="ghost" size="icon" aria-label={`Lưu tên ${u.name}`} title="Lưu tên" disabled={!names[u.id]?.trim() || mutation.isPending} onClick={() => mutation.mutate({ kind: "rename", id: u.id, name: names[u.id] ?? u.name })}><Check className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label={`Đưa ${u.name} lên`} title="Đưa lên" disabled={index === 0 || mutation.isPending} onClick={() => move(index, -1)}><ArrowUp className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label={`Đưa ${u.name} xuống`} title="Đưa xuống" disabled={index === (units.data?.length ?? 0) - 1 || mutation.isPending} onClick={() => move(index, 1)}><ArrowDown className="size-4" /></Button>
          </>}
          {isAdmin && <ConfirmDelete title={`Xoá đầu mục ${u.name}?`} description={`${u.employee_count ?? 0} nhân sự chuyển về “Chưa phân loại”. Không xoá nhân sự, hồ sơ hay hợp đồng. Không thể hoàn tác thao tác xoá đầu mục.`} onConfirm={() => mutation.mutateAsync({ kind: "delete", id: u.id ?? undefined }).then(() => undefined)}>
            <Button variant="ghost" size="icon" className="text-destructive" aria-label={`Xoá đầu mục ${u.name}`} title="Xoá đầu mục" disabled={mutation.isPending}><Trash2 className="size-4" /></Button>
          </ConfirmDelete>}
        </div>)}
      </div>
    </DialogContent>
  </Dialog>;
}
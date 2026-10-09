import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  loadInheritedSources,
  moduleSourceFields,
  resolveSource,
  type TemplateModule,
} from "@/lib/template-resolve";

type Row = { id: string; placeholder: string; label: string; source_field: string | null; value: string | null };
type Proposal = { id: string; placeholder: string; key: string; via: "name" | "inherit" | "label" };

const VIA: Record<Proposal["via"], string> = {
  name: "trùng tên",
  inherit: "theo mẫu khác",
  label: "trùng nhãn",
};

/** Admin: đề xuất nguồn cho các vùng chưa có nguồn, xem trước rồi mới lưu. */
export function AutoAssignSources({
  rows,
  module,
  onSaved,
}: {
  rows: Row[];
  module: TemplateModule;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [props, setProps] = useState<Proposal[]>([]);
  const [left, setLeft] = useState<Row[]>([]);
  const fields = moduleSourceFields(module);
  const labelOf = (k: string) => fields.find((f) => f.key === k)?.label ?? k;

  async function scan() {
    setLoading(true);
    try {
      const inherited = await loadInheritedSources(module);
      const keys = fields.map((f) => f.key);
      const p: Proposal[] = [];
      const l: Row[] = [];
      for (const m of rows) {
        if (m.source_field) continue;
        const r = resolveSource(m, keys, inherited, fields);
        if (r) p.push({ id: m.id, placeholder: m.placeholder, key: r.key, via: r.via });
        else l.push(m);
      }
      setProps(p);
      setLeft(l);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      for (const p of props) {
        const { error } = await supabase.from("template_mappings").update({ source_field: p.key }).eq("id", p.id);
        if (error) throw error;
      }
      toast.success(`Đã gán nguồn cho ${props.length} vùng`);
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error("Không lưu được", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={loading || rows.length === 0}
        onClick={() => void scan()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
        Tự động gán nguồn dữ liệu
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Tự động gán nguồn dữ liệu</AlertDialogTitle>
            <AlertDialogDescription>
              Kiểm tra đề xuất bên dưới. Vùng đã có nguồn hoặc giá trị cố định không bị thay đổi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[55vh] space-y-4 overflow-y-auto text-sm">
            <div>
              <p className="mb-1 text-xs font-semibold">Đề xuất ({props.length})</p>
              {props.length === 0 ? (
                <p className="text-xs text-muted-foreground">Không có đề xuất nào.</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {props.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className="num truncate">{p.placeholder}</span>
                      <span className="truncate text-right text-xs">
                        → {labelOf(p.key)} <span className="num text-muted-foreground">({p.key})</span>
                        <span className="ml-1 rounded bg-muted px-1 text-muted-foreground">{VIA[p.via]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {left.length ? (
              <div>
                <p className="mb-1 text-xs font-semibold text-warning-foreground">
                  Không tìm được nguồn — cần gán tay ({left.length})
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {left.map((m) => (
                    <li key={m.id} className="num rounded border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs">
                      {m.placeholder}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <Button disabled={saving || props.length === 0} onClick={() => void save()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Lưu {props.length} nguồn
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

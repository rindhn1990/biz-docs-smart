import { useEffect, useRef, useState } from "react";
import { FileSearch, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { detectTemplateValues } from "@/lib/docx";

type Mapping = { id: string; placeholder: string; label: string; value: string | null };
type Candidate = Mapping & { nextValue: string; selected: boolean; confidence: string };

export function TemplateAutoDetect({
  storagePath,
  mappings,
  onClose,
  onSaved,
}: {
  storagePath: string;
  mappings: Mapping[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => setRows([]), []);

  async function scan(file: File) {
    setBusy(true);
    setFileName(file.name);
    try {
      const { data, error } = await supabase.storage.from("templates").download(storagePath);
      if (error || !data) throw error ?? new Error("Không tải được mẫu gốc");
      const detected = detectTemplateValues(await data.arrayBuffer(), await file.arrayBuffer());
      setRows(
        mappings.map((mapping) => {
          const result = detected.find((item) => item.placeholder === mapping.placeholder);
          return {
            ...mapping,
            nextValue: result?.value ?? "",
            selected: Boolean(result?.value),
            confidence: result?.confidence ?? "low",
          };
        }),
      );
      toast.success("Đã đối chiếu file hoàn chỉnh", {
        description: `Nhận diện được ${detected.filter((item) => item.value).length}/${mappings.length} vùng dữ liệu.`,
      });
    } catch (error) {
      toast.error("Không đối chiếu được file", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const selected = rows.filter((row) => row.selected && row.nextValue.trim());
      const results = await Promise.all(
        selected.map((row) =>
          supabase
            .from("template_mappings")
            .update({ value: row.nextValue.trim() })
            .eq("id", row.id),
        ),
      );
      const failed = results.find((result) => result.error)?.error;
      if (failed) throw failed;
      onSaved();
      toast.success(`Đã lưu ${selected.length} giá trị đã duyệt`);
      onClose();
    } catch (error) {
      toast.error("Không lưu được dữ liệu", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold">Quét dữ liệu từ file hoàn chỉnh</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Mẫu đang chọn là mẫu gốc. Kiểm tra và sửa các giá trị đề xuất trước khi lưu.
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Đóng" onClick={onClose}>
            <X />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <input
            ref={inputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void scan(file);
            }}
          />
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="animate-spin" /> : <FileSearch />}
              Chọn file hoàn chỉnh
            </Button>
            {fileName ? <span className="text-sm text-muted-foreground">{fileName}</span> : null}
          </div>
          {rows.length ? (
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="px-2 py-2">Dùng</th><th className="px-2 py-2">Vùng dữ liệu</th><th className="px-2 py-2">Giá trị nhận diện</th><th className="px-2 py-2">Tin cậy</th></tr></thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="px-2 py-2"><input type="checkbox" checked={row.selected} onChange={(event) => setRows((current) => current.map((item, i) => i === index ? { ...item, selected: event.target.checked } : item))} /></td>
                    <td className="px-2 py-2"><span className="font-medium">{row.label}</span><span className="block text-xs text-muted-foreground">{row.placeholder}</span></td>
                    <td className="px-2 py-2"><input className="input" value={row.nextValue} onChange={(event) => setRows((current) => current.map((item, i) => i === index ? { ...item, nextValue: event.target.value, selected: Boolean(event.target.value) } : item))} placeholder="Chưa nhận diện" /></td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">{row.confidence === "high" ? "Cao" : row.confidence === "medium" ? "Trung bình" : "Cần kiểm tra"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Chọn file Word hoàn chỉnh tương ứng với mẫu gốc này.</p>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button disabled={busy || !rows.some((row) => row.selected && row.nextValue.trim())} onClick={() => void save()}>Xác nhận và lưu</Button>
        </footer>
      </div>
    </div>
  );
}
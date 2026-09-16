import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ScanLine, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { scanFileFields } from "@/lib/scan.functions";
import { buildScanPayload } from "@/lib/scan-client";

export type ScanField = { key: string; label: string };
type Row = ScanField & { value: string; confidence: number; selected: boolean };

/**
 * Hộp thoại dùng chung: chọn ảnh chụp / PDF / Word, để AI đọc nội dung và đề xuất giá trị
 * cho từng trường. Người dùng luôn phải kiểm tra rồi mới xác nhận đưa vào hồ sơ.
 */
export function ScanFileDialog({
  title,
  description,
  fields,
  note,
  onApply,
  onClose,
}: {
  title: string;
  description: string;
  fields: ScanField[];
  note?: string;
  onApply: (values: Record<string, string>) => Promise<void> | void;
  onClose: () => void;
}) {
  const scan = useServerFn(scanFileFields);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setFileName(file.name);
    setRows([]);
    try {
      const payload = await buildScanPayload(file);
      const result = await scan({
        data: { ...payload, fields, ...(note ? { note } : {}) },
      });
      const found = new Map(result.values.map((v) => [v.key, v]));
      const next = fields.map((field) => {
        const hit = found.get(field.key);
        return {
          ...field,
          value: hit?.value ?? "",
          confidence: hit?.confidence ?? 0,
          selected: Boolean(hit?.value),
        };
      });
      setRows(next);
      const count = next.filter((r) => r.value).length;
      if (count === 0) {
        toast.warning("Không tìm thấy thông tin nào trong tệp này", {
          description: "Hãy thử ảnh rõ nét hơn hoặc nhập tay.",
        });
      } else {
        toast.success(`Đã nhận diện ${count}/${fields.length} thông tin`, {
          description: "Kiểm tra lại trước khi xác nhận.",
        });
      }
    } catch (error) {
      toast.error("Không quét được tệp", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    const values: Record<string, string> = {};
    for (const row of rows) if (row.selected && row.value.trim()) values[row.key] = row.value.trim();
    setBusy(true);
    try {
      await onApply(values);
      onClose();
    } catch (error) {
      toast.error("Không lưu được dữ liệu", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Đóng" onClick={onClose}>
            <X />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf,.pdf,.docx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleFile(file);
            }}
          />
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="animate-spin" /> : <ScanLine />}
              Chọn ảnh chụp, PDF hoặc Word
            </Button>
            {fileName ? <span className="text-sm text-muted-foreground">{fileName}</span> : null}
          </div>

          {rows.length ? (
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2">Dùng</th>
                  <th className="px-2 py-2">Thông tin</th>
                  <th className="px-2 py-2">Giá trị đọc được</th>
                  <th className="px-2 py-2">Tin cậy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, index) => (
                  <tr key={row.key}>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, selected: event.target.checked } : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <span className="font-medium">{row.label}</span>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className="input"
                        value={row.value}
                        placeholder="Chưa đọc được"
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    value: event.target.value,
                                    selected: Boolean(event.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">
                      {row.value ? `${Math.round(row.confidence * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Chọn một ảnh chụp tài liệu, file PDF hoặc file Word để hệ thống đọc và điền giúp bạn.
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            disabled={busy || !rows.some((row) => row.selected && row.value.trim())}
            onClick={() => void apply()}
          >
            {busy ? <Loader2 className="animate-spin" /> : null}
            Xác nhận điền dữ liệu
          </Button>
        </footer>
      </div>
    </div>
  );
}

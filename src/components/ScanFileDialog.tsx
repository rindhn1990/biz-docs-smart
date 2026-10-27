import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardPaste, Focus, Loader2, RotateCcw, ScanLine, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DocumentRegionSelector } from "@/components/DocumentRegionSelector";
import { scanFileFields } from "@/lib/scan.functions";
import { buildScanPayload } from "@/lib/scan-client";
import { extractFieldsLocallyDetailed, normalizeRegionValue } from "@/lib/field-extract";
import { mergeScanRows, WholeFileTextCache, type ScanRow } from "@/lib/scan-session";

async function extractLocalText(file: File, onProgress: (msg: string) => void) {
  const mod = await import("@/lib/local-ocr");
  return mod.extractLocalText(file, onProgress);
}

export type ScanField = { key: string; label: string };
type Row = ScanRow;

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
  const [mode, setMode] = useState<"local" | "ai">("local");
  const [progress, setProgress] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [regionCount, setRegionCount] = useState(0);
  const [thumb, setThumb] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [targetField, setTargetField] = useState<ScanField | null>(null);
  const [selectorVersion, setSelectorVersion] = useState(0);
  const textCache = useRef(new WholeFileTextCache());
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const busyRef = useRef(false);
  busyRef.current = busy;

  function pickFile(file: File) {
    textCache.current.clear();
    setWarnings([]);
    setTargetField(null);
    setFileName(file.name);
    setRows([]);
    setRegionCount(0);
    setThumb((old) => {
      if (old) URL.revokeObjectURL(old);
      return file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    });
    if (file.name.toLowerCase().endsWith(".docx")) {
      setSelectedFile(null);
      void handleFile(file);
    } else {
      setSelectedFile(file);
    }
  }

  function namedImage(blob: Blob) {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
    return new File([blob], `screenshot-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`, {
      type: blob.type || "image/png",
    });
  }

  const pickRef = useRef(pickFile);
  pickRef.current = pickFile;
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (busyRef.current) return;
      const target = e.target as HTMLElement | null;
      const items = Array.from(e.clipboardData?.items ?? []);
      const fileItem = items.find((i) => i.kind === "file");
      if (!fileItem) return; // để ô nhập chữ dán bình thường
      const f = fileItem.getAsFile();
      if (!f) return;
      if (target?.tagName === "INPUT" && !f.type.startsWith("image/")) return;
      e.preventDefault();
      const isImage = f.type.startsWith("image/");
      const ok = isImage || /\.(pdf|docx)$/i.test(f.name);
      if (!ok) {
        toast.error("Chỉ nhận ảnh, PDF hoặc file Word (.docx).");
        return;
      }
      pickRef.current(isImage && (!f.name || f.name === "image.png") ? namedImage(f) : f);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function pasteFromClipboard() {
    try {
      if (!navigator.clipboard?.read) throw new Error("unsupported");
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          pickFile(namedImage(await item.getType(type)));
          return;
        }
      }
      toast.warning("Clipboard không có ảnh", { description: "Hãy chụp màn hình rồi bấm Ctrl+V trong hộp thoại này." });
    } catch {
      toast.info("Trình duyệt chặn đọc clipboard", {
        description: "Hãy bấm Ctrl+V (hoặc ⌘+V trên Mac) ngay trong hộp thoại này để dán ảnh.",
      });
    }
  }

  function restartScan() {
    setRows([]);
    rowsRef.current = [];
    setWarnings([]);
    setTargetField(null);
    setRegionCount(0);
    textCache.current.clear();
    setSelectorVersion((value) => value + 1);
  }

  async function handleFile(file: File, selectedRegions = 0, regionNumbers: number[] = []) {
    setBusy(true);
    setRegionCount(selectedRegions);
    const source = selectedRegions ? `vùng ${regionNumbers.join(", ") || selectedRegions}` : "toàn trang";
    try {
      if (file.size === 0) throw new Error("Tệp rỗng, không đọc được nội dung.");
      if (file.size > 10 * 1024 * 1024) throw new Error("Tệp lớn hơn 10MB. Hãy giảm dung lượng rồi thử lại.");

      // Bước 1: đọc chữ cục bộ (0 token)
      let text = "";
      let techError: string | null = null;
      try {
        text = await textCache.current.read(file, selectedRegions === 0 && !targetField, async () => {
          const local = await extractLocalText(file, setProgress);
          return local.text;
        });
        if (text.replace(/\s/g, "").length < 5) techError = "Bộ đọc chữ không trả về nội dung nào (ảnh quá mờ hoặc trang trắng).";
      } catch (err) {
        techError = `Lỗi hệ thống khi đọc tệp: ${(err as Error).message || "không rõ nguyên nhân"}`;
      }
      if (techError && mode === "local") {
        throw new Error(`${techError} Đây là lỗi đọc chữ, không phải do tài liệu thiếu thông tin — hãy thử lại hoặc dùng "Quét bằng AI".`);
      }
      if (targetField && selectedRegions > 0) {
        if (techError) throw new Error(techError);
        const value = normalizeRegionValue(targetField, text);
        if (!value) throw new Error("Không đọc được giá trị trong vùng đã khoanh.");
        setRows((current) => current.map((row) => row.key === targetField.key
          ? { ...row, value, confidence: 0.9, selected: true, source, edited: true }
          : row));
        setTargetField(null);
        toast.success(`Đã đọc vùng cho ${targetField.label}`);
        return;
      }
      const localResult = extractFieldsLocallyDetailed(text, fields);
      setWarnings((current) => [...new Set([...current, ...localResult.warnings])]);
      const found = new Map<string, { key: string; value: string; confidence: number; source?: string }>();
      for (const v of localResult.values) found.set(v.key, v);
      const localCount = found.size;

      const updateRows = () => setRows((current) => mergeScanRows(current, fields, [...found.values()], source));
      updateRows();

      // Bước 2: chỉ gửi AI các trường còn thiếu
      let aiCount = 0;
      const missing = fields.filter((f) => !found.has(f.key));
      if (mode === "ai" && missing.length) {
        const usable = text.replace(/\s/g, "").length >= 30;
        let payload: { fileName: string; mimeType: string; content: string };
        if (usable || file.name.toLowerCase().endsWith(".docx")) {
          payload = { fileName: file.name, mimeType: "text/plain", content: text.slice(0, 120_000) || " " };
        } else {
          setProgress("Chữ quá mờ, gửi ảnh gốc cho AI đọc…");
          payload = await buildScanPayload(file);
        }
        setProgress(`AI đang bổ sung ${missing.length} trường còn thiếu…`);
        const result = await scan({
          data: { ...payload, fields: missing, ...(note ? { note } : {}) },
        });
        for (const v of result.values) {
          if (!found.has(v.key) && v.value) {
            found.set(v.key, v);
            aiCount++;
          }
        }
        updateRows();
      }

      if (localCount + aiCount === 0) {
        toast.warning("Không tìm thấy thông tin nào trong tệp này", {
          description:
            mode === "local" ? "Hãy thử \"Quét bằng AI\" hoặc nhập tay." : "Hãy thử ảnh rõ nét hơn hoặc nhập tay.",
        });
      } else {
        toast.success(`Đã nhận diện ${localCount + aiCount}/${fields.length} thông tin`, {
          description:
            (selectedRegions ? `Đã đọc ${selectedRegions} vùng · ` : "") +
            `Quét thường (0 token AI): ${localCount} trường` +
            (mode === "ai" ? ` · Bổ sung nhờ AI: ${aiCount} trường` : "") +
            ". Kiểm tra lại trước khi xác nhận.",
        });
      }
    } catch (error) {
      toast.error("Không quét được tệp", { description: (error as Error).message });
    } finally {
      setBusy(false);
      setProgress("");
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

        <div className="min-h-0 min-w-0 flex-1 overflow-auto p-5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf,.pdf,.docx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) pickFile(file);
            }}
          />
          <div role="radiogroup" className="mb-3 grid gap-2 sm:grid-cols-2">
            {(
              [
                ["local", "Quét thường", "Nhanh, không dùng AI (0 token)"],
                ["ai", "Quét bằng AI", "Bổ sung các trường mà quét thường không đọc được"],
              ] as const
            ).map(([value, label, desc]) => (
              <Button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                disabled={busy}
                onClick={() => setMode(value)}
                variant="outline"
                className={`h-auto flex-col items-start whitespace-normal rounded-md border px-3 py-2 text-left transition-colors ${
                  mode === value ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                }`}
              >
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{desc}</span>
              </Button>
            ))}
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file && !busy) pickFile(file);
            }}
            className={`mb-4 flex flex-wrap items-center gap-3 rounded-md border border-dashed p-3 transition-colors ${
              dragging ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            {thumb ? (
              <img src={thumb} alt="Ảnh vừa dán" className="size-14 rounded border border-border object-cover" />
            ) : (
              <ClipboardPaste className="size-6 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Dán ảnh (Ctrl+V) hoặc kéo thả file vào đây</p>
              <p className="text-xs text-muted-foreground">
                {thumb ? "Dán ảnh khác để thay ảnh hiện tại." : "Nhận ảnh chụp màn hình, ảnh, PDF hoặc Word."}
              </p>
            </div>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void pasteFromClipboard()}>
              <ClipboardPaste />
              Dán từ clipboard
            </Button>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="animate-spin" /> : <ScanLine />}
              Chọn ảnh chụp, PDF hoặc Word
            </Button>
            {fileName ? <span className="text-sm text-muted-foreground">{fileName}</span> : null}
            {progress ? <span className="text-xs text-muted-foreground">{progress}</span> : null}
            {fileName ? <Button variant="outline" size="sm" disabled={busy} onClick={restartScan}><RotateCcw /> Quét lại từ đầu</Button> : null}
          </div>

          {warnings.map((warning) => <p key={warning} role="alert" className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{warning}</p>)}
          {targetField ? <div className="mb-3 flex items-center justify-between gap-2 border border-primary p-3 text-sm"><span>Khoanh vùng: {targetField.label}</span><Button variant="ghost" size="sm" disabled={busy} onClick={() => setTargetField(null)}>Huỷ khoanh riêng</Button></div> : null}
          {selectedFile ? (
            <DocumentRegionSelector
              key={selectorVersion}
              file={selectedFile}
              disabled={busy}
              targetField={targetField?.key}
              onScan={async (scanFile, count, numbers) => {
                await handleFile(scanFile, count, numbers);
              }}
            />
          ) : null}

          {rows.length ? (
            <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2">Dùng</th>
                  <th className="px-2 py-2">Thông tin</th>
                  <th className="px-2 py-2">Giá trị đọc được</th>
                  <th className="px-2 py-2">Tin cậy</th>
                   <th className="px-2 py-2">Nguồn</th>
                   <th className="px-2 py-2" aria-label="Khoanh vùng riêng" />
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
                                     edited: true,
                                     source: "nhập tay",
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
                    <td className="px-2 py-2 text-xs text-muted-foreground">{row.source || "—"}</td>
                    <td className="px-2 py-2">
                      <Button variant="ghost" size="icon" disabled={busy || !selectedFile} aria-label={`Khoanh vùng cho trường này: ${row.label}`} title="Khoanh vùng cho trường này" onClick={() => {
                        setTargetField({ key: row.key, label: row.label });
                        document.querySelector('[aria-label="Khung tài liệu"]')?.scrollIntoView({ block: "center", behavior: "smooth" });
                      }}><Focus /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : selectedFile ? null : (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {regionCount
                ? `Đã quét ${regionCount} vùng. Chọn vùng khác hoặc kiểm tra dữ liệu đọc được.`
                : "Chọn một ảnh chụp tài liệu, file PDF hoặc file Word để hệ thống đọc và điền giúp bạn."}
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

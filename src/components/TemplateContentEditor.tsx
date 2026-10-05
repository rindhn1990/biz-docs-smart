import { useEffect, useMemo, useState } from "react";
import { Info, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { applyDocxParagraphEdits, listDocxParagraphs } from "@/lib/docx";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Sửa chữ trực tiếp trên file Word gốc: mỗi đoạn văn là một ô sửa, khi lưu chỉ thay phần chữ
 * trong đúng đoạn đó nên giữ nguyên định dạng, bảng, ảnh, lề, đầu/chân trang của file gốc.
 */
export function TemplateContentEditor({
  title,
  fileName,
  source,
  onClose,
  onSave,
}: {
  title: string;
  fileName: string;
  source: ArrayBuffer;
  onClose: () => void;
  onSave: (file: File) => Promise<void>;
}) {
  const original = useMemo(() => {
    try {
      return listDocxParagraphs(source);
    } catch (e) {
      toast.error("Không mở được nội dung mẫu", { description: (e as Error).message });
      return [];
    }
  }, [source]);
  const [texts, setTexts] = useState<string[]>(original);
  const [showEmpty, setShowEmpty] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => setTexts(original), [original]);

  const changed = texts.filter((t, i) => t !== original[i]).length;

  async function save() {
    setSaving(true);
    try {
      const buffer = applyDocxParagraphEdits(source, texts);
      const name = fileName.toLowerCase().endsWith(".docx") ? fileName : `${fileName}.docx`;
      await onSave(new File([buffer], name, { type: DOCX_MIME }));
      onClose();
    } catch (e) {
      toast.error("Không lưu được nội dung mẫu", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Chỉnh sửa nội dung mẫu: {title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Mỗi ô là một đoạn trong file Word. Chỗ trống viết dạng {"{{TEN_CHO_TRONG}}"} hoặc [[Ten_cho_trong]].
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Đóng" onClick={onClose}>
            <X />
          </Button>
        </header>

        <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/50 px-5 py-2 text-xs">
          <span className="flex items-start gap-2">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Định dạng gốc (phông chữ, canh lề, bảng, logo, đầu/chân trang) được giữ nguyên. Muốn thêm/xoá
            đoạn, đổi bố cục hay định dạng thì sửa trong Word rồi dùng "Thay file Word".
          </span>
          <label className="flex shrink-0 items-center gap-1.5">
            <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />
            Hiện đoạn trống
          </label>
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-muted/30 p-5">
          {original.length === 0 ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang mở nội dung mẫu…
            </p>
          ) : null}
          {texts.map((text, i) =>
            !showEmpty && !(original[i] ?? "").trim() && !text.trim() ? null : (
              <div key={i} className="flex items-start gap-2">
                <span className="w-8 shrink-0 pt-2 text-right text-[10px] text-muted-foreground">{i + 1}</span>
                <textarea
                  value={text}
                  disabled={saving}
                  rows={Math.max(1, Math.ceil(text.length / 95))}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\n/g, " ");
                    setTexts((prev) => prev.map((t, j) => (j === i ? v : t)));
                  }}
                  className={`w-full resize-y rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring ${
                    text !== original[i] ? "border-primary" : "border-input"
                  }`}
                />
              </div>
            ),
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground">{changed} đoạn đã sửa</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Huỷ
            </Button>
            <Button onClick={() => void save()} disabled={saving || changed === 0}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              Lưu vào file Word
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

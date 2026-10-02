import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bold,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Save,
  Table as TableIcon,
  Underline,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { docxToHtml } from "@/lib/docx";
import { htmlToDocxBlob } from "@/lib/html-to-docx";

/** Soạn thảo nội dung file mẫu Word ngay trên web rồi lưu lại thành .docx mới. */
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
  const editorRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    docxToHtml(source)
      .then((html) => {
        if (alive && editorRef.current) editorRef.current.innerHTML = html || "<p></p>";
      })
      .catch((e: Error) => toast.error("Không mở được nội dung mẫu", { description: e.message }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [source]);

  function cmd(name: string) {
    editorRef.current?.focus();
    document.execCommand(name);
  }

  function insertTable() {
    editorRef.current?.focus();
    const cells = "<td>&nbsp;</td><td>&nbsp;</td>";
    document.execCommand(
      "insertHTML",
      false,
      `<table><tbody><tr>${cells}</tr><tr>${cells}</tr></tbody></table><p></p>`,
    );
  }

  async function save() {
    if (!editorRef.current) return;
    setSaving(true);
    try {
      const blob = await htmlToDocxBlob(editorRef.current.innerHTML);
      const name = fileName.toLowerCase().endsWith(".docx") ? fileName : `${fileName}.docx`;
      await onSave(new File([blob], name, { type: blob.type }));
      onClose();
    } catch (e) {
      toast.error("Không lưu được nội dung mẫu", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const tool =
    "inline-flex size-8 items-center justify-center rounded-md border border-input hover:bg-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Chỉnh sửa nội dung mẫu: {title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Gõ trực tiếp vào văn bản. Chỗ trống viết dạng {"{{TEN_CHO_TRONG}}"} hoặc [[Ten_cho_trong]].
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Đóng" onClick={onClose}>
            <X />
          </Button>
        </header>

        <div className="flex items-start gap-2 border-b border-border bg-warning/10 px-5 py-2 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <span>
            Khi lưu, một số định dạng phức tạp của file Word gốc (ảnh/logo, khung nền, canh lề chi
            tiết, kiểu bảng đặc biệt, đầu/chân trang) có thể bị đơn giản hoá hoặc mất. Nếu cần giữ
            nguyên 100% định dạng, hãy sửa trong Word rồi dùng "Thay file Word".
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-border px-5 py-2">
          <button type="button" className={tool} title="In đậm" onMouseDown={(e) => { e.preventDefault(); cmd("bold"); }}>
            <Bold className="size-4" />
          </button>
          <button type="button" className={tool} title="In nghiêng" onMouseDown={(e) => { e.preventDefault(); cmd("italic"); }}>
            <Italic className="size-4" />
          </button>
          <button type="button" className={tool} title="Gạch chân" onMouseDown={(e) => { e.preventDefault(); cmd("underline"); }}>
            <Underline className="size-4" />
          </button>
          <button type="button" className={tool} title="Danh sách gạch đầu dòng" onMouseDown={(e) => { e.preventDefault(); cmd("insertUnorderedList"); }}>
            <List className="size-4" />
          </button>
          <button type="button" className={tool} title="Danh sách đánh số" onMouseDown={(e) => { e.preventDefault(); cmd("insertOrderedList"); }}>
            <ListOrdered className="size-4" />
          </button>
          <button type="button" className={tool} title="Chèn bảng 2×2" onMouseDown={(e) => { e.preventDefault(); insertTable(); }}>
            <TableIcon className="size-4" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto bg-muted/40 p-5">
          {loading ? (
            <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang mở nội dung mẫu…
            </p>
          ) : null}
          <div
            ref={editorRef}
            contentEditable={!loading && !saving}
            suppressContentEditableWarning
            className="mx-auto min-h-[60vh] max-w-[820px] rounded-md border border-border bg-background p-8 text-sm leading-relaxed shadow-sm outline-none focus:ring-2 focus:ring-ring [&_h1]:mb-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:font-semibold [&_ol]:ml-6 [&_ol]:list-decimal [&_p]:mb-2 [&_table]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_ul]:ml-6 [&_ul]:list-disc"
          />
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button onClick={() => void save()} disabled={loading || saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Lưu thành file Word
          </Button>
        </footer>
      </div>
    </div>
  );
}

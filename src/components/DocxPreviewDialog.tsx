import { useEffect, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { renderAndDownloadDocx, renderDocxToHtml, type DelimiterStyle } from "@/lib/docx";

/**
 * Xem trước văn bản đúng như file sẽ tải xuống: dữ liệu đã được điền vào mẫu Word
 * rồi hiển thị ngay trên màn hình, kèm nút tải file.
 */
export function DocxPreviewDialog({
  title,
  fileName,
  source,
  style,
  data,
  onClose,
  onExported,
}: {
  title: string;
  fileName: string;
  source: ArrayBuffer;
  style: DelimiterStyle;
  data: Record<string, string>;
  onClose: () => void;
  /** Gọi sau khi người dùng tải file thành công (ghi lịch sử, làm mới biểu mẫu…). */
  onExported?: () => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let alive = true;
    renderDocxToHtml(source, style, data)
      .then((value) => {
        if (alive) setHtml(value);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [source, style, data]);

  async function download() {
    setDownloading(true);
    try {
      await renderAndDownloadDocx(source, style, data, fileName);
      toast.success("Đã tải file Word", { description: fileName });
      onExported?.();
      onClose();
    } catch (e) {
      toast.error("Không tải được file", { description: (e as Error).message });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Nội dung dưới đây đúng với file bạn sẽ tải xuống: {fileName}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Đóng" onClick={onClose}>
            <X />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40 p-5">
          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Không xem trước được: {error}
            </p>
          ) : html === null ? (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Đang dựng bản xem trước…
            </p>
          ) : (
            <article
              className="docx-preview mx-auto max-w-[820px] rounded-md border border-border bg-background p-8 text-sm leading-relaxed shadow-sm [&_h1]:mb-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:font-semibold [&_p]:mb-2 [&_table]:w-full [&_table_td]:border [&_table_td]:border-border [&_table_td]:p-1.5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button disabled={downloading} onClick={() => void download()}>
            {downloading ? <Loader2 className="animate-spin" /> : <Download />}
            Tải file Word
          </Button>
        </footer>
      </div>
    </div>
  );
}

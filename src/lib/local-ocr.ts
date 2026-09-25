/**
 * OCR / trích xuất chữ chạy hoàn toàn trên trình duyệt (0 token AI).
 * Thư viện được nạp động để không ảnh hưởng tải trang và không chạy phía máy chủ.
 */
import { docxPlainText } from "./docx";

export type LocalText = { text: string; source: "docx" | "pdf-text" | "ocr" };

async function ocrImages(images: (Blob | HTMLCanvasElement)[], onProgress?: (msg: string) => void) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["vie", "eng"]);
  try {
    const parts: string[] = [];
    for (let i = 0; i < images.length; i++) {
      onProgress?.(images.length > 1 ? `Đang đọc chữ trang ${i + 1}/${images.length}…` : "Đang đọc chữ trong ảnh…");
      const { data } = await worker.recognize(images[i]!);
      parts.push(data.text);
    }
    return parts.join("\n");
  } finally {
    await worker.terminate();
  }
}

async function pdfText(file: File, onProgress?: (msg: string) => void): Promise<LocalText> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const maxPages = Math.min(doc.numPages, 15);
  onProgress?.("Đang đọc lớp chữ của PDF…");
  const lines: string[] = [];
  for (let p = 1; p <= maxPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = "";
    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      if (typeof item.str !== "string") continue;
      const y = item.transform?.[5] ?? 0;
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line);
        line = "";
      }
      line += item.str;
      lastY = y;
    }
    if (line) lines.push(line);
  }
  const text = lines.join("\n");
  if (text.replace(/\s/g, "").length >= 30) return { text, source: "pdf-text" };

  // PDF ảnh scan → render trang ra canvas rồi OCR
  const canvases: HTMLCanvasElement[] = [];
  for (let p = 1; p <= Math.min(maxPages, 5); p++) {
    onProgress?.(`Đang chuyển trang ${p} sang ảnh…`);
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport } as Parameters<typeof page.render>[0]).promise;
    canvases.push(canvas);
  }
  return { text: await ocrImages(canvases, onProgress), source: "ocr" };
}

/** Lấy văn bản của tệp bằng công cụ cục bộ. Ném lỗi nếu không hỗ trợ. */
export async function extractLocalText(file: File, onProgress?: (msg: string) => void): Promise<LocalText> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".docx")) {
    return { text: docxPlainText(await file.arrayBuffer()), source: "docx" };
  }
  if (file.type === "application/pdf" || lower.endsWith(".pdf")) return pdfText(file, onProgress);
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp)$/.test(lower)) {
    return { text: await ocrImages([file], onProgress), source: "ocr" };
  }
  throw new Error("Chỉ hỗ trợ ảnh chụp, PDF hoặc file Word (.docx).");
}

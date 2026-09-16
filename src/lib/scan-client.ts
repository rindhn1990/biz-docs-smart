import { docxPlainText } from "./docx";

export type ScanPayload = { fileName: string; mimeType: string; content: string };

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

/** Chuẩn bị nội dung tệp để gửi đi nhận dạng: ảnh/PDF gửi base64, Word gửi văn bản thuần. */
export async function buildScanPayload(file: File): Promise<ScanPayload> {
  const name = file.name || "tai-lieu";
  const lower = name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (buffer.byteLength === 0) throw new Error("Tệp rỗng, không đọc được nội dung.");
  if (buffer.byteLength > 10 * 1024 * 1024) {
    throw new Error("Tệp lớn hơn 10MB. Hãy tách nhỏ hoặc giảm dung lượng ảnh rồi thử lại.");
  }

  if (lower.endsWith(".docx")) {
    const text = docxPlainText(buffer).trim();
    if (!text) throw new Error("Không đọc được chữ trong file Word này.");
    return { fileName: name, mimeType: "text/plain", content: text };
  }

  const mime =
    file.type ||
    (lower.endsWith(".pdf")
      ? "application/pdf"
      : lower.endsWith(".png")
        ? "image/png"
        : "image/jpeg");

  if (!mime.startsWith("image/") && mime !== "application/pdf") {
    throw new Error("Chỉ hỗ trợ ảnh chụp, PDF hoặc file Word (.docx).");
  }

  return { fileName: name, mimeType: mime, content: toBase64(buffer) };
}

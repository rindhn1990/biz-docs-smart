import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";

export type DelimiterStyle = "curly" | "square";

export const DELIMITERS: Record<DelimiterStyle, { start: string; end: string }> = {
  curly: { start: "{{", end: "}}" },
  square: { start: "[[", end: "]]" },
};

const PLACEHOLDER_RE = /\{\{[A-Za-z0-9_]+\}\}|\[\[[A-Za-z0-9_]+\]\]/g;

function decodeXml(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Gộp text của các run liền kề trong cùng một <w:p> rồi mới dò placeholder,
 * vì Word thường tách "[[Ten_bien]]" thành nhiều <w:t> khác nhau.
 */
export function extractPlaceholdersFromDocumentXml(xml: string): {
  placeholders: string[];
  style: DelimiterStyle;
} {
  const paragraphs = xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? [xml];
  const found: string[] = [];
  let square = 0;
  let curly = 0;

  for (const p of paragraphs) {
    const runs = p.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) ?? [];
    const merged = decodeXml(runs.map((r) => r.replace(/<[^>]+>/g, "")).join(""));
    for (const match of merged.match(PLACEHOLDER_RE) ?? []) {
      const name = match.slice(2, -2);
      if (match.startsWith("[[")) square++;
      else curly++;
      if (!found.includes(name)) found.push(name);
    }
  }

  return { placeholders: found, style: square >= curly && square > 0 ? "square" : "curly" };
}

export async function extractPlaceholdersFromFile(file: File | Blob) {
  const zip = new PizZip(await file.arrayBuffer());
  const xml = zip.file("word/document.xml")?.asText() ?? "";
  return extractPlaceholdersFromDocumentXml(xml);
}

/** "Ten_goi_thau" → "Ten goi thau" (nhãn hiển thị gợi ý). */
export function prettifyPlaceholder(name: string) {
  const words = name.split("_").filter(Boolean);
  if (words.length === 0) return name;
  const first = words[0] ?? name;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...words.slice(1)].join(" ");
}

/** Render file .docx gốc với dữ liệu đã ánh xạ rồi tải xuống. */
export async function renderAndDownloadDocx(
  source: ArrayBuffer,
  style: DelimiterStyle,
  data: Record<string, string>,
  fileName: string,
) {
  const zip = new PizZip(source);
  const doc = new Docxtemplater(zip, {
    delimiters: DELIMITERS[style],
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render(data);
  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });
  saveAs(blob, fileName);
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Chuyển file .docx thành HTML để xem trước (dùng mammoth, chỉ chạy phía trình duyệt). */
export async function docxToHtml(source: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser.js");
  const convert = (mammoth as unknown as { convertToHtml: (o: unknown) => Promise<{ value: string }> })
    .convertToHtml;
  const result = await convert({ arrayBuffer: source });
  return result.value;
}

/**
 * Thay đoạn chữ `needle` trong file .docx bằng token chỗ trống (ví dụ "{{TEN_GOI_THAU}}"),
 * giữ nguyên định dạng của các run không bị ảnh hưởng.
 */
export function replacePhraseWithToken(
  source: ArrayBuffer,
  needle: string,
  token: string,
): { buffer: ArrayBuffer; count: number } {
  const zip = new PizZip(source);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Không đọc được nội dung file Word");
  let xml = file.asText();
  const target = needle.replace(/\s+/g, " ").trim();
  if (!target) throw new Error("Chưa chọn đoạn chữ nào");

  const paragraphRe = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let count = 0;
  xml = xml.replace(paragraphRe, (paragraph) => {
    const runRe = /(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/g;
    type Slot = { open: string; close: string; text: string; at: number; len: number; start: number };
    const slots: Slot[] = [];
    let merged = "";
    let m: RegExpExecArray | null;
    while ((m = runRe.exec(paragraph)) !== null) {
      const raw = m[2] ?? "";
      const text = decodeXml(raw);
      slots.push({
        open: m[1] ?? "<w:t>",
        close: m[3] ?? "</w:t>",
        text,
        at: m.index,
        len: m[0].length,
        start: merged.length,
      });
      merged += text;
    }
    if (slots.length === 0) return paragraph;

    const normalized = merged.replace(/\s+/g, " ");
    const idxNorm = normalized.indexOf(target);
    if (idxNorm === -1) return paragraph;

    // Ánh xạ vị trí trên chuỗi đã chuẩn hoá về chuỗi gốc.
    const mapping: number[] = [];
    let prevSpace = false;
    for (let i = 0; i < merged.length; i++) {
      const ch = merged[i] ?? "";
      if (/\s/.test(ch)) {
        if (prevSpace) continue;
        prevSpace = true;
      } else prevSpace = false;
      mapping.push(i);
    }
    const start = mapping[idxNorm] ?? 0;
    const endNorm = idxNorm + target.length;
    const end = endNorm >= mapping.length ? merged.length : (mapping[endNorm] ?? merged.length);

    let out = paragraph;
    let inserted = false;
    for (let i = slots.length - 1; i >= 0; i--) {
      const slot = slots[i]!;
      const s = slot.start;
      const e = s + slot.text.length;
      if (e <= start || s >= end) continue;
      const before = slot.text.slice(0, Math.max(0, start - s));
      const after = slot.text.slice(Math.max(0, Math.min(slot.text.length, end - s)));
      const isFirst = s <= start;
      const next = before + (isFirst ? token : "") + after;
      if (isFirst) inserted = true;
      const open = slot.open.includes("xml:space")
        ? slot.open
        : slot.open.replace(/>$/, ' xml:space="preserve">');
      out =
        out.slice(0, slot.at) + open + escapeXml(next) + slot.close + out.slice(slot.at + slot.len);
    }
    if (inserted) count++;
    return out;
  });

  if (count === 0) {
    throw new Error("Không tìm thấy đoạn chữ này trong file Word (có thể nằm ở nhiều đoạn khác nhau)");
  }
  zip.file("word/document.xml", xml);
  const uint = zip.generate({ type: "uint8array", compression: "DEFLATE" }) as Uint8Array;
  const buffer = new ArrayBuffer(uint.byteLength);
  new Uint8Array(buffer).set(uint);
  return { buffer, count };
}

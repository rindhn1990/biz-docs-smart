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

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";

export type DelimiterStyle = "curly" | "square";

export const DELIMITERS: Record<DelimiterStyle, { start: string; end: string }> = {
  curly: { start: "{{", end: "}}" },
  square: { start: "[[", end: "]]" },
};

const PLACEHOLDER_RE = /\{\{[A-Za-z0-9_]+\}\}|\[\[[A-Za-z0-9_]+\]\]/g;

export type DetectedTemplateValue = {
  placeholder: string;
  value: string;
  confidence: "high" | "medium" | "low";
};

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

function paragraphTexts(source: ArrayBuffer): string[] {
  const zip = new PizZip(source);
  const xml = zip.file("word/document.xml")?.asText() ?? "";
  return (xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? [])
    .map((paragraph) =>
      decodeXml(
        (paragraph.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) ?? [])
          .map((run) => run.replace(/<[^>]+>/g, ""))
          .join(""),
      )
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Đối chiếu từng đoạn của mẫu và bản hoàn chỉnh để đề xuất giá trị thay placeholder. */
export function detectTemplateValues(
  templateSource: ArrayBuffer,
  completedSource: ArrayBuffer,
): DetectedTemplateValue[] {
  const templateParagraphs = paragraphTexts(templateSource);
  const completedParagraphs = paragraphTexts(completedSource);
  const results: DetectedTemplateValue[] = [];

  for (let index = 0; index < templateParagraphs.length; index++) {
    const template = templateParagraphs[index] ?? "";
    const tokens = template.match(PLACEHOLDER_RE) ?? [];
    if (tokens.length === 0) continue;
    const parts = template.split(PLACEHOLDER_RE);
    const pattern = parts.map(escapeRegExp).join("([\\s\\S]*?)");
    const exactCandidate = completedParagraphs[index] ?? "";
    let match = exactCandidate.match(new RegExp(`^${pattern}$`, "i"));
    let confidence: DetectedTemplateValue["confidence"] = "high";

    if (!match) {
      const anchor = parts.find((part) => part.trim().length >= 5)?.trim();
      const candidate = anchor
        ? completedParagraphs.find((paragraph) => paragraph.includes(anchor))
        : undefined;
      match = candidate?.match(new RegExp(`^${pattern}$`, "i")) ?? null;
      confidence = "medium";
    }

    tokens.forEach((token, tokenIndex) => {
      const placeholder = token.slice(2, -2);
      const value = match?.[tokenIndex + 1]?.trim() ?? "";
      results.push({ placeholder, value, confidence: value ? confidence : "low" });
    });
  }

  return results.filter(
    (result, index) => results.findIndex((item) => item.placeholder === result.placeholder) === index,
  );
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
  saveAs(blob, withTimestampedName(fileName));
}

/** "TotrinhKHLCNT.docx" → "TotrinhKHLCNT_14_05_02_10.docx" (giờ_phút_ngày_tháng). */
export function withTimestampedName(name: string, at: Date = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${p(at.getHours())}_${p(at.getMinutes())}_${p(at.getDate())}_${p(at.getMonth() + 1)}`;
  const m = name.match(/^(.*?)(\.docx)?$/i);
  const base = (m?.[1] || "file").trim();
  return `${base}_${stamp}${m?.[2] ?? ".docx"}`;
}

/** Render file .docx với dữ liệu rồi trả về HTML để xem trước ngay trên màn hình. */
export async function renderDocxToHtml(
  source: ArrayBuffer,
  style: DelimiterStyle,
  data: Record<string, string>,
): Promise<string> {
  const zip = new PizZip(source);
  const doc = new Docxtemplater(zip, {
    delimiters: DELIMITERS[style],
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render(data);
  const out = doc.getZip().generate({ type: "arraybuffer" }) as ArrayBuffer;
  return docxToHtml(out);
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

const PARA_RE = /<w:p[\s>][\s\S]*?<\/w:p>/g;
const RUN_T_RE = /(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/g;

/** Văn bản của từng đoạn trong document.xml (giữ đúng thứ tự, kể cả đoạn rỗng). */
export function listDocxParagraphs(source: ArrayBuffer): string[] {
  const xml = new PizZip(source).file("word/document.xml")?.asText() ?? "";
  return (xml.match(PARA_RE) ?? []).map((p) =>
    decodeXml((p.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) ?? []).map((r) => r.replace(/<[^>]+>/g, "")).join("")),
  );
}

function editParagraph(paragraph: string, next: string): string {
  type Slot = { open: string; close: string; text: string; at: number; len: number; start: number };
  const slots: Slot[] = [];
  let merged = "";
  let m: RegExpExecArray | null;
  const re = new RegExp(RUN_T_RE.source, "g");
  while ((m = re.exec(paragraph)) !== null) {
    const text = decodeXml(m[2] ?? "");
    slots.push({ open: m[1] ?? "<w:t>", close: m[3] ?? "</w:t>", text, at: m.index, len: m[0].length, start: merged.length });
    merged += text;
  }
  if (merged === next) return paragraph;
  if (slots.length === 0) {
    return paragraph.replace(/<\/w:p>$/, `<w:r><w:t xml:space="preserve">${escapeXml(next)}</w:t></w:r></w:p>`);
  }
  // Giữ phần đầu/cuối chung để các run không bị sửa vẫn nguyên định dạng.
  let pre = 0;
  while (pre < merged.length && pre < next.length && merged[pre] === next[pre]) pre++;
  let suf = 0;
  while (
    suf < merged.length - pre &&
    suf < next.length - pre &&
    merged[merged.length - 1 - suf] === next[next.length - 1 - suf]
  ) suf++;
  const start = pre;
  const end = merged.length - suf;
  const insert = next.slice(pre, next.length - suf);
  // Run nhận phần chèn: run chứa vị trí start (nếu start ở cuối run thì vẫn chèn vào run đó).
  let target = slots.findIndex((s) => start >= s.start && start < s.start + s.text.length);
  if (target === -1) target = slots.length - 1;
  let out = paragraph;
  for (let i = slots.length - 1; i >= 0; i--) {
    const slot = slots[i]!;
    const s = slot.start;
    const e = s + slot.text.length;
    const touches = i === target || (e > start && s < end);
    if (!touches) continue;
    const before = slot.text.slice(0, Math.max(0, Math.min(slot.text.length, start - s)));
    const after = slot.text.slice(Math.max(0, Math.min(slot.text.length, end - s)));
    const text = before + (i === target ? insert : "") + after;
    const open = slot.open.includes("xml:space") ? slot.open : slot.open.replace(/>$/, ' xml:space="preserve">');
    out = out.slice(0, slot.at) + open + escapeXml(text) + slot.close + out.slice(slot.at + slot.len);
  }
  return out;
}

/** Ghi văn bản đã sửa vào đúng từng đoạn của file gốc, giữ nguyên toàn bộ định dạng/bảng/ảnh/đầu chân trang. */
export function applyDocxParagraphEdits(source: ArrayBuffer, texts: string[]): ArrayBuffer {
  const zip = new PizZip(source);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Không đọc được nội dung file Word");
  let i = 0;
  const xml = file.asText().replace(PARA_RE, (p) => {
    const next = texts[i++];
    return next === undefined ? p : editParagraph(p, next);
  });
  zip.file("word/document.xml", xml);
  const uint = zip.generate({ type: "uint8array", compression: "DEFLATE" }) as Uint8Array;
  const buffer = new ArrayBuffer(uint.byteLength);
  new Uint8Array(buffer).set(uint);
  return buffer;
}

/** Toàn bộ văn bản thuần của một file .docx (mỗi đoạn một dòng). */
export function docxPlainText(source: ArrayBuffer): string {
  return paragraphTexts(source).join("\n");
}

/** Dò giá trị theo nhãn trong văn bản Word: "Tên gói thầu: Mua xe ô tô". */
export function matchLabeledValues(
  text: string,
  fields: { key: string; label: string }[],
): Record<string, { value: string; confidence: number }> {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const out: Record<string, { value: string; confidence: number }> = {};
  for (const field of fields) {
    const label = normalize(field.label.replace(/\(.*?\)/g, ""));
    if (label.length < 3) continue;
    for (const line of lines) {
      const separator = line.search(/[:：]/);
      if (separator <= 0) continue;
      const head = normalize(line.slice(0, separator));
      const value = line.slice(separator + 1).trim();
      if (!value) continue;
      if (head === label || head.includes(label) || label.includes(head)) {
        out[field.key] = { value, confidence: head === label ? 0.92 : 0.75 };
        break;
      }
    }
  }
  return out;
}

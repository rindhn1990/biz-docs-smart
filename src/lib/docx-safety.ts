import PizZip from "pizzip";
import { DOMParser as XmlDOMParser } from "@xmldom/xmldom";

export const WORD_TEXT_RE = /(<w:t(?=[\s>])(?![^>]*\/>)[^>]*>)([\s\S]*?)(<\/w:t>)/g;
export const UNSAFE_DOCX_MESSAGE = "Không lưu để tránh làm hỏng file mẫu";

export function validateDocx(source: ArrayBuffer) {
  try {
    const zip = new PizZip(source);
    const xml = zip.file("word/document.xml")?.asText();
    if (!xml) throw new Error("Thiếu nội dung Word");
    for (const part of zip.file(/\.xml$/)) {
      const value = part.asText();
      if (typeof globalThis.DOMParser !== "undefined") {
        const parsed = new globalThis.DOMParser().parseFromString(value, "application/xml");
        if (parsed.getElementsByTagName("parsererror").length) throw new Error("XML không hợp lệ");
      } else {
        new XmlDOMParser({ onError: () => { throw new Error("XML không hợp lệ"); } }).parseFromString(value, "application/xml");
      }
    }
    return zip;
  } catch (error) {
    throw new Error(`${UNSAFE_DOCX_MESSAGE}: ${(error as Error).message}`);
  }
}

export function xmlParagraphTexts(xml: string): string[] {
  return (xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? []).map((p) =>
    [...p.matchAll(new RegExp(WORD_TEXT_RE.source, "g"))].map((m) => m[2] ?? "").join("")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&"));
}

/** Compare uncompressed package bytes, not ZIP compression or timestamps. */
export function assertSafeDocxEdit(before: ArrayBuffer, after: ArrayBuffer, expected: string[]) {
  const oldZip = validateDocx(before);
  const newZip = validateDocx(after);
  const fail = () => { throw new Error(UNSAFE_DOCX_MESSAGE); };
  const names = Object.keys(oldZip.files).sort();
  if (JSON.stringify(names) !== JSON.stringify(Object.keys(newZip.files).sort())) fail();
  for (const name of names) {
    if (name === "word/document.xml" || oldZip.files[name]?.dir) continue;
    const a = oldZip.file(name)?.asUint8Array();
    const b = newZip.file(name)?.asUint8Array();
    if (!a || !b || a.length !== b.length || a.some((v, i) => v !== b[i])) fail();
  }
  const oldXml = oldZip.file("word/document.xml")?.asText() ?? "";
  const newXml = newZip.file("word/document.xml")?.asText() ?? "";
  if ((oldXml.match(/<w:p(?=[\s/>])/g) ?? []).length !== (newXml.match(/<w:p(?=[\s/>])/g) ?? []).length) fail();
  if (JSON.stringify(xmlParagraphTexts(newXml)) !== JSON.stringify(expected)) fail();
  // Only text content and xml:space may change; tabs, tables and all other XML must survive.
  const skeleton = (xml: string) => xml.replace(new RegExp(WORD_TEXT_RE.source, "g"), "<w:t></w:t>");
  if (skeleton(oldXml) !== skeleton(newXml)) fail();
}

export function previousDocxPath(path: string) {
  return `${path.slice(0, path.lastIndexOf("/") + 1)}source.prev.docx`;
}
import { WORD_TEXT_RE, UNSAFE_DOCX_MESSAGE, validateDocx, xmlParagraphTexts } from './docx-safety';

export function validateRegionKey(key: string, existing: readonly string[], previous?: string) {
  const next = key.trim().replace(/^(?:\{\{|\[\[)\s*|\s*(?:\}\}|\]\])$/g, '');
  if (!/^[A-Za-z0-9_]+$/.test(next)) throw new Error('Ký hiệu chỉ gồm chữ, số và dấu gạch dưới');
  if (existing.some(k => k === next && k !== previous)) throw new Error('Ký hiệu này đã có trong mẫu');
  return next;
}

const decode = (text: string) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const encode = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const skeleton = (xml: string) => xml.replace(new RegExp(WORD_TEXT_RE.source, 'g'), '<w:t></w:t>');

/** Rename exact tokens, including split runs, without moving or redefining regions. */
export function renameRegionToken(source: ArrayBuffer, oldKey: string, newKey: string) {
  validateRegionKey(newKey, []);
  const zip = validateDocx(source);
  const originals = new Map<string, string>();
  let count = 0;
  const renameText = (text: string) => text.replace(/(\{\{|\[\[)(\s*)([A-Za-z0-9_]+)(\s*)(\}\}|\]\])/g, (token, open, pre, key, post, close) => {
    if (key !== oldKey || (open === '{{' ? close !== '}}' : close !== ']]')) return token;
    return `${open}${pre}${newKey}${post}${close}`;
  });
  for (const part of zip.file(/^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/)) {
    const original = part.asText();
    originals.set(part.name, original);
    const updated = original.replace(/<w:p[\s>][\s\S]*?<\/w:p>/g, paragraph => {
      const slots = [...paragraph.matchAll(new RegExp(WORD_TEXT_RE.source, 'g'))];
      const text = slots.map(m => decode(m[2] ?? '')).join('');
      const edits = [...text.matchAll(/(\{\{|\[\[)(\s*)([A-Za-z0-9_]+)(\s*)(\}\}|\]\])/g)].filter(m => m[3] === oldKey && (m[1] === '{{' ? m[5] === '}}' : m[5] === ']]'));
      if (!edits.length) return paragraph;
      const values = slots.map(m => decode(m[2] ?? ''));
      const starts: number[] = [];
      let offset = 0;
      for (const value of values) { starts.push(offset); offset += value.length; }
      for (const edit of edits.reverse()) {
        const start = edit.index + (edit[1]?.length ?? 0) + (edit[2]?.length ?? 0);
        const end = start + oldKey.length;
        for (let i = values.length - 1; i >= 0; i--) {
          const at = starts[i] ?? 0;
          const originalLength = decode(slots[i]?.[2] ?? '').length;
          if (at >= end || at + originalLength <= start) continue;
          const value = values[i] ?? '';
          values[i] = value.slice(0, Math.max(0, start - at)) + (at <= start ? newKey : '') + value.slice(Math.min(originalLength, end - at));
        }
        count++;
      }
      let out = paragraph;
      for (let i = slots.length - 1; i >= 0; i--) {
        const slot = slots[i];
        if (!slot || values[i] === decode(slot[2] ?? '')) continue;
        out = out.slice(0, slot.index) + slot[1] + encode(values[i] ?? '') + slot[3] + out.slice(slot.index + slot[0].length);
      }
      return out;
    });
    if (skeleton(original) !== skeleton(updated) || JSON.stringify(xmlParagraphTexts(updated)) !== JSON.stringify(xmlParagraphTexts(original).map(renameText))) throw new Error(UNSAFE_DOCX_MESSAGE);
    zip.file(part.name, updated);
  }
  const buffer = zip.generate({ type: 'arraybuffer', compression: 'DEFLATE' }) as ArrayBuffer;
  const after = validateDocx(buffer);
  const before = validateDocx(source);
  if (JSON.stringify(Object.keys(before.files).sort()) !== JSON.stringify(Object.keys(after.files).sort())) throw new Error(UNSAFE_DOCX_MESSAGE);
  for (const name of Object.keys(before.files)) {
    if (originals.has(name) || before.files[name]?.dir) continue;
    const a = before.file(name)?.asUint8Array();
    const b = after.file(name)?.asUint8Array();
    if (!a || !b || a.length !== b.length || a.some((value, i) => value !== b[i])) throw new Error(UNSAFE_DOCX_MESSAGE);
  }
  return { buffer, count };
}
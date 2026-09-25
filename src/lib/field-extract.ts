/**
 * Trích xuất giá trị theo từ khoá / mẫu câu hành chính Việt Nam (0 token AI).
 */
export type LocalScannedValue = { key: string; value: string; confidence: number };
type Field = { key: string; label: string };

type Kind = "date" | "money" | "number" | "name" | "subject" | "recipient" | "text";

/** Bỏ dấu, hạ chữ thường để so khớp. Giữ nguyên độ dài chuỗi (1 ký tự ↔ 1 ký tự). */
function fold(s: string) {
  return s
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function foldKeepIndex(s: string) {
  // Chuẩn hoá từng ký tự để chỉ số vị trí khớp với chuỗi gốc
  return Array.from(s)
    .map((ch) => {
      const f = fold(ch);
      return f.length === 1 ? f : (f[0] ?? " ");
    })
    .join("");
}

function kindOf(field: Field): Kind {
  const k = field.key.toLowerCase();
  const l = fold(field.label);
  if (k.startsWith("date_") || k.endsWith("_date") || /\bngay\b/.test(l)) return "date";
  if (/(^|_)(gia|tien|sotien|tongtien|giatri)/.test(k) || /gia (goi thau|trung thau|tri)|so tien|tong (cong|tien)/.test(l))
    return /chu|_text|bang chu/.test(k + " " + l) ? "text" : "money";
  if (/ten_goi_thau|goi thau/.test(k + " " + l) && /ten/.test(k + " " + l)) return "name";
  if (/trich_yeu|ve viec|trich yeu/.test(k + " " + l)) return "subject";
  if (/kinh_gui|kinh gui/.test(k + " " + l)) return "recipient";
  if (k.startsWith("numb_") || /(^|\s)so( |$)|so hieu|ma so|so tai khoan|dien thoai/.test(l)) return "number";
  return "text";
}

const DATE_WORDS = /ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i;
const DATE_NUM = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/;
const MONEY = /\b\d{1,3}(?:\.\d{3}){1,}(?:,\d+)?\b/g;

function pad(n: string) {
  return n.padStart(2, "0");
}
function findDate(s: string): string | null {
  const w = s.match(DATE_WORDS);
  if (w) return `${pad(w[1]!)}/${pad(w[2]!)}/${w[3]}`;
  const n = s.match(DATE_NUM);
  if (n) return `${pad(n[1]!)}/${pad(n[2]!)}/${n[3]}`;
  return null;
}
function clean(v: string) {
  return v.replace(/\s+/g, " ").replace(/^[\s:–—\-.,;"“”]+|[\s,;.]+$/g, "").trim();
}

/** Tìm nhãn trong văn bản, trả về phần giá trị sau nhãn (sau dấu ":" hoặc tới cuối dòng). */
function valueAfterLabel(text: string, folded: string, label: string): string | null {
  const needle = fold(label).replace(/\s+/g, " ").trim();
  if (needle.length < 3) return null;
  const lines = text.split(/\r?\n/);
  const flines = folded.split(/\r?\n/);
  for (let i = 0; i < flines.length; i++) {
    const fl = flines[i]!.replace(/\s+/g, " ");
    const idx = fl.indexOf(needle);
    if (idx === -1) continue;
    const orig = lines[i]!.replace(/\s+/g, " ");
    let rest = orig.slice(idx + needle.length);
    const colon = rest.indexOf(":");
    if (colon !== -1 && colon < 12) rest = rest.slice(colon + 1);
    let v = clean(rest);
    if (!v && i + 1 < lines.length) v = clean(lines[i + 1]!);
    if (v && v.length <= 300) return v;
  }
  return null;
}

export function extractFieldsLocally(text: string, fields: Field[]): LocalScannedValue[] {
  if (!text || text.trim().length < 5) return [];
  const folded = foldKeepIndex(text);
  const out: LocalScannedValue[] = [];

  // Mẫu câu cố định
  const soMatch = text.match(/(?:^|\n)\s*Số\s*[:.]\s*([^\n]{1,60})/i);
  const kgMatch = text.match(/Kính\s*gửi\s*[:.]?\s*([^\n]{2,200})/i);
  const vvMatch = text.match(/V\/?v\s*[:.]?\s*([^\n]{3,300})|Về\s*việc\s*[:.]?\s*([^\n]{3,300})/i);
  const gtMatch = text.match(/gói\s*thầu\s*(?:số\s*\S+\s*)?[:]?\s*[“"«]([^”"»]{3,300})[”"»]/i);
  const allMoney = [...text.matchAll(MONEY)].map((m) => m[0]);
  const docDate = findDate(text);

  for (const field of fields) {
    const kind = kindOf(field);
    let value: string | null = null;
    let confidence = 0;

    // 1) Theo nhãn in sẵn trong văn bản
    const byLabel = valueAfterLabel(text, folded, field.label);
    if (byLabel) {
      if (kind === "date") value = findDate(byLabel);
      else if (kind === "money") value = byLabel.match(MONEY)?.[0] ?? null;
      else value = byLabel;
      if (value) confidence = kind === "date" || kind === "money" ? 0.85 : 0.6;
    }

    // 2) Theo mẫu câu hành chính
    if (!value) {
      if (kind === "name" && gtMatch) [value, confidence] = [clean(gtMatch[1]!), 0.85];
      else if (kind === "subject" && vvMatch) [value, confidence] = [clean(vvMatch[1] ?? vvMatch[2]!), 0.85];
      else if (kind === "recipient" && kgMatch) [value, confidence] = [clean(kgMatch[1]!), 0.85];
      else if (kind === "number" && soMatch && /(^|_)(so|numb)/i.test(field.key) && !/tien|gia/i.test(field.key))
        [value, confidence] = [clean(soMatch[1]!), 0.8];
      else if (kind === "date" && docDate && /van ban|cong van|ngay ky|ban hanh/.test(fold(field.label)))
        [value, confidence] = [docDate, 0.8];
      else if (kind === "money" && allMoney.length === 1) [value, confidence] = [allMoney[0]!, 0.55];
    }

    if (value && value.trim()) out.push({ key: field.key, value: value.trim(), confidence });
  }
  return out;
}

/**
 * Trích xuất giá trị theo từ khoá / mẫu câu hành chính Việt Nam (0 token AI).
 */
export type LocalScannedValue = { key: string; value: string; confidence: number };
type Field = { key: string; label: string };

type Kind =
  | "date" | "money" | "money_text" | "number" | "name" | "subject" | "recipient" | "text"
  | "bank_account" | "bank_name" | "tax" | "phone" | "email" | "address"
  | "org" | "representative" | "rep_title";

/** Bỏ dấu, hạ chữ thường để so khớp. */
function fold(s: string) {
  return s.replace(/[đĐ]/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Chuẩn hoá từng ký tự để chỉ số vị trí khớp với chuỗi gốc. */
function foldKeepIndex(s: string) {
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
  const kl = k + " " + l;
  if (/email|e-mail/.test(kl)) return "email";
  if (/bank_account|so tai khoan|taikhoan/.test(kl)) return "bank_account";
  if (/bank_name|ngan hang|nganhang/.test(kl)) return "bank_name";
  if (/tax|ma so thue|\bmst\b/.test(kl)) return "tax";
  if (/phone|dien thoai|dienthoai/.test(kl)) return "phone";
  if (/representative_title|chuc danh|chucdanh/.test(kl)) return "rep_title";
  if (/representative|dai dien|daidien/.test(kl)) return "representative";
  if (/address|dia chi|diachi|tru so/.test(kl)) return "address";
  if (/bang chu|_text|_chu\b/.test(kl) && /tien|amount|gia/.test(kl)) return "money_text";
  if (k.startsWith("date_") || k.endsWith("_date") || /\bngay\b/.test(l)) return "date";
  if (/amount|(^|_)(gia|tien|sotien|tongtien|giatri)/.test(k) || /gia (goi thau|trung thau|tri)|so tien|tong (cong|tien)/.test(l))
    return "money";
  if (/ten_goi_thau|goi thau/.test(kl) && /ten/.test(kl)) return "name";
  if (/trich_yeu|ve viec|trich yeu/.test(kl)) return "subject";
  if (/kinh_gui|kinh gui/.test(kl)) return "recipient";
  if (k === "name" || /ten don vi|nha thau|ten cong ty/.test(l)) return "org";
  if (k.startsWith("numb_") || /(^|\s)so( |$)|so hieu|ma so/.test(l)) return "number";
  return "text";
}

const DATE_WORDS = /ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i;
const DATE_NUM = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/;
const MONEY = /\b\d{1,3}(?:[.,]\d{3}){1,}(?:,\d+)?\b/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const pad = (n: string) => n.padStart(2, "0");
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
function normMoney(v: string) {
  return v.replace(/,(?=\d{3}\b)/g, ".");
}

const STOP = new Set(["va", "theo", "cua", "phap", "luat", "day", "du", "giay", "to", "ten", "so", "ma", "nguoi", "dia", "chi", "don", "vi", "cac", "cho", "tai", "chi nhanh", "nhanh"]);

/** Các từ khoá đặc trưng (cụm 2 từ) từ nhãn, bỏ từ nối và phần trong ngoặc. */
function keywords(label: string): string[] {
  const words = fold(label.replace(/\(.*?\)/g, " ").split("—").pop() ?? label)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i]!, b = words[i + 1]!;
    if (STOP.has(a) && STOP.has(b)) continue;
    out.push(`${a} ${b}`);
  }
  for (const w of words) if (!STOP.has(w) && w.length >= 4) out.push(w);
  return out;
}

/** Giá trị phía sau needle trên dòng i (sau ":" nếu có), hoặc dòng kế tiếp. */
function takeAfter(lines: string[], flines: string[], needle: string): string | null {
  for (let i = 0; i < flines.length; i++) {
    const fl = flines[i]!.replace(/\s+/g, " ");
    const idx = fl.indexOf(needle);
    if (idx === -1) continue;
    const orig = lines[i]!.replace(/\s+/g, " ");
    let rest = orig.slice(idx + needle.length);
    const colon = rest.indexOf(":");
    if (colon !== -1 && colon < 25) rest = rest.slice(colon + 1);
    let v = clean(rest);
    if (!v && i + 1 < lines.length) v = clean(lines[i + 1]!);
    if (v && v.length <= 300) return v;
  }
  return null;
}

function valueAfterLabel(lines: string[], flines: string[], label: string): { value: string; exact: boolean } | null {
  const full = fold(label.replace(/\(.*?\)/g, "")).replace(/\s+/g, " ").trim();
  if (full.length >= 3) {
    const v = takeAfter(lines, flines, full);
    if (v) return { value: v, exact: true };
  }
  for (const kw of keywords(label)) {
    const v = takeAfter(lines, flines, kw);
    if (v) return { value: v, exact: false };
  }
  return null;
}

/** Mẫu câu chuyên biệt: thử lần lượt các nhãn, lọc bằng regex giá trị. */
function afterAny(lines: string[], flines: string[], needles: string[], pick?: RegExp): string | null {
  for (const n of needles) {
    const v = takeAfter(lines, flines, n);
    if (!v) continue;
    if (!pick) return v;
    const m = v.match(pick);
    if (m) return clean(m[0]);
  }
  return null;
}

const TITLE_RE = /^(tong giam doc|pho tong giam doc|giam doc|pho giam doc|ke toan truong|chu tich|truong phong|thu truong)/;

function signatureBlock(lines: string[], flines: string[]) {
  const start = Math.max(0, lines.length - 20);
  for (let i = lines.length - 1; i >= start; i--) {
    const fl = flines[i]!.replace(/^[\s.\-•]*(kt\.?|tm\.?|tl\.?)?\s*/, "").trim();
    if (!TITLE_RE.test(fl)) continue;
    const title = clean(lines[i]!.replace(/^[\s.\-•]*(KT\.?|TM\.?|TL\.?)\s*/i, ""));
    let name: string | null = null;
    for (const j of [i + 1, i + 2, i + 3, i + 4, i - 1]) {
      const cand = clean(lines[j] ?? "");
      if (/^(\p{Lu}[\p{Ll}]+\s+){1,4}\p{Lu}[\p{Ll}]+$/u.test(cand)) { name = cand; break; }
    }
    return { title, name };
  }
  return null;
}

export function extractFieldsLocally(text: string, fields: Field[]): LocalScannedValue[] {
  if (!text || text.trim().length < 5) return [];
  const lines = text.split(/\r?\n/);
  const flines = foldKeepIndex(text).split(/\r?\n/);
  const out: LocalScannedValue[] = [];

  const soMatch = text.match(/(?:^|\n)\s*Số\s*[:.]\s*([^\n]{1,60})/i);
  const kgMatch = text.match(/Kính\s*gửi\s*[:.]?\s*([^\n]{2,200})/i);
  const vvMatch = text.match(/V\/?v\s*[:.]?\s*([^\n]{3,300})|Về\s*việc\s*[:.]?\s*([^\n]{3,300})/i);
  const gtMatch = text.match(/gói\s*thầu\s*(?:số\s*\S+\s*)?[:]?\s*[“"«]([^”"»]{3,300})[”"»]/i);
  const allMoney = [...text.matchAll(MONEY)].map((m) => m[0]);
  const docDate = findDate(text);
  const sig = signatureBlock(lines, flines);

  for (const field of fields) {
    const kind = kindOf(field);
    let value: string | null = null;
    let confidence = 0;
    const set = (v: string | null, c: number) => {
      if (!value && v) [value, confidence] = [v, c];
    };

    // 1) Mẫu câu chuyên biệt (thanh toán / hoá đơn / nhà thầu)
    switch (kind) {
      case "bank_account":
        set(afterAny(lines, flines, ["so tai khoan", "stk", "tai khoan"], /\d[\d\s.-]{5,}\d/)?.replace(/[\s.]/g, "") ?? null, 0.85);
        break;
      case "bank_name":
        set(afterAny(lines, flines, ["mo tai", "tai ngan hang", "ngan hang"]), 0.7);
        break;
      case "tax":
        set(afterAny(lines, flines, ["ma so thue", "mst", "ma so doanh nghiep"], /\d[\d\s-]{8,}\d/)?.replace(/\s/g, "") ?? null, 0.85);
        break;
      case "phone":
        set(afterAny(lines, flines, ["so dien thoai", "dien thoai", "sdt", "dt", "hotline", "tel"], /\+?\d[\d\s.()-]{7,}\d/), 0.8);
        break;
      case "email": {
        const m = text.match(EMAIL);
        set(m?.[0] ?? null, 0.9);
        break;
      }
      case "address":
        set(afterAny(lines, flines, ["dia chi tru so", "dia chi", "tru so"]), 0.7);
        break;
      case "money":
        set(
          afterAny(lines, flines, ["tong so tien thanh toan", "so tien de nghi thanh toan", "so tien thanh toan", "tong cong", "thanh tien", "so tien"], MONEY),
          0.85,
        );
        break;
      case "money_text":
        set(afterAny(lines, flines, ["bang chu"])?.replace(/\.$/, "") ?? null, 0.8);
        break;
      case "rep_title":
        set(sig?.title ?? null, 0.6);
        break;
      case "representative":
        set(afterAny(lines, flines, ["nguoi dai dien", "dai dien"]), 0.65);
        set(sig?.name ?? null, 0.55);
        break;
      case "org": {
        const v = afterAny(lines, flines, ["ten don vi", "ten nha thau", "don vi thu huong", "ten cong ty"]);
        set(v, 0.75);
        if (!value) {
          for (let i = 0; i < Math.min(8, lines.length); i++) {
            if (/(tong cong ty|cong ty|doanh nghiep)/.test(flines[i]!)) { set(clean(lines[i]!), 0.5); break; }
          }
        }
        break;
      }
    }

    // 2) Theo nhãn in sẵn (cụm đầy đủ → từ khoá)
    if (!value) {
      const hit = valueAfterLabel(lines, flines, field.label);
      if (hit) {
        let v: string | null = hit.value;
        if (kind === "date") v = findDate(v);
        else if (kind === "money") v = v.match(MONEY)?.[0] ?? null;
        if (v) set(v, hit.exact ? (kind === "date" || kind === "money" ? 0.85 : 0.65) : 0.55);
      }
    }

    // 3) Mẫu câu hành chính chung
    if (!value) {
      if (kind === "name" && gtMatch) set(clean(gtMatch[1]!), 0.85);
      else if (kind === "subject" && vvMatch) set(clean(vvMatch[1] ?? vvMatch[2]!), 0.85);
      else if (kind === "recipient" && kgMatch) set(clean(kgMatch[1]!), 0.85);
      else if (kind === "number" && soMatch && /(^|_)(so|numb)/i.test(field.key) && !/tien|gia/i.test(field.key))
        set(clean(soMatch[1]!), 0.8);
      else if (kind === "date" && docDate && /van ban|cong van|ngay ky|ban hanh|de nghi/.test(fold(field.label)))
        set(docDate, 0.8);
      else if (kind === "money" && allMoney.length) {
        const biggest = [...allMoney].sort((a, b) => Number(b.replace(/\D/g, "")) - Number(a.replace(/\D/g, "")))[0]!;
        set(biggest, allMoney.length === 1 ? 0.55 : 0.45);
      }
    }

    if (kind === "money" && value) value = normMoney(value);
    const final = (value as string | null)?.trim();
    if (final) out.push({ key: field.key, value: final, confidence });
  }
  return out;
}

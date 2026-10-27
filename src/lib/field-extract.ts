/**
 * Trích xuất giá trị theo từ khoá / mẫu câu hành chính Việt Nam (0 token AI).
 * Mọi quy tắc chạy trên bản bỏ dấu (giữ nguyên chỉ số ký tự) để chịu được OCR sai dấu;
 * giá trị trả về luôn lấy lại từ văn bản gốc.
 */
import { formatThousands, parseVietnameseMoneyWords, readVietnameseMoney } from "./money";

export type LocalScannedValue = { key: string; value: string; confidence: number; source?: string };
export type LocalScanResult = { values: LocalScannedValue[]; warnings: string[] };
type Field = { key: string; label: string };

export type FieldKind =
  | "date" | "money" | "money_text" | "number" | "name" | "subject" | "recipient" | "text"
  | "bank_account" | "bank_name" | "tax" | "phone" | "email" | "address"
  | "org" | "representative" | "rep_title";

export const MONEY_MISMATCH_WARNING = "Số tiền bằng số và bằng chữ không khớp";

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

export function fieldKind(field: Field): FieldKind {
  const k = field.key.toLowerCase();
  const l = fold(field.label);
  const kl = k + " " + l;
  if (["hd_ngay", "tt_ngay", "tt_hanthanhtoan"].includes(k)) return "date";
  if (["hd_giatri", "tt_tongtien"].includes(k)) return "money";
  if (["hd_so", "tt_dot", "gt_ma"].includes(k)) return "number";
  if (["hd_ten", "gt_ten"].includes(k)) return "name";
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

const MONEY = /\b\d{1,3}(?:[.,]\d{3}){1,}(?:,\d+)?\b/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const pad = (n: string) => n.padStart(2, "0");
function validDate(d: string, m: string, y: string) {
  const dd = Number(d), mm = Number(m), yy = Number(y);
  return dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900 && yy <= 2100;
}

/** Ngày đầu tiên hợp lệ (dd/mm/yyyy hoặc "ngày D tháng M năm YYYY", chịu OCR sai chữ). */
export function findDate(s: string): string | null {
  const f = foldKeepIndex(s);
  const found: { index: number; value: string }[] = [];
  for (const m of f.matchAll(/ng[a-z]{1,3}\s*(\d{1,2})\s*th[a-z]{1,4}\s*(\d{1,2})\s*n[a-z0-9]{1,3}\s*(\d{4})/g))
    if (validDate(m[1]!, m[2]!, m[3]!)) found.push({ index: m.index!, value: `${pad(m[1]!)}/${pad(m[2]!)}/${m[3]}` });
  for (const m of f.matchAll(/(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?!\d)/g))
    if (validDate(m[1]!, m[2]!, m[3]!)) found.push({ index: m.index!, value: `${pad(m[1]!)}/${pad(m[2]!)}/${m[3]}` });
  found.sort((a, b) => a.index - b.index);
  return found[0]?.value ?? null;
}

function clean(v: string) {
  return v.replace(/\s+/g, " ").replace(/^[\s:–—\-.,;"“”]+|[\s,;.:]+$/g, "").trim();
}
function normMoney(v: string) {
  return v.replace(/,(?=\d{3}\b)/g, ".");
}

/** Sửa nhầm lẫn OCR (O→0, l/I→1, S→5, B→8) chỉ trong các cụm chủ yếu là chữ số. */
export function fixOcrDigits(s: string) {
  return s.replace(/[0-9OoIlSB][0-9OoIlSB.\-]*[0-9OoIlSB]/g, (tok) => {
    const digits = (tok.match(/\d/g) ?? []).length;
    const alnum = (tok.match(/[0-9A-Za-z]/g) ?? []).length;
    if (!alnum || digits / alnum < 0.6) return tok;
    return tok.replace(/[Oo]/g, "0").replace(/[lI]/g, "1").replace(/S/g, "5").replace(/B/g, "8");
  });
}

/* ---------- So khớp nhãn chịu lỗi OCR ---------- */

function lev(a: string, b: string) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length]!;
}

/** Khoảng cách từ OCR tới từ nhãn; -1 khi vượt ngưỡng (≤1 cho từ ≤5 ký tự, ≤2 cho từ dài hơn). */
function wordDist(tok: string, w: string) {
  const d = Math.min(lev(tok, w), lev(tok.replace(/ir/g, "u"), w));
  const max = w.length <= 1 ? 0 : w.length <= 5 ? 1 : 2;
  return d <= max ? d : -1;
}

type Hit = { line: number; start: number; end: number; lineStart: boolean };

function phraseHits(flines: string[], phrase: string): Hit[] {
  const words = phrase.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const single = words.length === 1;
  const budget = single ? (words[0]!.length >= 4 ? 1 : 0) : Math.ceil(words.length / 2);
  const out: Hit[] = [];
  flines.forEach((fl, li) => {
    const toks = [...fl.matchAll(/[a-z0-9@]+/g)];
    for (let i = 0; i + words.length <= toks.length; i++) {
      let total = 0;
      let ok = true;
      for (let k = 0; k < words.length; k++) {
        const tok = toks[i + k]![0];
        const d = single && words[0]!.length < 4 ? (tok === words[0] ? 0 : -1) : wordDist(tok, words[k]!);
        if (d < 0) { ok = false; break; }
        total += d;
      }
      if (!ok || total > budget) continue;
      const first = toks[i]!, last = toks[i + words.length - 1]!;
      out.push({
        line: li,
        start: first.index!,
        end: last.index! + last[0].length,
        lineStart: fl.slice(0, first.index!).replace(/[^a-z0-9]/g, "") === "",
      });
      i += words.length - 1;
    }
  });
  return out;
}

/* ---------- Ngữ cảnh văn bản ---------- */

type Ctx = { text: string; ftext: string; lines: string[]; flines: string[] };

function isLabelLine(line: string) {
  const idx = line.indexOf(":");
  return idx >= 0 && idx < 25 && line.slice(idx + 1).trim().length > 0;
}
function endsSentence(line: string) {
  const f = fold(line).trim();
  return /[.:;!?]$/.test(f) || /dong\s*chan/.test(f);
}

/** Nối các dòng kế tiếp cho tới hết câu, dòng trống, nhãn mới hoặc 3 dòng/300 ký tự. */
function joinFrom(ctx: Ctx, li: number, first: string) {
  const parts = first ? [first] : [];
  if (!first || !endsSentence(first)) {
    for (let j = li + 1; j < ctx.lines.length && parts.length < 3; j++) {
      const line = ctx.lines[j]!.trim();
      if (!line) { if (parts.length) break; continue; }
      if (isLabelLine(line)) break;
      parts.push(line);
      if (endsSentence(line) || parts.join(" ").length >= 300) break;
    }
  }
  return clean(parts.join(" ").slice(0, 300));
}

function restAt(ctx: Ctx, hit: Hit, multiline: boolean) {
  let rest = ctx.lines[hit.line]!.slice(hit.end);
  const colon = rest.indexOf(":");
  if (colon !== -1 && colon < 25) rest = rest.slice(colon + 1);
  const v = clean(rest);
  if (multiline) return joinFrom(ctx, hit.line, v);
  if (!v && hit.line + 1 < ctx.lines.length) return clean(ctx.lines[hit.line + 1]!);
  return v;
}

/** Xét MỌI dòng chứa nhãn (ưu tiên dòng bắt đầu bằng nhãn) và trả giá trị đầu tiên hợp lệ. */
function afterAny(
  ctx: Ctx,
  needles: string[],
  validate: (v: string) => string | null = (v) => v || null,
  opts: { multiline?: boolean; preferLineStart?: boolean; lineStartOnly?: boolean } = {},
): string | null {
  for (const needle of needles) {
    let hits = phraseHits(ctx.flines, needle);
    if (opts.lineStartOnly) hits = hits.filter((h) => h.lineStart);
    if (opts.preferLineStart) hits = [...hits.filter((h) => h.lineStart), ...hits.filter((h) => !h.lineStart)];
    for (const hit of hits) {
      const raw = restAt(ctx, hit, Boolean(opts.multiline));
      if (!raw || raw.length > 300) continue;
      const v = validate(raw);
      if (v) return v;
    }
  }
  return null;
}

const pickMoney = (v: string) => v.match(MONEY)?.[0] ?? null;
function pickAccount(v: string) {
  const m = fixOcrDigits(v).match(/\d[\d .-]{6,}\d/);
  const d = m?.[0].replace(/\D/g, "") ?? "";
  return d.length >= 8 && d.length <= 20 ? d : null;
}
function pickTax(v: string) {
  const m = fixOcrDigits(v).replace(/\s/g, "").match(/(?<![\d.])(\d{10}-\d{3}|\d{13}|\d{10})(?![\d.]|-\d)/);
  return m?.[1] ?? null;
}
function pickPhone(v: string) {
  const m = fixOcrDigits(v).match(/\+?\d[\d\s.()-]{7,}\d/);
  if (!m) return null;
  const d = m[0].replace(/\D/g, "");
  return d.length >= 9 && d.length <= 12 ? clean(m[0]) : null;
}
const pickText = (min = 3) => (v: string) => (v.length >= min && /\p{L}/u.test(v) ? v : null);

/** Lấy giá trị gốc ngay sau vị trí khớp trên bản bỏ dấu, tới hết dòng. */
function origAfter(ctx: Ctx, index: number) {
  const end = ctx.text.indexOf("\n", index);
  return ctx.text.slice(index, end === -1 ? undefined : end);
}

function isUpperLine(line: string) {
  const letters = line.replace(/[^\p{L}]/gu, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

const TITLE_RE = /^(tong giam doc|pho tong giam doc|giam doc|pho giam doc|ke toan truong|chu tich|truong phong|thu truong)/;

function signatureBlock(ctx: Ctx) {
  const { lines, flines } = ctx;
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

/** Số hợp đồng theo cấu trúc: sau "hợp đồng (số)" / "HĐ số", chứa chữ số. */
function contractNumber(ctx: Ctx): { value: string; end: number } | null {
  for (const m of ctx.ftext.matchAll(/(?:\bhop\s*d[a-z0-9]{1,2}ng|\bhd)\s*(?:\b(?:s[a-z0-9]|so)\b[\s.:]*)*[:\s]*/g)) {
    const at = m.index! + m[0].length;
    const tok = ctx.text.slice(at).match(/^[\p{L}\d][\p{L}\d/._-]*/u)?.[0]?.replace(/[._-]+$/, "");
    if (tok && /\d/.test(tok) && tok.length >= 2) return { value: tok, end: at + tok.length };
  }
  return null;
}

function contractDate(ctx: Ctx, numberEnd: number | null): string | null {
  const contractAt = [...ctx.ftext.matchAll(/\bhop\s*d[a-z0-9]{1,2}ng|\bhd\b/g)].map((m) => m.index!);
  for (const m of ctx.ftext.matchAll(/\bky\s*(?:ng[a-z]{1,3}|vao\s*ng[a-z]{1,3})\b/g)) {
    const at = m.index!;
    const near = contractAt.some((c) => c <= at && at - c <= 300) || (numberEnd !== null && at >= numberEnd && at - numberEnd <= 120);
    if (!near) continue;
    const d = findDate(ctx.text.slice(at, at + 90));
    if (d) return d;
  }
  if (numberEnd !== null) {
    const d = findDate(ctx.text.slice(numberEnd, numberEnd + 120));
    if (d) return d;
  }
  return null;
}

function documentDate(ctx: Ctx): string | null {
  const head = ctx.lines.slice(0, 12);
  const re = /ng[a-z]{1,3}\s*\d{1,2}\s*th[a-z]{1,4}\s*\d{1,2}\s*n[a-z0-9]{1,3}\s*\d{4}/;
  const withComma = head.find((l) => /,\s*ng/.test(foldKeepIndex(l)) && re.test(foldKeepIndex(l)));
  const any = withComma ?? head.find((l) => re.test(foldKeepIndex(l)));
  return any ? findDate(any) : null;
}

function paymentContent(ctx: Ctx): string | null {
  const hits = ["xin thong bao", "de nghi thanh toan", "thong bao"]
    .flatMap((n) => phraseHits(ctx.flines, n))
    .sort((a, b) => a.line - b.line || a.start - b.start);
  for (const hit of hits) {
    const line = ctx.lines[hit.line]!;
    if (isUpperLine(line) || /kinh\s*g/.test(ctx.flines[hit.line]!)) continue;
    const v = restAt(ctx, hit, true);
    if (v.length >= 12 && v.split(/\s+/).length >= 3 && !isUpperLine(v)) return v;
  }
  return null;
}

function orgName(ctx: Ctx): { value: string; confidence: number } | null {
  const byLabel = afterAny(ctx, ["ten don vi", "ten nha thau", "don vi thu huong", "ten cong ty", "ten tai khoan"], pickText(3), {
    preferLineStart: true, lineStartOnly: true,
  });
  if (byLabel) return { value: byLabel, confidence: 0.75 };
  const sentence = ctx.ftext.match(/((?:tong\s+)?cong\s+ty\s[^\n]{3,120}?)\s+(?:chan\s+thanh\s+cam\s+on|xin\s+thong\s+bao|de\s+nghi)/);
  if (sentence) {
    const start = sentence.index! + sentence[0].indexOf(sentence[1]!);
    return { value: clean(ctx.text.slice(start, start + sentence[1]!.length)), confidence: 0.7 };
  }
  for (let i = 0; i < Math.min(8, ctx.lines.length); i++) {
    const fl = ctx.flines[i]!;
    if (/kinh\s*g/.test(fl)) continue;
    const at = fl.search(/\b(tong cong ty|cong ty|doanh nghiep)\b/);
    if (at < 0) continue;
    let first = ctx.lines[i]!.slice(at);
    const cut = foldKeepIndex(first).search(/\s(cong hoa|doc lap)\b/);
    if (cut > 0) first = first.slice(0, cut);
    first = clean(first);
    const next = (ctx.lines[i + 1] ?? "").trim();
    if (next && isUpperLine(first) && !/^(cong hoa|doc lap)/.test(fold(next))) {
      const keep: string[] = [];
      for (const tok of next.split(/\s+/)) {
        const letters = tok.replace(/[^\p{L}]/gu, "");
        if (!letters || letters !== letters.toUpperCase() || /^(cong|doc)$/.test(fold(tok))) break;
        keep.push(tok);
      }
      if (keep.length) first = `${first} ${keep.join(" ")}`;
    }
    return { value: clean(first), confidence: 0.5 };
  }
  return null;
}

/* ---------- Nhãn chung (giữ hành vi cũ cho các mẫu khác) ---------- */

const STOP = new Set(["va", "theo", "cua", "phap", "luat", "day", "du", "giay", "to", "ten", "so", "ma", "nguoi", "dia", "chi", "don", "vi", "cac", "cho", "tai", "chi nhanh", "nhanh"]);

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

function takeAfterExact(ctx: Ctx, needle: string): string | null {
  for (let i = 0; i < ctx.flines.length; i++) {
    const fl = ctx.flines[i]!;
    const idx = fl.indexOf(needle);
    if (idx === -1) continue;
    let rest = ctx.lines[i]!.slice(idx + needle.length);
    const colon = rest.indexOf(":");
    if (colon !== -1 && colon < 25) rest = rest.slice(colon + 1);
    let v = clean(rest);
    if (!v && i + 1 < ctx.lines.length) v = clean(ctx.lines[i + 1]!);
    if (v && v.length <= 300) return v;
  }
  return null;
}

function valueAfterLabel(ctx: Ctx, label: string): { value: string; exact: boolean } | null {
  const full = fold(label.replace(/\(.*?\)/g, "")).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (full.length >= 3 && full.split(" ").length >= 2) {
    const v = afterAny(ctx, [full]);
    if (v) return { value: v, exact: true };
  }
  for (const kw of keywords(label)) {
    const v = takeAfterExact(ctx, kw);
    if (v) return { value: v, exact: false };
  }
  return null;
}

const PAYMENT_SPECIFIC = ["hd_so", "hd_ngay", "tt_ngay", "tt_dot", "hd_ten", "gt_ten", "gt_ma", "hd_giatri", "tt_noidung"];
const PAIR_AMOUNT = /^(pay_amount|tt_tongtien|tt_sotien)$/i;
const PAIR_TEXT = /^(pay_amount_text|tt_sotien_chu|tt_tongtien_chu)$/i;

export function extractFieldsLocallyDetailed(input: string, fields: Field[]): LocalScanResult {
  if (!input || input.trim().length < 5) return { values: [], warnings: [] };
  const text = input.normalize("NFC");
  const lines = text.split(/\r?\n/);
  const ctx: Ctx = { text, ftext: foldKeepIndex(text), lines, flines: lines.map(foldKeepIndex) };
  const out: LocalScannedValue[] = [];
  const warnings: string[] = [];

  const at = (re: RegExp) => {
    const m = ctx.ftext.match(re);
    return m ? clean(origAfter(ctx, m.index! + m[0].length)) : null;
  };
  const soValue = at(/(?:^|\n)\s*so\s*[:.]\s*/);
  const kgValue = afterAny(ctx, ["kinh gui"], pickText(2));
  const vvValue = at(/\bv\/?v\s*[:.]?\s*|\bve\s*viec\s*[:.]?\s*/);
  const gtQuoted = (() => {
    const m = ctx.ftext.match(/goi\s*thau\s*(?:so\s*\S+\s*)?:?\s*[“"«]([^”"»\n]{3,300})[”"»]/);
    if (!m) return null;
    const s = m.index! + m[0].indexOf(m[1]!);
    return ctx.text.slice(s, s + m[1]!.length);
  })();
  const contractQuoted = (() => {
    const m = ctx.ftext.match(/hop\s*dong\s*:?\s*[“"«]([^”"»\n]{3,300})[”"»]/);
    if (!m) return null;
    const s = m.index! + m[0].indexOf(m[1]!);
    return ctx.text.slice(s, s + m[1]!.length);
  })();
  const allMoney = [...text.matchAll(MONEY)].map((m) => m[0]);
  const docDate = findDate(text);
  const sig = signatureBlock(ctx);
  const contract = contractNumber(ctx);
  const amountWords = afterAny(ctx, ["bang chu"], pickText(3), { multiline: true });

  for (const field of fields) {
    const kind = fieldKind(field);
    const key = field.key.toLowerCase();
    let value: string | null = null;
    let confidence = 0;
    const set = (v: string | null | undefined, c: number) => {
      if (!value && v) [value, confidence] = [v, c];
    };

    if (key === "hd_so") set(contract?.value, 0.95);
    else if (key === "hd_ngay") set(contractDate(ctx, contract?.end ?? null), 0.95);
    else if (key === "tt_ngay") set(documentDate(ctx), 0.9);
    else if (key === "tt_noidung") set(paymentContent(ctx), 0.8);
    else if (key === "tt_dot") set(ctx.ftext.match(/\bdot\s*(?:thanh\s*toan\s*)?(?:so\s*)?(\d{1,2})\b/)?.[1], 0.9);
    else if (key === "hd_ten") {
      set(contractQuoted, 0.85);
      set(afterAny(ctx, ["ten hop dong"]), 0.85);
      set(gtQuoted, 0.8);
    } else if (key === "gt_ten") {
      set(gtQuoted, 0.85);
      set(afterAny(ctx, ["ten goi thau"]), 0.85);
    } else if (key === "hd_giatri") set(afterAny(ctx, ["tong gia tri hop dong", "gia tri hop dong"], pickMoney), 0.9);
    else if (key === "gt_ma") set(afterAny(ctx, ["ma goi thau"]), 0.85);

    switch (kind) {
      case "bank_account": {
        set(afterAny(ctx, ["so tai khoan", "so tk", "stk"], pickAccount, { preferLineStart: true }), 0.85);
        if (!value) {
          const near = new Set<number>();
          for (const h of [...phraseHits(ctx.flines, "tai khoan"), ...phraseHits(ctx.flines, "stk")])
            for (let j = h.line - 3; j <= h.line + 3; j++) if (j >= 0 && j < lines.length) near.add(j);
          for (const j of [...near].sort((a, b) => a - b)) {
            const m = fixOcrDigits(lines[j]!).match(/(?<![\d.,/])\d{8,20}(?![\d.,/])/);
            if (m) { set(m[0], 0.6); break; }
          }
        }
        break;
      }
      case "bank_name":
        set(afterAny(ctx, ["ngan hang", "mo tai", "tai ngan hang"], pickText(3), { preferLineStart: true }), 0.7);
        break;
      case "tax":
        set(afterAny(ctx, ["ma so thue", "mst", "ma so doanh nghiep"], pickTax), 0.85);
        break;
      case "phone":
        set(afterAny(ctx, ["so dien thoai", "dien thoai", "sdt", "dt", "hotline", "tel"], pickPhone), 0.8);
        break;
      case "email":
        set(text.match(EMAIL)?.[0], 0.9);
        break;
      case "address":
        set(afterAny(ctx, ["dia chi tru so", "dia chi", "tru so"], pickText(5), { multiline: true, preferLineStart: true }), 0.7);
        break;
      case "money":
        if (key !== "hd_giatri") {
          set(afterAny(ctx, ["tong so tien thanh toan", "so tien de nghi thanh toan", "so tien thanh toan", "tong cong", "thanh tien", "so tien"], pickMoney), 0.85);
          if (!value && PAIR_AMOUNT.test(field.key)) {
            const m = ctx.ftext.match(/\b(\d{1,3}(?:[.,]\d{3})+)\s*(?:d[a-z0-9]ng|vnd)\b/);
            set(m?.[1], 0.6);
          }
        }
        break;
      case "money_text":
        set(amountWords, 0.8);
        break;
      case "rep_title":
        set(sig?.title, 0.6);
        break;
      case "representative":
        set(afterAny(ctx, ["nguoi dai dien", "dai dien"], pickText(3)), 0.65);
        set(sig?.name, 0.55);
        break;
      case "org": {
        const org = orgName(ctx);
        set(org?.value, org?.confidence ?? 0);
        break;
      }
    }

    if (!value && !["bank_account", "bank_name", "tax", "phone", "email", "money_text"].includes(kind) && !PAYMENT_SPECIFIC.includes(key)) {
      const hit = valueAfterLabel(ctx, field.label);
      if (hit) {
        let v: string | null = hit.value;
        if (kind === "date") v = findDate(v);
        else if (kind === "money") v = pickMoney(v);
        if (v) set(v, hit.exact ? (kind === "date" || kind === "money" ? 0.85 : 0.65) : 0.55);
      }
    }

    if (!value && !PAYMENT_SPECIFIC.includes(key)) {
      if (kind === "name" && gtQuoted) set(clean(gtQuoted), 0.85);
      else if (kind === "subject" && vvValue) set(vvValue, 0.85);
      else if (kind === "recipient" && kgValue) set(kgValue, 0.85);
      else if (kind === "number" && soValue && /(^|_)(so|numb)/i.test(field.key) && !/tien|gia/i.test(field.key)) set(soValue, 0.8);
      else if (kind === "date" && docDate && /van ban|cong van|ngay ky|ban hanh|de nghi/.test(fold(field.label))) set(docDate, 0.8);
      else if (kind === "money" && allMoney.length && !PAIR_AMOUNT.test(field.key)) {
        const biggest = [...allMoney].sort((a, b) => Number(b.replace(/\D/g, "")) - Number(a.replace(/\D/g, "")))[0]!;
        set(biggest, allMoney.length === 1 ? 0.55 : 0.45);
      }
    }

    if (kind === "money" && value) value = normMoney(value);
    const final = (value as string | null)?.trim();
    if (final) out.push({ key: field.key, value: final, confidence });
  }

  // Kiểm tra chéo số tiền bằng số với bằng chữ (không AI).
  const amountField = fields.find((f) => PAIR_AMOUNT.test(f.key));
  const textField = fields.find((f) => PAIR_TEXT.test(f.key));
  if (amountField) {
    const num = out.find((v) => v.key === amountField.key);
    const words = textField ? out.find((v) => v.key === textField.key) : undefined;
    const wordsValue = words?.value ?? amountWords;
    const parsed = wordsValue ? parseVietnameseMoneyWords(wordsValue) : null;
    const numValue = num ? Number(num.value.replace(/\D/g, "")) : null;
    if (num && parsed !== null) {
      if (parsed === numValue) {
        num.confidence = Math.max(num.confidence, 0.95);
        if (words) words.confidence = Math.max(words.confidence, 0.95);
      } else {
        num.confidence = Math.min(num.confidence, 0.3);
        if (words) words.confidence = Math.min(words.confidence, 0.3);
        warnings.push(MONEY_MISMATCH_WARNING);
      }
    } else if (num && textField && !words && !amountWords) {
      out.push({ key: textField.key, value: readVietnameseMoney(num.value), confidence: 0.9, source: "tự tính từ số" });
    } else if (!num && parsed !== null && parsed > 0) {
      out.push({ key: amountField.key, value: formatThousands(String(parsed)), confidence: 0.7, source: "từ số tiền bằng chữ" });
    }
  }
  return { values: out, warnings };
}

export function extractFieldsLocally(text: string, fields: Field[]): LocalScannedValue[] {
  return extractFieldsLocallyDetailed(text, fields).values;
}

/** Chuẩn hoá chữ đọc từ một vùng khoanh riêng cho đúng loại trường. */
export function normalizeRegionValue(field: Field, raw: string): string {
  const text = raw.normalize("NFC").trim();
  const kind = fieldKind(field);
  if (kind === "bank_account" || kind === "tax") return fixOcrDigits(text).replace(/[^\d-]/g, "").replace(/^-+|-+$/g, "");
  if (kind === "phone") return fixOcrDigits(text).replace(/\D/g, "");
  if (kind === "money") {
    const fixed = fixOcrDigits(text);
    return formatThousands(fixed.match(MONEY)?.[0] ?? fixed);
  }
  if (kind === "date") return findDate(text) ?? clean(text);
  if (kind === "email") return text.match(EMAIL)?.[0] ?? clean(text);
  return clean(text);
}

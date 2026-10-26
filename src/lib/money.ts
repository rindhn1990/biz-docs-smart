/** Tiện ích tiền tệ tiếng Việt: định dạng phần nghìn và đọc số thành chữ. */

/** Giữ lại chữ số, chèn dấu chấm phân cách hàng nghìn: "486000000" → "486.000.000". */
export function formatThousands(input: string): string {
  const digits = (input ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Chuyển chuỗi đã định dạng về số: "486.000.000" → 486000000. */
export function parseThousands(input: string): number | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const UNITS = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];

function readTriple(n: number, full: boolean): string {
  const tram = Math.floor(n / 100);
  const chuc = Math.floor((n % 100) / 10);
  const donvi = n % 10;
  let out = "";
  if (tram > 0 || full) out += `${DIGITS[tram]} trăm`;
  if (chuc === 0) {
    if (donvi > 0) out += `${out ? " lẻ " : ""}${DIGITS[donvi]}`;
  } else if (chuc === 1) {
    out += `${out ? " " : ""}mười`;
    if (donvi === 1) out += " một";
    else if (donvi === 5) out += " lăm";
    else if (donvi > 0) out += ` ${DIGITS[donvi]}`;
  } else {
    out += `${out ? " " : ""}${DIGITS[chuc]} mươi`;
    if (donvi === 1) out += " mốt";
    else if (donvi === 4) out += " tư";
    else if (donvi === 5) out += " lăm";
    else if (donvi > 0) out += ` ${DIGITS[donvi]}`;
  }
  return out.trim();
}

/** Đọc số tiền thành chữ tiếng Việt, ví dụ 486000000 → "Bốn trăm tám mươi sáu triệu đồng". */
export function readVietnameseMoney(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseThousands(value) : (value ?? null);
  if (n === null || !Number.isFinite(n)) return "";
  const amount = Math.floor(Math.abs(n));
  if (amount === 0) return "Không đồng";

  const triples: number[] = [];
  let rest = amount;
  while (rest > 0) {
    triples.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const parts: string[] = [];
  for (let i = triples.length - 1; i >= 0; i--) {
    const t = triples[i];
    if (t === undefined) continue;
    if (t === 0) continue;
    const full = i !== triples.length - 1;
    parts.push(`${readTriple(t, full)}${UNITS[i] ?? ""}`);
  }

  const text = parts.join(", ").replace(/\s+/g, " ").trim();
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} đồng`;
}

/** Nhận biết trường nhập số tiền theo mã trường hoặc nhãn. */
export function isMoneyNumberField(key: string, label: string) {
  return /_numb$/i.test(key) || /\(số\)/i.test(label) || /số tiền|giá trị|giá gói/i.test(label);
}

/** Mã trường "bằng chữ" tương ứng với một trường "bằng số". */
export function moneyTextKey(key: string) {
  return key.replace(/_numb$/i, "_text");
}

const WORD_DIGITS: Record<string, number> = {
  khong: 0, mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, nham: 5,
  sau: 6, bay: 7, tam: 8, chin: 9,
};
const WORD_SCALES: Record<string, number> = { nghin: 1e3, ngan: 1e3, trieu: 1e6, ty: 1e9, ti: 1e9 };

/**
 * Đọc ngược số tiền bằng chữ thành số (nghịch đảo của readVietnameseMoney).
 * Chịu có/không dấu, nghìn/ngàn, tỷ/tỉ, lăm/nhăm, mốt, tư, lẻ/linh; trả null khi có từ lạ (OCR hỏng).
 */
export function parseVietnameseMoneyWords(input: string | null | undefined): number | null {
  const folded = (input ?? "")
    .replace(/[đĐ]/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\b(dong\s*chan|dong|chan|vnd|vn\s*d)\b/g, " ")
    .replace(/[,.;:\-–()]/g, " ");
  const tokens = folded.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const stack: { value: number; scale: number }[] = [];
  let chunk = 0;
  let pend: number | null = null;
  let seen = false;
  for (const token of tokens) {
    if (token === "le" || token === "linh") continue;
    if (token in WORD_DIGITS) {
      if (pend !== null) return null;
      pend = WORD_DIGITS[token]!;
      seen = true;
    } else if (token === "tram") {
      if (pend === null) return null;
      chunk += pend * 100;
      pend = null;
    } else if (token === "muoi") {
      chunk += (pend ?? 1) * 10;
      pend = null;
      seen = true;
    } else if (token in WORD_SCALES) {
      const scale = WORD_SCALES[token]!;
      let value = chunk + (pend ?? 0);
      chunk = 0;
      pend = null;
      while (stack.length && stack[stack.length - 1]!.scale < scale) value += stack.pop()!.value;
      if (value === 0) return null;
      stack.push({ value: value * scale, scale });
    } else return null;
  }
  if (!seen) return null;
  return stack.reduce((sum, item) => sum + item.value, 0) + chunk + (pend ?? 0);
}

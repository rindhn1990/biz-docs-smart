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
    const t = triples[i]!;
    if (t === 0) continue;
    const full = i !== triples.length - 1;
    parts.push(`${readTriple(t, full)}${UNITS[i] ?? ""}`);
  }

  const text = parts.join(" ").replace(/\s+/g, " ").trim();
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

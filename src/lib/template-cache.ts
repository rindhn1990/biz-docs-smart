/**
 * Bản mới nhất của file mẫu vừa được ghi trong phiên trình duyệt này.
 * Storage có thể trả bản cũ (cache) ngay sau khi ghi đè, nên luôn ưu tiên bản trong bộ nhớ.
 */
const latest = new Map<string, ArrayBuffer>();

export function rememberTemplateBuffer(path: string, buffer: ArrayBuffer) {
  latest.set(path, buffer.slice(0));
}

export function recallTemplateBuffer(path: string): ArrayBuffer | null {
  const b = latest.get(path);
  return b ? b.slice(0) : null;
}

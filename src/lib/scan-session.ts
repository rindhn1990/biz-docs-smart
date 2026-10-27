import type { LocalScannedValue } from "./field-extract";

export type ScanRow = { key: string; label: string; value: string; confidence: number; selected: boolean; source: string; edited: boolean };

export function mergeScanRows(rows: ScanRow[], fields: { key: string; label: string }[], values: LocalScannedValue[], source: string): ScanRow[] {
  return fields.map((field) => {
    const old = rows.find((row) => row.key === field.key);
    const hit = values.find((value) => value.key === field.key && value.value.trim());
    if (old?.edited || !hit || (old?.value && old.confidence > hit.confidence))
      return old ?? { ...field, value: "", confidence: 0, selected: false, source: "", edited: false };
    return { ...field, value: hit.value, confidence: hit.confidence, selected: true, source: hit.source ?? source, edited: false };
  });
}

/** Per-dialog cache: whole files only; failed OCR is never cached. */
export class WholeFileTextCache {
  private texts = new Map<string, string>();
  clear() { this.texts.clear(); }
  async read(file: Pick<File, "name" | "size" | "lastModified">, whole: boolean, read: () => Promise<string>) {
    const key = JSON.stringify([file.name, file.size, file.lastModified]);
    const cached = whole ? this.texts.get(key) : undefined;
    if (cached !== undefined) return cached;
    const text = await read();
    if (whole && text.replace(/\s/g, "").length >= 5) this.texts.set(key, text);
    return text;
  }
}
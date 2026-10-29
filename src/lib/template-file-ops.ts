import { previousDocxPath, validateDocx, UNSAFE_DOCX_MESSAGE } from "./docx-safety";
import PizZip from "pizzip";

export type TemplateFileStore = { read: (path: string) => Promise<ArrayBuffer>; write: (path: string, buffer: ArrayBuffer) => Promise<void> };

function samePackage(a: ArrayBuffer, b: ArrayBuffer) {
  const left = new PizZip(a); const right = new PizZip(b);
  const names = Object.keys(left.files).sort();
  if (JSON.stringify(names) !== JSON.stringify(Object.keys(right.files).sort())) return false;
  return names.every(name => {
    if (left.files[name]?.dir) return true;
    const x = left.file(name)?.asUint8Array(); const y = right.file(name)?.asUint8Array();
    return !!x && !!y && x.length === y.length && x.every((v,i) => v === y[i]);
  });
}

/** Validation and backup complete before any source overwrite; injected storage enables safe tests. */
export async function writeTemplateWithBackup(store: TemplateFileStore, path: string, next: ArrayBuffer, exists: boolean, expectedSource?: ArrayBuffer) {
  validateDocx(next);
  if (exists) {
    const previous = await store.read(path);
    if (expectedSource && !samePackage(previous, expectedSource)) throw new Error(`${UNSAFE_DOCX_MESSAGE}: File đã thay đổi, hãy mở lại mẫu`);
    await store.write(previousDocxPath(path), previous);
  }
  await store.write(path, next);
}

export async function restoreTemplateBackup(store: TemplateFileStore, path: string) {
  const previous = await store.read(previousDocxPath(path));
  await writeTemplateWithBackup(store, path, previous, true);
  return previous;
}
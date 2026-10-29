import { supabase } from "@/integrations/supabase/client";
import { previousDocxPath, validateDocx } from "./docx-safety";
import { rememberTemplateBuffer } from "./template-cache";

const options = { upsert: true, cacheControl: "0", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };

/** Backup failure aborts overwrite. Download authoritative bytes, never a preview cache. */
export async function saveTemplateFile(path: string, next: ArrayBuffer, exists: boolean) {
  validateDocx(next);
  if (exists) {
    const { data, error } = await supabase.storage.from("templates").download(path);
    if (error || !data) throw error ?? new Error("Không đọc được bản trước để sao lưu");
    const backup = await supabase.storage.from("templates").upload(previousDocxPath(path), data, options);
    if (backup.error) throw backup.error;
  }
  const result = await supabase.storage.from("templates").upload(path, next, options);
  if (result.error) throw result.error;
  rememberTemplateBuffer(path, next);
}

export async function undoTemplateFile(path: string) {
  const { data, error } = await supabase.storage.from("templates").download(previousDocxPath(path));
  if (error || !data) throw new Error("Chưa có bản sao lưu để hoàn tác");
  const buffer = await data.arrayBuffer();
  await saveTemplateFile(path, buffer, true);
  return buffer;
}
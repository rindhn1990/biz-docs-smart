import { supabase } from "@/integrations/supabase/client";
import { rememberTemplateBuffer } from "./template-cache";
import { writeTemplateWithBackup, restoreTemplateBackup, type TemplateFileStore } from "./template-file-ops";

const options = { upsert: true, cacheControl: "0", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };

const store: TemplateFileStore = {
  async read(path) {
    const { data, error } = await supabase.storage.from("templates").download(path);
    if (error || !data) throw error ?? new Error("Không đọc được bản trước để sao lưu");
    return data.arrayBuffer();
  },
  async write(path, buffer) {
    const result = await supabase.storage.from("templates").upload(path, buffer, options);
    if (result.error) throw result.error;
  },
};

export async function saveTemplateFile(path: string, next: ArrayBuffer, exists: boolean, expectedSource?: ArrayBuffer) {
  await writeTemplateWithBackup(store, path, next, exists, expectedSource);
  rememberTemplateBuffer(path, next);
}

export async function undoTemplateFile(path: string) {
  const buffer = await restoreTemplateBackup(store, path);
  rememberTemplateBuffer(path, buffer);
  return buffer;
}
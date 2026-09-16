import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGateway, GatewayError, parseJsonBlock } from "./ai-gateway.server";

const VISION_MODEL = "google/gemini-3.8-flash";

const SYSTEM_PROMPT = `Bạn là hệ thống OCR và bóc tách dữ liệu tài liệu hành chính của doanh nghiệp Việt Nam.
QUY TẮC BẮT BUỘC:
- Chỉ trích xuất thông tin CÓ THẬT trong tài liệu, tuyệt đối không suy đoán, không bịa.
- Không tìm thấy thì value = null và confidence = 0.
- Ngày tháng giữ nguyên cách ghi trong tài liệu (ví dụ 12/05/2026).
- Số tiền trả về dạng số, dùng dấu chấm ngăn cách hàng nghìn (ví dụ 1.250.000.000).
- confidence là số thực 0..1 phản ánh mức chắc chắn thật sự.
Chỉ trả về JSON, không giải thích.`;

const inputSchema = z.object({
  fileName: z.string().min(1).max(300),
  mimeType: z.string().min(3).max(200),
  /** Nội dung tệp mã hoá base64 (ảnh/PDF) hoặc văn bản thuần với mimeType text/plain. */
  content: z.string().min(1).max(14_000_000),
  fields: z
    .array(z.object({ key: z.string().min(1).max(80), label: z.string().min(1).max(200) }))
    .min(1)
    .max(80),
  note: z.string().max(500).optional(),
});

type ScanFieldResult = {
  fields?: Record<string, { value: unknown; confidence?: number | null } | null>;
};

export type ScannedValue = { key: string; value: string; confidence: number };

/** Quét một tệp (ảnh chụp, PDF, văn bản Word đã bóc chữ) và bóc tách theo danh sách trường yêu cầu. */
export const scanFileFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<{ values: ScannedValue[] }> => {
    const isImage = data.mimeType.startsWith("image/");
    const isPdf = data.mimeType === "application/pdf";
    const isText = data.mimeType.startsWith("text/");

    if (!isImage && !isPdf && !isText) {
      throw new Error(
        "Định dạng tệp này chưa đọc được tự động. Hãy dùng ảnh chụp, PDF hoặc file Word (.docx).",
      );
    }

    const spec = data.fields.map((f) => `- ${f.key}: ${f.label}`).join("\n");
    const prompt = `Tài liệu: "${data.fileName}".${data.note ? `\nGhi chú: ${data.note}` : ""}
Hãy đọc kỹ toàn bộ nội dung (OCR tiếng Việt có dấu, đọc cả bảng biểu, con dấu, chữ ký) và bóc tách các trường sau:
${spec}

Trả về JSON đúng cấu trúc:
{ "fields": { "<key>": { "value": <chuỗi hoặc null>, "confidence": 0.0 } } }`;

    const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
    if (isImage) {
      content.push({
        type: "image_url",
        image_url: { url: `data:${data.mimeType};base64,${data.content}` },
      });
    } else if (isPdf) {
      content.push({
        type: "file",
        file: {
          filename: data.fileName,
          file_data: `data:${data.mimeType};base64,${data.content}`,
        },
      });
    } else {
      content.push({ type: "text", text: `Nội dung tài liệu:\n${data.content.slice(0, 120_000)}` });
    }

    let answer: string;
    try {
      answer = await callGateway({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
      });
    } catch (err) {
      throw new Error(
        err instanceof GatewayError ? err.message : "Không nhận dạng được nội dung tệp.",
      );
    }

    const parsed = parseJsonBlock<ScanFieldResult>(answer);
    if (!parsed?.fields) {
      throw new Error("Không đọc được kết quả nhận dạng. Hãy thử lại với ảnh rõ nét hơn.");
    }

    const values: ScannedValue[] = [];
    for (const field of data.fields) {
      const hit = parsed.fields[field.key];
      const raw = hit?.value;
      if (raw === null || raw === undefined) continue;
      const value = String(raw).trim();
      if (!value || value.toLowerCase() === "null") continue;
      const confidence = typeof hit?.confidence === "number" ? hit.confidence : 0.6;
      values.push({ key: field.key, value, confidence: Math.max(0, Math.min(1, confidence)) });
    }
    return { values };
  });

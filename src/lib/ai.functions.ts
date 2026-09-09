import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGateway, GatewayError, parseJsonBlock } from "./ai-gateway.server";
import { EXTRACTION_FIELDS } from "./domain";

const VISION_MODEL = "google/gemini-3.7-flash";
const TEXT_MODEL = "google/gemini-3.7-flash";

const DOC_TYPES = [
  "ho_so_moi_thau",
  "ho_so_du_thau",
  "quyet_dinh",
  "thong_bao",
  "hop_dong",
  "phu_luc_hop_dong",
  "bien_ban",
  "bao_gia",
  "de_nghi_thanh_toan",
  "hoa_don",
  "chung_tu",
  "khac",
];

const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

function fieldSpec() {
  return EXTRACTION_FIELDS.map((f) => `- ${f.key} (${f.label}, kiểu ${f.type})`).join("\n");
}

const SYSTEM_PROMPT = `Bạn là hệ thống OCR và bóc tách dữ liệu tài liệu hành chính - đấu thầu của doanh nghiệp Việt Nam.
QUY TẮC BẮT BUỘC:
- Chỉ trích xuất thông tin CÓ THẬT trong tài liệu. Tuyệt đối không suy đoán, không bịa.
- Nếu không tìm thấy thông tin: value = null, confidence = 0.
- Ngày tháng trả về định dạng YYYY-MM-DD. Nếu tài liệu ghi dd/mm/yyyy thì chuyển đúng.
- Số tiền trả về dạng số nguyên VND, không dấu phân cách, không ký tự tiền tệ.
- confidence là số thực 0..1 phản ánh mức chắc chắn thật sự.
- needs_review = true khi confidence < 0.9 hoặc có nhiều giá trị khả dĩ.
- source_text là đoạn văn bản gốc chứa giá trị (tối đa 160 ký tự). source_page là số trang (1-based) nếu xác định được, ngược lại null.
Chỉ trả về JSON, không giải thích.`;

function buildUserPrompt(fileName: string) {
  return `Tài liệu: "${fileName}".
Nhiệm vụ:
1) Đọc toàn bộ nội dung (OCR tiếng Việt có dấu, đọc cả bảng biểu, chữ ký, con dấu nếu có).
2) Phân loại tài liệu vào một trong các mã: ${DOC_TYPES.join(", ")}.
3) Bóc tách các trường sau:
${fieldSpec()}

Trả về JSON đúng cấu trúc:
{
  "ocr_text": "toàn bộ văn bản đọc được, giữ xuống dòng",
  "page_count": <số trang hoặc null>,
  "document_type": { "value": "<mã loại>", "confidence": 0.0 },
  "fields": {
    "<field_key>": { "value": <giá trị hoặc null>, "confidence": 0.0, "source_page": <số hoặc null>, "source_text": "<trích dẫn hoặc null>", "needs_review": true }
  }
}`;
}

type ExtractResult = {
  ocr_text?: string;
  page_count?: number | null;
  document_type?: { value: string | null; confidence: number | null };
  fields?: Record<string, unknown>;
};

/**
 * Bước 1+2: OCR và bóc tách dữ liệu cho một tài liệu đã tải lên.
 * Kết quả LUÔN vào bảng chờ kiểm tra, không ghi thẳng vào hồ sơ chính thức.
 */
export const processDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ documentId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("*")
      .eq("id", data.documentId)
      .maybeSingle();
    if (docErr) throw new Error(`Không đọc được tài liệu: ${docErr.message}`);
    if (!doc) throw new Error("Không tìm thấy tài liệu.");

    const mime = doc.mime_type ?? "";
    const isImage = IMAGE_MIME.includes(mime);
    const isPdf = mime === "application/pdf";

    if (!isImage && !isPdf) {
      const message =
        "Định dạng này (Word/Excel) chưa đọc được tự động. Hãy xuất sang PDF rồi tải lên lại, hoặc nhập dữ liệu thủ công.";
      await supabase
        .from("documents")
        .update({ status: "pending_review", ocr_error: message })
        .eq("id", doc.id);
      throw new Error(message);
    }

    const { data: file, error: dlErr } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);
    if (dlErr || !file) throw new Error("Không tải được tệp từ kho lưu trữ.");

    const buffer = new Uint8Array(await file.arrayBuffer());
    if (buffer.byteLength === 0) throw new Error("Tệp rỗng, không thể đọc nội dung.");
    if (buffer.byteLength > 20 * 1024 * 1024) {
      throw new Error("Tệp lớn hơn 20MB nên không thể đọc tự động. Hãy tách nhỏ tài liệu.");
    }

    let binary = "";
    for (let i = 0; i < buffer.byteLength; i += 8192) {
      binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
    }
    const base64 = btoa(binary);

    const contentBlock = isImage
      ? { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
      : {
          type: "file",
          file: { filename: doc.file_name, file_data: `data:${mime};base64,${base64}` },
        };

    let text: string;
    try {
      text = await callGateway({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [{ type: "text", text: buildUserPrompt(doc.file_name) }, contentBlock],
          },
        ],
      });
    } catch (err) {
      const message = err instanceof GatewayError ? err.message : "Nhận dạng tài liệu thất bại.";
      await supabase
        .from("documents")
        .update({ status: "pending_review", ocr_error: message })
        .eq("id", doc.id);
      throw new Error(message);
    }

    const parsed = parseJsonBlock<ExtractResult>(text);
    if (!parsed) {
      const message = "Không đọc được kết quả nhận dạng. Hãy thử lại hoặc dùng bản scan rõ hơn.";
      await supabase
        .from("documents")
        .update({ status: "pending_review", ocr_error: message })
        .eq("id", doc.id);
      throw new Error(message);
    }

    const fields = (parsed.fields ?? {}) as Record<
      string,
      { value: unknown; confidence?: number | null }
    >;
    const confidences = Object.values(fields)
      .map((f) => (typeof f?.confidence === "number" ? f.confidence : null))
      .filter((c): c is number => c !== null && c > 0);
    const overall = confidences.length
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    await supabase
      .from("documents")
      .update({
        ocr_text: parsed.ocr_text ?? null,
        ocr_provider: `lovable-ai:${VISION_MODEL}`,
        ocr_error: null,
        page_count: parsed.page_count ?? null,
        doc_type_code: parsed.document_type?.value ?? null,
        doc_type_confidence: parsed.document_type?.confidence ?? null,
        status: "pending_review",
        updated_by: userId,
      })
      .eq("id", doc.id);

    const { data: extraction, error: exErr } = await supabase
      .from("document_extractions")
      .insert({
        document_id: doc.id,
        model: VISION_MODEL,
        raw_json: { document_type: parsed.document_type ?? null, fields } as never,
        overall_confidence: Number(overall.toFixed(4)),
        needs_review: true,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();
    if (exErr) throw new Error(`Không lưu được kết quả bóc tách: ${exErr.message}`);

    await supabase.from("workflow_events").insert({
      entity_type: "document",
      entity_id: doc.id,
      from_status: doc.status,
      to_status: "pending_review",
      action: "OCR + bóc tách dữ liệu",
      note: `Độ tin cậy trung bình ${(overall * 100).toFixed(0)}%`,
      actor_id: userId,
      created_by: userId,
      updated_by: userId,
    });

    return { extractionId: extraction.id, overall };
  });

/** Trợ lý AI trả lời dựa trên dữ liệu thật trong hệ thống. */
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ question: z.string().min(2).max(1000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = new Date().toISOString().slice(0, 10);

    const [contracts, tenders, payments, customers, docs] = await Promise.all([
      supabase
        .from("contracts")
        .select(
          "contract_number,title,status,sign_date,start_date,end_date,total_value,customer_id,assignee_id",
        )
        .order("end_date", { ascending: true })
        .limit(200),
      supabase
        .from("tenders")
        .select("code,name,status,package_value,bid_value,won_value,submit_deadline,open_date,result_date")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("payments")
        .select("contract_id,installment_no,total_amount,status,request_date,paid_date")
        .limit(300),
      supabase.from("customers").select("id,name,tax_code").limit(200),
      supabase.from("documents").select("file_name,doc_type_code,status,folder").limit(150),
    ]);

    const snapshot = {
      hom_nay: today,
      hop_dong: contracts.data ?? [],
      goi_thau: tenders.data ?? [],
      thanh_toan: payments.data ?? [],
      khach_hang: customers.data ?? [],
      tai_lieu: docs.data ?? [],
    };

    const answer = await callGateway({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content: `Bạn là trợ lý nội bộ của hệ thống quản lý văn phòng. Trả lời NGẮN GỌN bằng tiếng Việt, chỉ dựa trên dữ liệu JSON được cung cấp.
- Không bịa số liệu. Nếu dữ liệu không đủ, nói rõ là chưa có dữ liệu.
- Số tiền trình bày theo định dạng Việt Nam (ví dụ 12.500.000.000 VNĐ).
- Khi liệt kê, dùng gạch đầu dòng.`,
        },
        {
          role: "user",
          content: `Dữ liệu hệ thống (JSON):\n${JSON.stringify(snapshot).slice(0, 120_000)}\n\nCâu hỏi: ${data.question}`,
        },
      ],
    });

    return { answer };
  });

/**
 * Lớp trừu tượng cho OCR + AI extraction.
 * Provider mặc định: Lovable AI Gateway (vision model). Có thể thay bằng
 * Google Vision / Azure Document Intelligence bằng cách thêm implementation mới
 * vào `callVisionProvider` mà không đổi phần còn lại của hệ thống.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type GatewayMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

export class GatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function callGateway(opts: {
  model: string;
  messages: GatewayMessage[];
  maxTokens?: number;
}): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new GatewayError(401, "Chưa cấu hình khóa dịch vụ AI.");

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
  };
  if (opts.model.startsWith("openai/gpt-5.6")) body["reasoning_effort"] = "none";

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const message =
      res.status === 402
        ? "Đã hết hạn mức sử dụng AI của không gian làm việc. Vui lòng nạp thêm để tiếp tục."
        : res.status === 429
          ? "Hệ thống AI đang quá tải, vui lòng thử lại sau ít phút."
          : res.status === 403
            ? "Tính năng AI đang bị khóa theo chính sách của không gian làm việc."
            : `Dịch vụ AI trả về lỗi (${res.status}). ${text.slice(0, 300)}`;
    throw new GatewayError(res.status, message);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Bóc khối JSON đầu tiên trong câu trả lời của mô hình. */
export function parseJsonBlock<T>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

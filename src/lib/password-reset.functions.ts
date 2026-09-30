import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

export type PasswordResetResult =
  | { status: "sent" }
  | { status: "not_registered" }
  | { status: "cooldown"; waitSeconds: number }
  | { status: "hourly_limit"; waitSeconds: number }
  | { status: "email_not_configured" }
  | { status: "error" };

const MIN_GAP_MS = 5 * 60_000;
const WINDOW_MS = 60 * 60_000;
const MAX_PER_WINDOW = 3;
const MAX_PER_IP = 10;

/** Mật khẩu tạm 8 ký tự: luôn có chữ hoa, thường, số và ký tự đặc biệt. */
function generateTempPassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%&*?"];
  const all = sets.join("");
  const rand = (n: number) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0]! % n;
  };
  const chars = sets.map((s) => s[rand(s.length)]!);
  while (chars.length < 8) chars.push(all[rand(all.length)]!);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendTempPasswordEmail(to: string, password: string, apiKey: string, from: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "OfficeFlow — Mật khẩu tạm thời",
      html: `<p>Xin chào,</p><p>Mật khẩu tạm thời của bạn là: <strong style="font-family:monospace;font-size:16px">${password}</strong></p><p>Hãy đăng nhập bằng mật khẩu này; hệ thống sẽ yêu cầu bạn đổi mật khẩu mới ngay sau khi đăng nhập.</p><p>Nếu bạn không yêu cầu, hãy báo cho quản trị viên.</p>`,
    }),
  });
  return res.ok;
}

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().trim().email().max(255) }).parse(d))
  .handler(async ({ data }): Promise<PasswordResetResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const ipHash = await sha256(`officeflow:${ip}`);
    const now = Date.now();
    const since = new Date(now - WINDOW_MS).toISOString();

    const [{ data: byEmail }, { count: ipCount }] = await Promise.all([
      supabaseAdmin
        .from("password_reset_requests")
        .select("created_at")
        .eq("normalized_email", email)
        .gte("created_at", since)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("password_reset_requests")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", since),
    ]);
    const times = (byEmail ?? []).map((r) => new Date(r.created_at).getTime());
    const last = times[times.length - 1];
    if (last && now - last < MIN_GAP_MS) {
      return { status: "cooldown", waitSeconds: Math.ceil((last + MIN_GAP_MS - now) / 1000) };
    }
    if (times.length >= MAX_PER_WINDOW) {
      return { status: "hourly_limit", waitSeconds: Math.ceil((times[0]! + WINDOW_MS - now) / 1000) };
    }
    if ((ipCount ?? 0) >= MAX_PER_IP) {
      return { status: "hourly_limit", waitSeconds: 15 * 60 };
    }

    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["PASSWORD_RESET_FROM_EMAIL"];

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    // Mọi yêu cầu hợp lệ (kể cả email chưa đăng ký) đều được tính để hạn chế dò email.
    await supabaseAdmin
      .from("password_reset_requests")
      .insert({ normalized_email: email, ip_hash: ipHash, counted: true });

    if (!profile) return { status: "not_registered" };
    if (!apiKey || !from) return { status: "email_not_configured" };

    const temp = generateTempPassword();
    // Gửi thư trước; nếu gửi lỗi thì mật khẩu cũ vẫn dùng được.
    const sent = await sendTempPasswordEmail(email, temp, apiKey, from).catch(() => false);
    if (!sent) {
      console.error("[password-reset] email provider rejected the request");
      return { status: "error" };
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, { password: temp });
    if (error) {
      console.error("[password-reset] could not update password");
      return { status: "error" };
    }
    await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", profile.id);
    return { status: "sent" };
  });

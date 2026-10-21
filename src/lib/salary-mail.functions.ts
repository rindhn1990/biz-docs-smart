import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSalaryMail, isValidEmail, salaryMailValues } from "@/lib/salary-mail";

const MAX_BATCH = 500;
const SEND_GAP_MS = 350; // giãn cách giữa các thư để không vượt giới hạn tốc độ của Resend

async function requireAdmin(supabase: { from: (t: string) => unknown }, userId: string) {
  const { data: roles, error } = await (supabase.from("user_roles") as ReturnType<typeof Object>)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("role" as never)
    .eq("user_id" as never, userId as never);
  if (error || !(roles as { role: string }[] | null)?.some((r) => r.role === "admin")) {
    throw new Error("Chỉ quản trị viên được dùng chức năng thông báo lương.");
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const getSalaryMailConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const from = process.env["SALARY_MAIL_FROM"] || process.env["PASSWORD_RESET_FROM_EMAIL"];
    return { configured: Boolean(process.env["RESEND_API_KEY"] && from) };
  });

const batchInput = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  templateId: z.string().uuid(),
  employeeIds: z.array(z.string().uuid()).min(1).max(MAX_BATCH),
  resend: z.boolean().default(false),
  testEmail: z.string().trim().email().max(255).optional(),
});

export type SalarySendResult = {
  employeeId: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
};

export const sendSalaryBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => batchInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["SALARY_MAIL_FROM"] || process.env["PASSWORD_RESET_FROM_EMAIL"];
    if (!apiKey || !from) throw new Error("Chưa cấu hình gửi email (RESEND_API_KEY / địa chỉ gửi).");

    const isTest = Boolean(data.testEmail);

    // Tự đọc lại toàn bộ dữ liệu từ CSDL — không tin số tiền/email từ client.
    const [emps, salaries, tpl, sentLogs] = await Promise.all([
      supabaseAdmin
        .from("employees")
        .select("id,full_name,email,position,department,unit_id,hr_units(name)")
        .in("id", data.employeeIds),
      supabaseAdmin.from("hr_salaries").select("employee_id,amount").eq("period", data.period).in("employee_id", data.employeeIds),
      supabaseAdmin.from("hr_email_templates").select("id,subject,body").eq("id", data.templateId).maybeSingle(),
      supabaseAdmin
        .from("hr_salary_mail_log")
        .select("employee_id")
        .eq("period", data.period)
        .eq("kind", "real")
        .eq("status", "sent")
        .in("employee_id", data.employeeIds),
    ]);
    if (emps.error) throw new Error(emps.error.message);
    if (salaries.error) throw new Error(salaries.error.message);
    if (tpl.error) throw new Error(tpl.error.message);
    if (sentLogs.error) throw new Error(sentLogs.error.message);
    if (!tpl.data) throw new Error("Không tìm thấy mẫu email.");

    const salaryByEmp = new Map((salaries.data ?? []).map((s) => [s.employee_id, Number(s.amount)]));
    const sentSet = new Set((sentLogs.data ?? []).map((l) => l.employee_id));
    const template = tpl.data;

    const results: SalarySendResult[] = [];
    for (const emp of emps.data ?? []) {
      const amount = salaryByEmp.get(emp.id) ?? null;
      const unitName = (emp.hr_units as { name: string } | null)?.name ?? null;

      if (!isTest && sentSet.has(emp.id) && !data.resend) {
        results.push({ employeeId: emp.id, status: "skipped", error: "Đã gửi kỳ này" });
        continue;
      }

      const logBase = {
        employee_id: emp.id,
        employee_name: emp.full_name,
        email: isTest ? data.testEmail! : emp.email,
        period: data.period,
        template_id: template.id,
        amount,
        kind: isTest ? "test" : "real",
        sent_by: context.userId,
      };

      const fail = async (reason: string) => {
        await supabaseAdmin.from("hr_salary_mail_log").insert({ ...logBase, subject: null, status: "failed", error: reason });
        results.push({ employeeId: emp.id, status: "failed", error: reason });
      };

      if (!isTest && !isValidEmail(emp.email)) {
        await fail(emp.email ? "Email không hợp lệ" : "Thiếu email");
        continue;
      }
      if (amount === null) {
        await fail("Thiếu lương kỳ này");
        continue;
      }

      const mail = buildSalaryMail(
        template.subject,
        template.body,
        salaryMailValues({
          fullName: emp.full_name,
          period: data.period,
          amount,
          unitName,
          position: emp.position,
          department: emp.department,
        }),
      );
      if (mail.missing.length > 0) {
        await fail(`Thiếu: ${mail.missing.join(", ")}`);
        continue;
      }

      const subject = isTest ? `[GỬI THỬ] ${mail.subject}` : mail.subject;
      const to = isTest ? data.testEmail! : emp.email!;
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [to], subject, html: mail.html }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          await fail(`Nhà cung cấp từ chối (${res.status}): ${text.slice(0, 200)}`);
        } else {
          const body = (await res.json().catch(() => null)) as { id?: string } | null;
          await supabaseAdmin.from("hr_salary_mail_log").insert({
            ...logBase,
            subject,
            status: "sent",
            provider_id: body?.id ?? null,
          });
          results.push({ employeeId: emp.id, status: "sent" });
        }
      } catch {
        await fail("Lỗi kết nối nhà cung cấp email");
      }
      await sleep(SEND_GAP_MS);
    }
    return { results };
  });

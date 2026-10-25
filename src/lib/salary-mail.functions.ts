import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runSalaryBatch, SALARY_BATCH_SIZE } from "@/lib/salary-batch";
export type { SalarySendResult } from "@/lib/salary-batch";


type AuthContext = { supabase: SupabaseClient<Database>; userId: string };

async function requireAdmin(context: AuthContext) {
  const { data: roles, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (error || !roles?.some((r: { role: string }) => r.role === "admin")) {
    throw new Error("Chỉ quản trị viên được dùng chức năng thông báo lương.");
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const getSalaryMailConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const from = process.env["SALARY_MAIL_FROM"] || process.env["PASSWORD_RESET_FROM_EMAIL"];
    return { configured: Boolean(process.env["RESEND_API_KEY"] && from) };
  });

const batchInput = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  templateId: z.string().uuid(),
  employeeIds: z.array(z.string().uuid()).min(1).max(SALARY_BATCH_SIZE),
  resend: z.boolean().default(false),
  testEmail: z.string().trim().email().max(255).optional(),
});

export const sendSalaryBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => batchInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["SALARY_MAIL_FROM"] || process.env["PASSWORD_RESET_FROM_EMAIL"];
    if (!apiKey || !from) throw new Error("Chưa cấu hình gửi email (RESEND_API_KEY / địa chỉ gửi).");


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
    const sentSet = new Set((sentLogs.data ?? []).flatMap((log) => log.employee_id ? [log.employee_id] : []));
    const results = await runSalaryBatch({
      configured: true, period: data.period, template: tpl.data, resend: data.resend,
      testEmail: data.testEmail, sentEmployeeIds: sentSet,
      employees: (emps.data ?? []).map((emp) => ({
        id: emp.id, fullName: emp.full_name, email: emp.email,
        amount: salaryByEmp.get(emp.id) ?? null,
        unitName: (emp.hr_units as { name: string } | null)?.name ?? null,
        position: emp.position, department: emp.department,
      })),
    }, {
      wait: sleep,
      send: async (mail) => {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html }),
        });
        // Do not log or persist provider bodies: they may echo sensitive salary content.
        if (!res.ok) throw new Error(`Nhà cung cấp từ chối (${res.status}).`);
        const body = await res.json() as { id?: string };
        if (!body.id) throw new Error("Nhà cung cấp chưa xác nhận mã thư.");
        return { id: body.id };
      },
      writeLog: async (log) => {
        const row = {
          employee_id: log.employeeId, employee_name: log.employeeName, email: log.email,
          amount: log.amount, period: log.period, kind: log.kind, subject: log.subject,
          status: log.status, error: log.error, provider_id: log.providerId,
          template_id: data.templateId, sent_by: context.userId,
        };
        // Retain the old successful log on resend failure; replace only after delivery succeeds.
        const query = data.resend && sentSet.has(log.employeeId) && log.kind === "real" && log.status === "sent"
          ? supabaseAdmin.from("hr_salary_mail_log").update(row)
              .eq("employee_id", log.employeeId).eq("period", log.period).eq("kind", "real").eq("status", "sent")
          : supabaseAdmin.from("hr_salary_mail_log").insert(row);
        const { error } = await query;
        if (error?.code === "23505") return "duplicate";
        if (error) throw new Error("Không lưu được nhật ký.");
        return "saved";
      },
    });
    return { results };
  });

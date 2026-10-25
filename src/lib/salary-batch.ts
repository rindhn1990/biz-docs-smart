import { buildSalaryMail, isValidEmail, salaryMailValues } from "./salary-mail";

export const SALARY_BATCH_SIZE = 10;
export const SALARY_SEND_GAP_MS = 350;
export type SalarySendResult = { employeeId: string; status: "sent" | "failed" | "skipped"; error?: string };
export type SalaryBatchEmployee = {
  id: string; fullName: string | null; email: string | null; amount: number | null;
  unitName: string | null; position: string | null; department: string | null;
};
export type SalaryBatchLog = {
  employeeId: string; employeeName: string | null; email: string | null; amount: number | null;
  period: string; kind: "test" | "real"; subject: string | null;
  status: "sent" | "failed"; error: string | null; providerId: string | null;
};
type BatchInput = {
  configured: boolean; period: string; template: { subject: string; body: string };
  employees: SalaryBatchEmployee[]; sentEmployeeIds: ReadonlySet<string>; resend: boolean; testEmail?: string | undefined;
};
type BatchDependencies = {
  send: (mail: { to: string; subject: string; html: string; employeeId: string }) => Promise<{ id: string }>;
  writeLog: (log: SalaryBatchLog) => Promise<"saved" | "duplicate">;
  wait: (milliseconds: number) => Promise<void>;
};

/** Side effects are injected: tests never contact the email provider or database. */
export async function runSalaryBatch(input: BatchInput, dependencies: BatchDependencies): Promise<SalarySendResult[]> {
  if (!input.configured) throw new Error("Chưa cấu hình gửi email (khoá Resend / địa chỉ gửi).");
  const employees = [...new Map(input.employees.map((employee) => [employee.id, employee])).values()];
  if (employees.length > SALARY_BATCH_SIZE) throw new Error("Mỗi lô tối đa 10 nhân sự.");
  const results: SalarySendResult[] = [];
  const isTest = input.testEmail !== undefined;
  let attemptedSend = false;
  for (const employee of employees) {
    if (!isTest && !input.resend && input.sentEmployeeIds.has(employee.id)) {
      results.push({ employeeId: employee.id, status: "skipped", error: "Đã gửi kỳ này" });
      continue;
    }
    const to = isTest ? input.testEmail : employee.email;
    const base = {
      employeeId: employee.id, employeeName: employee.fullName, email: to ?? null,
      amount: employee.amount, period: input.period, kind: isTest ? "test" as const : "real" as const,
    };
    const record = async (status: "sent" | "failed", subject: string | null, error: string | null, providerId: string | null) => {
      try {
        const saved = await dependencies.writeLog({ ...base, status, subject, error, providerId });
        results.push(saved === "duplicate"
          ? { employeeId: employee.id, status: "skipped", error: "Đã có nhật ký gửi kỳ này; không ghi trùng." }
          : { employeeId: employee.id, status, ...(error ? { error } : {}) });
      } catch {
        results.push({ employeeId: employee.id, status: "failed", error: status === "sent"
          ? "Nhà cung cấp đã nhận thư nhưng không lưu được nhật ký. Kiểm tra trước khi gửi lại."
          : "Không lưu được nhật ký thất bại." });
      }
    };
    if (!to || !isValidEmail(to)) {
      await record("failed", null, to ? "Email không hợp lệ" : "Thiếu email", null);
      continue;
    }
    if (employee.amount === null || !Number.isFinite(employee.amount)) {
      await record("failed", null, "Thiếu lương kỳ này", null);
      continue;
    }
    const mail = buildSalaryMail(input.template.subject, input.template.body, salaryMailValues({
      fullName: employee.fullName, period: input.period, amount: employee.amount,
      unitName: employee.unitName, position: employee.position, department: employee.department,
    }));
    if (mail.missing.length) {
      await record("failed", null, `Thiếu: ${mail.missing.join(", ")}`, null);
      continue;
    }
    if (attemptedSend) await dependencies.wait(SALARY_SEND_GAP_MS);
    attemptedSend = true;
    const subject = isTest ? `[GỬI THỬ] ${mail.subject}` : mail.subject;
    try {
      const delivery = await dependencies.send({ to: to.trim(), subject, html: mail.html, employeeId: employee.id });
      await record("sent", subject, null, delivery.id);
    } catch (error) {
      await record("failed", subject, error instanceof Error ? error.message : "Lỗi kết nối nhà cung cấp email", null);
    }
  }
  return results;
}
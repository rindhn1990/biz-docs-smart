import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runSalaryBatch } from "./salary-batch.ts";

const employee = (id, values = {}) => ({ id, fullName: "Nguyễn Văn A", email: "test@example.invalid", amount: 12500000, unitName: "Kinh doanh", position: "Nhân viên", department: "KD", ...values });
const input = (values = {}) => ({ configured: true, period: "2026-10", template: { subject: "Lương {{Thang}}", body: "{{Ten_NV}}: {{Luong}}" }, employees: [employee("a")], sentEmployeeIds: new Set(), resend: false, ...values });
function fake(overrides = {}) {
  const deliveries = [], logs = [], gaps = [];
  return { deliveries, logs, gaps, dependencies: {
    send: async (mail) => { deliveries.push(mail); return { id: `fake-${mail.employeeId}` }; },
    writeLog: async (log) => { logs.push(log); return "saved"; },
    wait: async (ms) => { gaps.push(ms); }, ...overrides,
  } };
}

describe("Gửi lương bằng bộ gửi giả — không gửi thư thật", () => {
  it("bỏ qua người có sent cùng kỳ nhưng vẫn gửi người tiếp theo", async () => {
    const f = fake();
    const r = await runSalaryBatch(input({ employees: [employee("a"), employee("b")], sentEmployeeIds: new Set(["a"]) }), f.dependencies);
    assert.deepEqual(r.map((r) => r.status), ["skipped", "sent"]);
    assert.deepEqual(f.deliveries.map((d) => d.employeeId), ["b"]);
    assert.equal(f.logs.length, 1);
  });
  it("gửi lại chỉ khi được yêu cầu", async () => {
    const f = fake();
    await runSalaryBatch(input({ sentEmployeeIds: new Set(["a"]), resend: true }), f.dependencies);
    assert.equal(f.deliveries.length, 1);
    assert.equal(f.logs[0].kind, "real");
  });
  it("ghi nhật ký sent cùng mã nhà cung cấp", async () => {
    const f = fake();
    const r = await runSalaryBatch(input(), f.dependencies);
    assert.equal(r[0].status, "sent");
    assert.equal(f.logs[0].status, "sent");
    assert.equal(f.logs[0].providerId, "fake-a");
    assert.equal(f.logs[0].period, "2026-10");
  });
  it("ghi failed khi bộ gửi lỗi và vẫn xử lý người kế tiếp", async () => {
    const f = fake({ send: async (mail) => { if (mail.employeeId === "a") throw new Error("Lỗi giả"); return { id: "fake-b" }; } });
    const r = await runSalaryBatch(input({ employees: [employee("a"), employee("b")] }), f.dependencies);
    assert.deepEqual(r.map((r) => r.status), ["failed", "sent"]);
    assert.equal(f.logs[0].error, "Lỗi giả");
    assert.equal(f.logs[1].status, "sent");
  });
  it("vùng thiếu dữ liệu chặn gửi và ghi failed", async () => {
    const f = fake();
    await runSalaryBatch(input({ template: { subject: "Lương", body: "{{Chuc_vu}}" }, employees: [employee("a", { position: null })] }), f.dependencies);
    assert.equal(f.deliveries.length, 0);
    assert.equal(f.logs[0].error, "Thiếu: Chuc_vu");
  });
  it("thiếu email chặn gửi", async () => {
    const f = fake();
    await runSalaryBatch(input({ employees: [employee("a", { email: null })] }), f.dependencies);
    assert.equal(f.deliveries.length, 0);
    assert.equal(f.logs[0].error, "Thiếu email");
  });
  it("email không hợp lệ chặn gửi", async () => {
    const f = fake();
    await runSalaryBatch(input({ employees: [employee("a", { email: "sai" })] }), f.dependencies);
    assert.equal(f.deliveries.length, 0);
    assert.equal(f.logs[0].error, "Email không hợp lệ");
  });
  it("thiếu lương chặn gửi", async () => {
    const f = fake();
    await runSalaryBatch(input({ employees: [employee("a", { amount: null })] }), f.dependencies);
    assert.equal(f.deliveries.length, 0);
    assert.equal(f.logs[0].error, "Thiếu lương kỳ này");
  });
  it("thiếu cấu hình không gọi gửi hay nhật ký", async () => {
    const f = fake();
    await assert.rejects(runSalaryBatch(input({ configured: false }), f.dependencies), /Chưa cấu hình/);
    assert.equal(f.deliveries.length, 0);
    assert.equal(f.logs.length, 0);
  });
  it("gửi thử không tính sent kỳ và lần gửi thật sau đó vẫn gửi", async () => {
    const f = fake();
    await runSalaryBatch(input({ testEmail: "preview@example.invalid", sentEmployeeIds: new Set(["a"]) }), f.dependencies);
    assert.equal(f.logs[0].kind, "test");
    assert.equal(f.deliveries[0].to, "preview@example.invalid");
    const realSent = new Set(f.logs.filter((log) => log.kind === "real" && log.status === "sent").map((log) => log.employeeId));
    await runSalaryBatch(input({ sentEmployeeIds: realSent }), f.dependencies);
    assert.equal(f.logs[1].kind, "real");
    assert.equal(f.deliveries.length, 2);
  });
  it("lỗi trùng nhật ký chỉ ảnh hưởng một người", async () => {
    const f = fake({ writeLog: async (log) => log.employeeId === "a" ? "duplicate" : "saved" });
    const r = await runSalaryBatch(input({ employees: [employee("a"), employee("b")] }), f.dependencies);
    assert.deepEqual(r.map((r) => r.status), ["skipped", "sent"]);
  });
  it("lỗi lưu nhật ký không làm cả lô dừng", async () => {
    const f = fake({ writeLog: async (log) => { if (log.employeeId === "a") throw new Error("Lỗi giả"); return "saved"; } });
    const r = await runSalaryBatch(input({ employees: [employee("a"), employee("b")] }), f.dependencies);
    assert.deepEqual(r.map((r) => r.status), ["failed", "sent"]);
    assert.match(r[0].error, /đã nhận thư/);
  });
  it("mỗi thư một người và giãn cách 350ms giữa hai thư", async () => {
    const f = fake();
    await runSalaryBatch(input({ employees: [employee("a"), employee("b")] }), f.dependencies);
    assert.equal(f.deliveries.length, 2);
    assert.deepEqual(f.gaps, [350]);
    assert.equal(typeof f.deliveries[0].to, "string");
  });
  it("giới hạn 10 người và không gửi lô 11 người", async () => {
    const f = fake();
    await assert.rejects(runSalaryBatch(input({ employees: Array.from({ length: 11 }, (_, i) => employee(String(i))) }), f.dependencies), /10 nhân sự/);
    assert.equal(f.deliveries.length, 0);
  });
  it("loại ID trùng trong một lô để không gửi hai lần", async () => {
    const f = fake();
    await runSalaryBatch(input({ employees: [employee("a"), employee("a")] }), f.dependencies);
    assert.equal(f.deliveries.length, 1);
  });
});
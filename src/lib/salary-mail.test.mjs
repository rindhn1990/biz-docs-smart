import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSalaryMail,
  employeesInUnits,
  escapeHtml,
  isValidEmail,
  matchExcelRow,
  normalizeName,
  recipientStatus,
  salaryMailValues,
} from "./salary-mail.ts";

describe("buildSalaryMail", () => {
  const values = {
    Ten_NV: "Nguyễn Văn A",
    Thang: "10/2026",
    Nam: "2026",
    Luong: "12.500.000",
    Luong_chu: "Mười hai triệu, năm trăm nghìn đồng",
    Don_vi: "Kinh doanh",
    Chuc_vu: "Nhân viên",
    Phong_ban: "Phòng KD",
  };

  it("thay đủ các vùng trong tiêu đề và nội dung", () => {
    const mail = buildSalaryMail(
      "Lương {{Thang}} - {{Ten_NV}}",
      "Kính gửi {{Ten_NV}},\nLương tháng {{Thang}}: {{Luong}} ({{Luong_chu}}).",
      values,
    );
    assert.equal(mail.subject, "Lương 10/2026 - Nguyễn Văn A");
    assert.ok(mail.html.includes("Kính gửi Nguyễn Văn A,"));
    assert.ok(mail.html.includes("12.500.000 (Mười hai triệu, năm trăm nghìn đồng)."));
    assert.deepEqual(mail.missing, []);
  });

  it("giữ nguyên xuống dòng trong nội dung", () => {
    const mail = buildSalaryMail("t", "dòng 1\ndòng 2", values);
    assert.ok(mail.html.includes("dòng 1<br>dòng 2"));
  });

  it("escape HTML trong giá trị chèn, không cho chèn script", () => {
    const mail = buildSalaryMail("t", "Tên: {{Ten_NV}}", { ...values, Ten_NV: "<script>alert(1)</script>" });
    assert.ok(!mail.html.includes("<script>"));
    assert.ok(mail.html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  });

  it("vùng thiếu dữ liệu bị liệt kê và giữ nguyên placeholder", () => {
    const mail = buildSalaryMail("Lương {{Thang}}", "{{Ten_NV}} - {{Luong}} - {{Chuc_vu}}", {
      ...values,
      Luong: null,
      Chuc_vu: "  ",
    });
    assert.deepEqual(mail.missing.sort(), ["Chuc_vu", "Luong"]);
    assert.ok(mail.html.includes("{{Luong}}"));
  });

  it("vùng lạ không có trong danh sách được giữ nguyên và không chặn gửi", () => {
    const mail = buildSalaryMail("t", "{{Khong_biet}}", values);
    assert.deepEqual(mail.missing, []);
    assert.ok(mail.html.includes("{{Khong_biet}}"));
  });
});

describe("salaryMailValues", () => {
  it("định dạng số tiền và đọc thành chữ", () => {
    const v = salaryMailValues({
      fullName: "Trần B",
      period: "2026-10",
      amount: 12500000,
      unitName: "Kinh doanh",
      position: "NV",
      department: "KD",
    });
    assert.equal(v.Thang, "10/2026");
    assert.equal(v.Nam, "2026");
    assert.equal(v.Luong, "12.500.000");
    assert.equal(v.Luong_chu, "Mười hai triệu, năm trăm nghìn đồng");
  });

  it("không có số tiền thì Luong và Luong_chu đều null", () => {
    const v = salaryMailValues({ fullName: "X", period: "2026-01", amount: null, unitName: null, position: null, department: null });
    assert.equal(v.Luong, null);
    assert.equal(v.Luong_chu, null);
  });
});

describe("matchExcelRow", () => {
  const employees = [
    { id: "1", full_name: "Nguyễn Văn An", id_number: "001091005678" },
    { id: "2", full_name: "Trần Thị Bình", id_number: null },
    { id: "3", full_name: "Lê Văn Cường", id_number: "002" },
    { id: "4", full_name: "Lê Văn Cường", id_number: "003" },
  ];

  it("khớp theo số CCCD trước", () => {
    const r = matchExcelRow({ cccd: "001091005678", name: "Tên sai", amount: 1 }, employees);
    assert.equal(r.kind, "matched");
    assert.equal(r.employee.id, "1");
  });

  it("khớp theo họ tên đã chuẩn hoá (không dấu, thừa khoảng trắng)", () => {
    const r = matchExcelRow({ name: "  tran thi   binh ", amount: 1 }, employees);
    assert.equal(r.kind, "matched");
    assert.equal(r.employee.id, "2");
  });

  it("trùng tên mơ hồ khi có nhiều người cùng tên", () => {
    const r = matchExcelRow({ name: "Lê Văn Cường", amount: 1 }, employees);
    assert.equal(r.kind, "ambiguous");
    assert.equal(r.candidates.length, 2);
  });

  it("không khớp khi không có CCCD lẫn tên", () => {
    assert.equal(matchExcelRow({ name: "Người Lạ", amount: 1 }, employees).kind, "unmatched");
    assert.equal(matchExcelRow({ amount: 1 }, employees).kind, "unmatched");
  });
});

describe("recipientStatus", () => {
  it("phân loại đúng từng trạng thái", () => {
    assert.equal(recipientStatus({ email: null, amount: 1, sentReal: false, resend: false }), "no_email");
    assert.equal(recipientStatus({ email: "sai", amount: 1, sentReal: false, resend: false }), "bad_email");
    assert.equal(recipientStatus({ email: "a@b.vn", amount: null, sentReal: false, resend: false }), "no_salary");
    assert.equal(recipientStatus({ email: "a@b.vn", amount: 1, sentReal: true, resend: false }), "sent");
    assert.equal(recipientStatus({ email: "a@b.vn", amount: 1, sentReal: true, resend: true }), "ready");
    assert.equal(recipientStatus({ email: "a@b.vn", amount: 1, sentReal: false, resend: false }), "ready");
  });
});

describe("employeesInUnits", () => {
  const emps = [
    { id: "a", unit_id: "u1" },
    { id: "b", unit_id: null },
    { id: "c", unit_id: "u2" },
  ];
  it("chọn theo đầu mục kể cả Chưa phân loại", () => {
    assert.deepEqual(employeesInUnits(emps, ["u1"]).map((e) => e.id), ["a"]);
    assert.deepEqual(employeesInUnits(emps, ["none"]).map((e) => e.id), ["b"]);
    assert.deepEqual(employeesInUnits(emps, ["u1", "none", "u2"]).map((e) => e.id), ["a", "b", "c"]);
    assert.deepEqual(employeesInUnits(emps, []), []);
  });
});

describe("tiện ích phụ", () => {
  it("escapeHtml đầy đủ ký tự nguy hiểm", () => {
    assert.equal(escapeHtml(`<b>&"'</b>`), "&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;");
  });
  it("isValidEmail", () => {
    assert.ok(isValidEmail("a@b.vn"));
    assert.ok(!isValidEmail("a@b"));
    assert.ok(!isValidEmail(""));
  });
  it("normalizeName bỏ dấu và chữ đ", () => {
    assert.equal(normalizeName("Đỗ  Đức"), "do duc");
  });
});

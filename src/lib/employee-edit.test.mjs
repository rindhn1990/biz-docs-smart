import { it } from "node:test";
import assert from "node:assert/strict";
import { employeeEditPatch } from "./employee-edit.ts";

const values = { full_name: " Nguyễn Văn A ", email: " test@example.invalid ", address: " 12 Nguyễn Huệ ", hometown: " Huế ", id_number: "001234567890", position: "Kỹ sư", department: "Kỹ thuật", date_of_birth: "1990-01-31", unit_id: "none" };
it("sửa địa chỉ liên hệ riêng không ghi đè quê quán", () => {
  const patch = employeeEditPatch(values, true);
  assert.equal(patch.address, "12 Nguyễn Huệ");
  assert.equal(patch.hometown, "Huế");
  assert.equal(patch.full_name, "Nguyễn Văn A");
});
it("chỉ quản trị viên gửi thay đổi email", () => {
  assert.equal(employeeEditPatch(values, true).email, "test@example.invalid");
  assert.equal(Object.hasOwn(employeeEditPatch(values, false), "email"), false);
});
it("cho phép xóa email và địa chỉ mà không giữ giá trị cũ", () => {
  const patch = employeeEditPatch({ ...values, email: " ", address: " " }, true);
  assert.equal(patch.email, null);
  assert.equal(patch.address, null);
});
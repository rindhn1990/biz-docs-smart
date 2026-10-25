import { it } from "node:test";
import assert from "node:assert/strict";
import { allowedModuleTabs } from "../components/ModuleTabs.tsx";

it("không hiển thị thông báo lương cho người không phải admin", () => {
  assert.equal(allowedModuleTabs(true, true, false).some((tab) => tab.key === "thong-bao-luong"), false);
});
it("admin có phân hệ nhân sự thấy thông báo lương", () => {
  assert.equal(allowedModuleTabs(true, true, true).some((tab) => tab.key === "thong-bao-luong"), true);
});
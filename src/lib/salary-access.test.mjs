import { it } from "node:test";
import assert from "node:assert/strict";
import { allowedModuleTabs, MODULE_TABS } from "../components/ModuleTabs.tsx";

it("app_TMDT chỉ còn phân hệ Đấu thầu", () => {
  assert.deepEqual(MODULE_TABS.map((tab) => tab.key), ["dau-thau"]);
  assert.deepEqual(allowedModuleTabs(true).map((tab) => tab.key), ["dau-thau"]);
});

it("tài khoản bị chặn Đấu thầu không còn phân hệ nào", () => {
  assert.deepEqual(allowedModuleTabs(false), []);
});

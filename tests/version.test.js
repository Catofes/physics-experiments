import test from "node:test";
import assert from "node:assert/strict";
import { validateVersion } from "../scripts/version.mjs";
const pkg = { version: "0.1.0" };
const lock = { version: "0.1.0", packages: { "": { version: "0.1.0" } } };
test("发布标签与两个版本记录必须一致", () => {
  assert.equal(validateVersion(pkg, lock, "v0.1.0"), "0.1.0");
  assert.throws(() => validateVersion(pkg, lock, "v0.2.0"), /不一致/);
  assert.throws(
    () => validateVersion(pkg, { ...lock, version: "0.2.0" }),
    /不一致/,
  );
  assert.throws(
    () => validateVersion({ version: "0.1" }, lock),
    /三段稳定版本/,
  );
  assert.throws(
    () => validateVersion({ version: "0.1.0-beta.1" }, lock),
    /三段稳定版本/,
  );
});

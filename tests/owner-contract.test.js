const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const contractBytes = fs.readFileSync(path.join(root, "data/layout_contract_v1.json"));
const contract = JSON.parse(contractBytes);
const layoutSpec = JSON.parse(fs.readFileSync(path.join(root, "data/layout_spec.json"), "utf8"));
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const contractHash = createHash("sha256").update(contractBytes).digest("hex");

test("Coach consumes the hash-pinned v1 contract and reserves L1 for mouse", () => {
  assert.equal(contract.version, "1.0.0");
  assert.equal(contract.mouse_layer, 1);
  assert.equal(contract.frozen_layer, 7);
  assert.equal(layoutSpec.owner_contract.version, contract.version);
  assert.equal(layoutSpec.owner_contract.mouse_layer, contract.mouse_layer);
  assert.equal(layoutSpec.owner_contract.contract_sha256, contractHash);
  assert.deepEqual(layoutSpec.owner_contract.mouse_buttons, contract.mouse_buttons);
  assert.deepEqual(layoutSpec.owner_contract.fixed_positions, {
    MB1: [contract.fixed_mouse_bindings.MB1.x, contract.fixed_mouse_bindings.MB1.y],
    MB2: [contract.fixed_mouse_bindings.MB2.x, contract.fixed_mouse_bindings.MB2.y],
    Scroll: [contract.fixed_mouse_bindings[contract.scroll_bindings.fixed].x,
      contract.fixed_mouse_bindings[contract.scroll_bindings.fixed].y],
  });
  assert.equal(layoutSpec.owner_contract.extra_scroll_count,
    contract.scroll_bindings.additional);
  assert.deepEqual(layoutSpec.owner_contract.l0_mouse_hold,
    [contract.essential_access.x, contract.essential_access.y]);
  assert.match(app, new RegExp(`OWNER_CONTRACT_SHA256 = "${contractHash}"`));
  assert.match(app, /loadJson\("\.\/data\/layout_contract_v1\.json"/);
  assert.match(app, /function auditMouseContract\(\)/);
});

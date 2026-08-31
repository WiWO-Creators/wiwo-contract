import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

/** El paquete lo consumen NestJS (CommonJS) y los sitios (ESM). */
test("carga como CommonJS", () => {
  const require = createRequire(import.meta.url);
  const cjs = require("../dist/cjs/index.js");
  assert.equal(typeof cjs.parseManifest, "function");
  assert.equal(cjs.WIWO_CONTRACT_VERSION, "1.2");
});

test("carga como ESM", async () => {
  const esm = await import("../dist/esm/index.js");
  assert.equal(typeof esm.parseManifest, "function");
  assert.equal(esm.WIWO_CONTRACT_VERSION, "1.2");
});

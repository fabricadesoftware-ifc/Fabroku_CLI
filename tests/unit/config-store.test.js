import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FileConfigStore } from "../../lib/infrastructure/config/file-config-store.js";

test("FileConfigStore cria e persiste configuração no caminho informado", () => {
  const directory = mkdtempSync(join(tmpdir(), "fabroku-config-store-"));
  try {
    const store = new FileConfigStore({ directory, defaults: { api_url: "https://api.test", token: null } });
    assert.deepEqual(store.load(), { api_url: "https://api.test", token: null });
    store.save({ api_url: "https://api.test", token: "secret" });
    assert.deepEqual(store.load(), { api_url: "https://api.test", token: "secret" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

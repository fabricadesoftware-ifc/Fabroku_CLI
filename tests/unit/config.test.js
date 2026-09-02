import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadConfig, saveConfig } from "../../lib/config.js";

test("config store honors an injected directory for isolated runtimes", () => {
  const directory = mkdtempSync(join(tmpdir(), "fabroku-config-test-"));
  const previous = process.env.FABROKU_CONFIG_DIR;
  process.env.FABROKU_CONFIG_DIR = directory;

  try {
    saveConfig({ api_url: "https://api.example", token: "token", user: "user" });
    assert.deepEqual(loadConfig(), {
      api_url: "https://api.example",
      token: "token",
      user: "user",
    });
  } finally {
    if (previous === undefined) delete process.env.FABROKU_CONFIG_DIR;
    else process.env.FABROKU_CONFIG_DIR = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});

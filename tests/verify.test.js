import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { verify } from "../lib/commands/verify.js";

function djangoProject() {
  const dir = mkdtempSync(join(tmpdir(), "fabroku-verify-"));
  writeFileSync(join(dir, "manage.py"), "");
  writeFileSync(join(dir, "requirements.txt"), "django\n");
  writeFileSync(join(dir, "Procfile"), "web: gunicorn config.wsgi\n");
  return dir;
}

test("verify --fix gera .python-version no formato que o buildpack aceita", () => {
  const dir = djangoProject();
  assert.equal(verify({ dir, fix: true, quiet: true }), 0);
  assert.equal(readFileSync(join(dir, ".python-version"), "utf-8").trim(), "3.13");
});

test("verify recusa .python-version com prefixo python-", () => {
  const dir = djangoProject();
  writeFileSync(join(dir, ".python-version"), "python-3.13.2\n");
  assert.equal(verify({ dir, quiet: true }), 1);
});

test("verify --fix corrige .python-version com prefixo python-", () => {
  const dir = djangoProject();
  writeFileSync(join(dir, ".python-version"), "python-3.13.2\n");
  assert.equal(verify({ dir, fix: true, quiet: true }), 0);
  assert.equal(readFileSync(join(dir, ".python-version"), "utf-8").trim(), "3.13");
});

test("verify aceita versão exata do Python", () => {
  const dir = djangoProject();
  writeFileSync(join(dir, ".python-version"), "3.12.8\n");
  assert.equal(verify({ dir, quiet: true }), 0);
});

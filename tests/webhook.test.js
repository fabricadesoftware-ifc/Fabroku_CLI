import assert from "node:assert/strict";
import test from "node:test";

import { webhook } from "../lib/commands/webhook.js";

function createDiagnosis() {
  return {
    app: {
      id: 42,
      name: "app-webhook-test",
      git: "https://github.com/example/repo.git",
      branch: "main",
    },
    webhook_url: "https://api.example/api/webhooks/github/42/",
    checks: {
      backend_url_public: { ok: true, message: "OK" },
      user_git_token: { ok: true, message: "OK" },
      project_git_token: { ok: true, message: "OK" },
      git_url_parseable: { ok: true, message: "OK" },
      webhook_exists: { ok: false, message: "Webhook ausente" },
    },
  };
}

async function withoutConsoleOutput(callback) {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};

  try {
    await callback();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test("webhook diagnosis does not configure the repository implicitly", async () => {
  let setupCalls = 0;
  const api = {
    diagnoseWebhook: async () => createDiagnosis(),
    setupWebhook: async () => {
      setupCalls += 1;
      return { status: "webhook criado" };
    },
  };

  await withoutConsoleOutput(() => webhook("42", {}, api));

  assert.equal(setupCalls, 0);
});

test("webhook --setup explicitly configures the repository", async () => {
  let setupCalls = 0;
  const api = {
    diagnoseWebhook: async () => createDiagnosis(),
    setupWebhook: async () => {
      setupCalls += 1;
      return {
        status: "webhook criado",
        webhook_url: "https://api.example/api/webhooks/github/42/",
        hook_id: 123,
      };
    },
  };

  await withoutConsoleOutput(() => webhook("42", { setup: true }, api));

  assert.equal(setupCalls, 1);
});

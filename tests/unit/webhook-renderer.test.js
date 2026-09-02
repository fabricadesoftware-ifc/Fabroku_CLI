import test from "node:test";
import assert from "node:assert/strict";

import { renderWebhookCheck, summarizeWebhookChecks } from "../../lib/presentation/renderers/webhook.js";

test("renderer de webhook lista check, valor e URL esperada", () => {
  const output = renderWebhookCheck("Webhook", {
    ok: false,
    message: "ausente",
    value: "atual",
    expected_url: "https://expected.test",
  });

  assert.match(output, /Webhook/);
  assert.match(output, /Valor atual: atual/);
  assert.match(output, /URL esperada/);
});

test("sumariza diagnóstico sem configurar webhook automaticamente", () => {
  const output = summarizeWebhookChecks({
    backend_url_public: { ok: false },
    user_git_token: { ok: true },
    project_git_token: { ok: true },
    git_url_parseable: { ok: true },
  }, "7");

  assert.match(output, /Problemas encontrados/);
  assert.match(output, /BACKEND_URL/);
  assert.doesNotMatch(output, /Configurando webhook/);
});

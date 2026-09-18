import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSessionEvent } from "../../lib/domain/sessions/session-event.js";
import { createInteractiveSessionGateway } from "../../lib/application/gateways/interactive-session-gateway.js";

test("normaliza eventos SSE e WebSocket para o mesmo contrato", () => {
  assert.deepEqual(normalizeSessionEvent({ event: "output", data: { message: "ok" }, id: "4" }), {
    type: "output", message: "ok", id: 4,
  });
  assert.deepEqual(normalizeSessionEvent({ type: "prompt", prompt_id: "p1", text: "Email" }), {
    type: "prompt", prompt_id: "p1", text: "Email",
  });
});

test("gateway de sessão mantém operações e streams da API", async () => {
  const calls = [];
  const gateway = createInteractiveSessionGateway({
    createInteractiveSession: async (app, body) => { calls.push(["create", app, body]); return { session_id: "s1" }; },
    answerInteractiveSession: async (...args) => { calls.push(["answer", ...args]); },
    inputInteractiveSession: async (...args) => { calls.push(["input", ...args]); },
    cancelInteractiveSession: async (...args) => { calls.push(["cancel", ...args]); },
    streamInteractiveSessionEvents: async (...args) => { calls.push(["events", ...args]); },
    streamInteractiveTerminalEvents: async (...args) => { calls.push(["terminal", ...args]); },
  });

  await gateway.create(1, { command_kind: "x" });
  await gateway.answer(1, "s1", { prompt_id: "p", value: "x" });
  await gateway.input(1, "s1", { input: "x" });
  await gateway.cancel(1, "s1");
  await gateway.events(1, "s1", { afterEventId: 2 });
  await gateway.terminalEvents(1, "s1", { afterOutputId: 3 });
  assert.equal(calls.length, 6);
});

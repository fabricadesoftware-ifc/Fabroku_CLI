import test from "node:test";
import assert from "node:assert/strict";

import { createSseStream } from "../../lib/infrastructure/http/sse-stream.js";

function responseFromChunks(chunks, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader() {
        let index = 0;
        return {
          async read() {
            if (index === chunks.length) return { done: true };
            return { done: false, value: new TextEncoder().encode(chunks[index++]) };
          },
        };
      },
    },
    async json() { return { detail: "falhou" }; },
  };
}

test("entrega eventos SSE completos mesmo quando chegam em chunks", async () => {
  const events = [];
  const stream = createSseStream({
    fetchImpl: async () => responseFromChunks([
      "id: 1\nevent: status\ndata: {\"ok\":",
      "true}\n\nid: 2\ndata: fim\n\n",
    ]),
  });

  await stream("/events", {
    baseUrl: "https://api.test",
    headers: {},
    onEvent: (event) => events.push(event),
  });

  assert.deepEqual(events, [
    { id: "1", event: "status", data: { ok: true } },
    { id: "2", event: "message", data: "fim" },
  ]);
});

test("converte resposta SSE não-OK em APIError", async () => {
  await assert.rejects(
    () => createSseStream({ fetchImpl: async () => responseFromChunks([], 401) })(
      "/events",
      { baseUrl: "https://api.test", headers: {} },
    ),
    (error) => error.name === "APIError" && error.statusCode === 401,
  );
});

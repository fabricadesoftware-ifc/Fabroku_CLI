import test from "node:test";
import assert from "node:assert/strict";

import { HttpClient } from "../../lib/infrastructure/http/http-client.js";

test("HttpClient sends JSON requests with CLI authentication", async () => {
  let request;
  const client = new HttpClient({
    baseUrl: "https://api.example",
    token: "token-1",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await client.request("POST", "/api/apps/", { body: { name: "demo" } });

  assert.deepEqual(result, { ok: true });
  assert.equal(request.url, "https://api.example/api/apps/");
  assert.equal(request.options.headers.Authorization, "CLI token-1");
  assert.equal(request.options.headers["Content-Type"], "application/json");
  assert.equal(request.options.body, JSON.stringify({ name: "demo" }));
});

test("HttpClient converts non-success JSON responses to APIError", async () => {
  const client = new HttpClient({
    baseUrl: "https://api.example",
    fetchImpl: async () => new Response(JSON.stringify({ detail: "Denied" }), { status: 403 }),
  });

  await assert.rejects(
    () => client.request("GET", "/api/apps/"),
    (error) => error.name === "APIError" && error.statusCode === 403 && error.detail === "Denied",
  );
});

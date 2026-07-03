import test from "node:test";
import assert from "node:assert/strict";

import { FabrokuAPI, APIError, parseSSEEvent } from "../lib/api.js";

test("parseSSEEvent parses prompt payloads", () => {
  const event = parseSSEEvent(
    'id: 12\nevent: prompt\ndata: {"prompt_id":"email-1","text":"Email address: ","secret":false}\n',
  );

  assert.equal(event.id, "12");
  assert.equal(event.event, "prompt");
  assert.equal(event.data.prompt_id, "email-1");
  assert.equal(event.data.text, "Email address: ");
  assert.equal(event.data.secret, false);
});

test("parseSSEEvent ignores keep alive comments", () => {
  assert.equal(parseSSEEvent(": keep-alive"), null);
});

test("getPaginated follows API next links and merges results", async () => {
  const pages = {
    "/api/apps/apps/": {
      count: 3,
      next: "https://fabroku-api.example/api/apps/apps/?page=2",
      previous: null,
      results: [{ id: 1 }, { id: 2 }],
    },
    "/api/apps/apps/?page=2": {
      count: 3,
      next: null,
      previous: "https://fabroku-api.example/api/apps/apps/",
      results: [{ id: 3 }],
    },
  };

  const api = Object.create(FabrokuAPI.prototype);
  api.get = async (path) => pages[path];

  const data = await api.getPaginated("/api/apps/apps/");

  assert.equal(data.count, 3);
  assert.equal(data.next, null);
  assert.deepEqual(data.results.map((app) => app.id), [1, 2, 3]);
});

test("getPaginated protects against repeated next links", async () => {
  const api = Object.create(FabrokuAPI.prototype);
  api.get = async () => ({
    count: 1,
    next: "/api/apps/apps/",
    previous: null,
    results: [{ id: 1 }],
  });

  await assert.rejects(
    () => api.getPaginated("/api/apps/apps/"),
    (error) => error instanceof APIError && error.statusCode === 500,
  );
});

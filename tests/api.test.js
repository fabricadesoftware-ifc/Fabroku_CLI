import test from "node:test";
import assert from "node:assert/strict";

import { parseSSEEvent } from "../lib/api.js";

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

import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { createTerminalInputPump } from "../../lib/infrastructure/terminal/input-pump.js";

function createStdin() {
  const stdin = new EventEmitter();
  stdin.isTTY = true;
  stdin.isRaw = false;
  stdin.setEncoding = () => {};
  stdin.resume = () => {};
  stdin.pause = () => {};
  stdin.setRawMode = (value) => {
    stdin.isRaw = value;
  };
  return stdin;
}

test("terminal input pump batches input and flushes on a line ending", async () => {
  const stdin = createStdin();
  const received = [];
  const pump = createTerminalInputPump({
    stdin,
    sendInput: async (value) => received.push(value),
    flushDelayMs: 50,
  });

  pump.start(() => {});
  stdin.emit("data", "select");
  stdin.emit("data", " 1\n");
  await pump.stop();

  assert.deepEqual(received, ["select 1\n"]);
  assert.equal(stdin.isRaw, false);
});

test("terminal input pump invokes cancellation for Ctrl-C", async () => {
  const stdin = createStdin();
  let cancelled = 0;
  const pump = createTerminalInputPump({
    stdin,
    sendInput: async () => {},
    flushDelayMs: 0,
  });

  pump.start(() => {
    cancelled += 1;
  });
  stdin.emit("data", "\u0003");
  await pump.stop();

  assert.equal(cancelled, 1);
});

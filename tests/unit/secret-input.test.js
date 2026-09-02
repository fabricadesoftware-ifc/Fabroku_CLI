import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { readSecretInput } from "../../lib/infrastructure/terminal/secret-input.js";

test("lê entrada secreta sem eco e restaura o terminal", async () => {
  const stdin = new EventEmitter();
  stdin.isRaw = false;
  stdin.isTTY = true;
  stdin.setRawMode = (value) => { stdin.isRaw = value; };
  stdin.setEncoding = () => {};
  stdin.resume = () => {};
  stdin.pause = () => {};
  const output = { writes: [], write(value) { this.writes.push(value); } };

  const reading = readSecretInput({ stdin, stdout: output, prompt: "Senha: " });
  stdin.emit("data", "segredo");
  stdin.emit("data", "\n");

  assert.equal(await reading, "segredo");
  assert.equal(stdin.isRaw, false);
  assert.deepEqual(output.writes, ["Senha: ", "\n"]);
});

test("Ctrl-C cancela a entrada secreta", async () => {
  const stdin = new EventEmitter();
  stdin.isRaw = false;
  stdin.isTTY = true;
  stdin.setRawMode = (value) => { stdin.isRaw = value; };
  stdin.setEncoding = () => {};
  stdin.resume = () => {};
  stdin.pause = () => {};
  const output = { write() {} };

  const reading = readSecretInput({ stdin, stdout: output, prompt: "Senha: " });
  stdin.emit("data", "\u0003");

  await assert.rejects(reading, /USER_CANCELLED/);
  assert.equal(stdin.isRaw, false);
});

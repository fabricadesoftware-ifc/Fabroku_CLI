import test from "node:test";
import assert from "node:assert/strict";

import { parseLoginCallback, createLoginUrl } from "../../lib/domain/auth/login-callback.js";

test("parseLoginCallback extrai token, usuário e erro do callback", () => {
  assert.deepEqual(
    parseLoginCallback("/callback?token=abc&user=eduardo%40test&error=&message="),
    { token: "abc", user: "eduardo@test", error: "", message: "" },
  );
});

test("createLoginUrl preserva API URL e porta do callback", () => {
  assert.equal(
    createLoginUrl("https://api.test", 4321),
    "https://api.test/api/auth/cli/login/?port=4321",
  );
});

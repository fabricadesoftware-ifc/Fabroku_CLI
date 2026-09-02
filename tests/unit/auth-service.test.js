import test from "node:test";
import assert from "node:assert/strict";

import { createAuthService } from "../../lib/application/auth/auth-service.js";

function createStore(initial = {}) {
  let value = { api_url: "https://api.test", token: null, user: null, ...initial };
  return {
    load: () => ({ ...value }),
    save: (next) => { value = { ...next }; },
  };
}

test("AuthService persiste credenciais e monta sessão autenticada", () => {
  const store = createStore();
  const auth = createAuthService({ configStore: store, defaultApiUrl: "https://default.test" });

  auth.setCredentials("token-1", "eduardo", "https://custom.test");

  assert.equal(auth.isAuthenticated(), true);
  assert.deepEqual(auth.getSession(), {
    apiUrl: "https://custom.test",
    token: "token-1",
    user: "eduardo",
  });
});

test("AuthService encerra sessão sem apagar configurações não relacionadas", () => {
  const store = createStore({ theme: "dark", token: "token-1", user: "eduardo" });
  const auth = createAuthService({ configStore: store, defaultApiUrl: "https://default.test" });

  auth.clearCredentials();

  assert.equal(auth.isAuthenticated(), false);
  assert.deepEqual(store.load(), {
    api_url: "https://default.test",
    token: null,
    user: null,
    theme: "dark",
  });
});

test("AuthService whoAmI não acessa API sem autenticação", async () => {
  let called = false;
  const auth = createAuthService({
    configStore: createStore(),
    apiFactory: () => { called = true; },
  });

  await assert.rejects(() => auth.whoAmI(), (error) => error.kind === "authentication");
  assert.equal(called, false);
});

test("AuthService whoAmI consulta usuário e configuração da plataforma", async () => {
  const auth = createAuthService({
    configStore: createStore({ token: "token-1", user: "eduardo" }),
    apiFactory: () => ({
      getPlatformConfig: async () => ({ privileged_role_label: "Membro" }),
      getUserMe: async () => ({ email: "eduardo@test", is_fabric: true }),
    }),
  });

  assert.deepEqual(await auth.whoAmI(), {
    session: { apiUrl: "https://api.test", token: "token-1", user: "eduardo" },
    platform: { privileged_role_label: "Membro" },
    user: { email: "eduardo@test", is_fabric: true },
  });
});

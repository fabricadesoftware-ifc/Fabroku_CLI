/**
 * Comando `fabroku login` — Autenticação via GitHub OAuth.
 *
 * Abre o browser, recebe o token via servidor HTTP local.
 */

import chalk from "chalk";
import { createLoginUrl } from "../domain/auth/login-callback.js";
import { createBrowserLauncher } from "../infrastructure/auth/browser-launcher.js";
import { findFreePort, waitForOAuthCallback } from "../infrastructure/auth/oauth-callback-server.js";

import {
  getApiUrl,
} from "../config.js";
import { createCliServices } from "../application/composition/create-cli-services.js";

export async function login(options) {
  const auth = createCliServices().auth;
  if (auth.isAuthenticated()) {
    const readline = await import("node:readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await new Promise((resolve) => {
      rl.question(
        "Você já está autenticado. Deseja fazer login novamente? (s/N) ",
        resolve,
      );
    });
    rl.close();
    if (answer.toLowerCase() !== "s") return;
  }

  const baseUrl = options.apiUrl || getApiUrl();
  const port = await findFreePort();
  const loginUrl = createLoginUrl(baseUrl, port);

  console.log(`\n🔐 Abrindo browser para autenticação...`);
  console.log(`   URL: ${chalk.dim(loginUrl)}`);
  console.log(`   Aguardando callback na porta ${port}...\n`);

  // Abre o browser
  await createBrowserLauncher().open(loginUrl);
  const callback = await waitForOAuthCallback({ port });
  if (callback.token) {
    auth.setCredentials(callback.token, callback.user || "unknown", baseUrl);
    console.log(`✅ Autenticado como ${chalk.green.bold(callback.user)}`);
    console.log(`   Token salvo em ~/.fabroku/config.json\n`);
  } else if (callback.error === "timeout") {
    console.log(chalk.red("❌ Timeout: autenticação não foi concluída em 2 minutos."));
  } else {
    console.log(chalk.red(`❌ Erro: ${callback.error}: ${callback.message || "Erro desconhecido"}`));
  }
}

export function logout() {
  const auth = createCliServices().auth;
  if (!auth.isAuthenticated()) {
    console.log("Você não está autenticado.");
    return;
  }
  auth.clearCredentials();
  console.log("👋 Sessão encerrada com sucesso.");
}

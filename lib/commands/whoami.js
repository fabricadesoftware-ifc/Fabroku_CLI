/**
 * Comando `fabroku whoami` — Verificar usuário autenticado.
 */

import chalk from "chalk";

import { FabrokuAPI, APIError } from "../api.js";
import { isAuthenticated, loadConfig } from "../config.js";

const DEFAULT_PLATFORM_CONFIG = {
  privileged_role_label: "Membro da Fábrica",
};

export async function whoami() {
  if (!isAuthenticated()) {
    console.log(chalk.red("❌ Não autenticado."));
    console.log(`   Use: ${chalk.bold("fabroku login")}`);
    process.exit(1);
  }

  const config = loadConfig();
  console.log(`\n👤 Logado como: ${chalk.green.bold(config.user || "?")}`);
  console.log(`   API: ${chalk.dim(config.api_url)}`);

  try {
    const api = new FabrokuAPI();
    const platform = await api
      .getPlatformConfig()
      .catch(() => DEFAULT_PLATFORM_CONFIG);
    const user = await api.getUserMe();

    console.log(`   Email: ${user.email}`);
    if (user.is_fabric) console.log(`   🏭 ${platform.privileged_role_label}`);
    if (user.is_superuser) console.log("   🔑 Administrador");
    console.log(chalk.green("   ✅ Token válido\n"));
  } catch (e) {
    if (e instanceof APIError && e.statusCode === 401) {
      console.log(chalk.red("   ❌ Token expirado ou inválido\n"));
    } else {
      console.log(chalk.yellow(`   ⚠️  Erro ao verificar: ${e.message}\n`));
    }
  }
}

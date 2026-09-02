/**
 * Comando `fabroku whoami` — Verificar usuário autenticado.
 */

import chalk from "chalk";

import { APIError } from "../api.js";
import { createCliServices } from "../application/composition/create-cli-services.js";

export async function whoami() {
  const services = createCliServices();
  if (!services.auth.isAuthenticated()) {
    console.log(chalk.red("❌ Não autenticado."));
    console.log(`   Use: ${chalk.bold("fabroku login")}`);
    process.exit(1);
  }

  const session = services.auth.getSession();
  console.log(`\n👤 Logado como: ${chalk.green.bold(session.user || "?")}`);
  console.log(`   API: ${chalk.dim(session.apiUrl)}`);

  try {
    const { platform, user } = await services.auth.whoAmI();

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

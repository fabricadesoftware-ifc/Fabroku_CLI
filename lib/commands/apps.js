/**
 * Comando `fabroku apps` — Listar apps do usuário.
 */

import chalk from "chalk";

import { FabrokuAPI, APIError } from "../api.js";
import { isAuthenticated } from "../config.js";
import { renderAppsTable } from "../presentation/renderers/app-table.js";
import { createAppGateway } from "../application/gateways/app-gateway.js";

export async function apps(options) {
  if (!isAuthenticated()) {
    console.log(chalk.red("❌ Você precisa fazer login primeiro."));
    console.log(`   Use: ${chalk.bold("fabroku login")}`);
    process.exit(1);
  }

  const api = new FabrokuAPI();
  const appGateway = createAppGateway(api);

  let appList;
  try {
    const data = await appGateway.list();
    appList = data.results || [];
  } catch (e) {
    if (e instanceof APIError && e.statusCode === 401) {
      console.log(
        chalk.red("❌ Token expirado ou inválido. Faça login novamente."),
      );
      console.log(`   Use: ${chalk.bold("fabroku login")}`);
    } else {
      console.log(chalk.red(`❌ Erro na API: ${e.message}`));
    }
    process.exit(1);
  }

  // Filtra por projeto
  if (options.project) {
    appList = appList.filter(
      (a) => String(a.project) === String(options.project),
    );
  }

  if (appList.length === 0) {
    console.log("\nNenhum app encontrado.");
    if (options.project)
      console.log(`   (filtrado por projeto: ${options.project})`);
    return;
  }

  console.log(renderAppsTable(appList));
}

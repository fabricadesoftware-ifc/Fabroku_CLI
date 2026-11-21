/**
 * Comando `fabroku apps` — Listar apps do usuário.
 */

import chalk from "chalk";

import { FabrokuAPI, APIError } from "../api.js";
import { isAuthenticated } from "../config.js";
import { richUi } from "../ui.js";

const STATUS_COLORS = {
  RUNNING: "green",
  STOPPED: "red",
  ERROR: "red",
  STARTING: "yellow",
  DEPLOYING: "cyan",
  DELETING: "magenta",
  STOPPING: "yellow",
  RESTARTING: "blue",
};

export async function apps(options) {
  if (!isAuthenticated()) {
    console.log(chalk.red("❌ Você precisa fazer login primeiro."));
    console.log(`   Use: ${chalk.bold("fabroku login")}`);
    process.exit(1);
  }

  const api = new FabrokuAPI();

  let appList;
  try {
    const data = await api.listApps();
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

  const rich = await richUi();
  if (rich) {
    await rich.tui.renderApps(appList, rich.settings, options.project);
    return;
  }

  // Header
  console.log();
  console.log(
    chalk.dim("ID".padEnd(6)) +
      chalk.dim("Nome".padEnd(25)) +
      chalk.dim("Status".padEnd(14)) +
      chalk.dim("Domínio".padEnd(30)) +
      chalk.dim("Projeto"),
  );
  console.log(chalk.dim("─".repeat(85)));

  // Rows
  for (const app of appList) {
    const status = app.status || "STOPPED";
    const color = STATUS_COLORS[status] || "white";
    const statusText = status.charAt(0) + status.slice(1).toLowerCase();

    console.log(
      String(app.id || "").padEnd(6) +
        (app.name || "").padEnd(25) +
        chalk[color](statusText.padEnd(14)) +
        (app.domain || "-").padEnd(30) +
        String(app.project || ""),
    );
  }

  console.log(`\n📦 Total: ${appList.length} app(s)\n`);
}

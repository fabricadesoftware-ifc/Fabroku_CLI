#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "node:module";

import { login, logout } from "../lib/commands/login.js";
import { verify } from "../lib/commands/verify.js";
import { apps } from "../lib/commands/apps.js";
import { whoami } from "../lib/commands/whoami.js";
import { deploy } from "../lib/commands/deploy.js";
import { webhook } from "../lib/commands/webhook.js";
import { runCreatesuperuser, runDumpdata, runLoaddata, runMigrate } from "../lib/commands/run.js";
import { dbConnect } from "../lib/commands/db.js";
import { startMcpServer } from "../lib/mcp/server.js";
import { notifyIfUpdateAvailable } from "../lib/update-check.js";
import { registerCommands } from "../lib/presentation/cli/command-registry.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");
const program = new Command();

program
  .name("fabroku")
  .description("🚀 Fabroku CLI — Ferramenta de deploy para o Fabroku")
  .version(packageJson.version);

program.hook("preAction", async (_thisCommand, actionCommand) => {
  if (actionCommand.name() === "mcp") return;
  await notifyIfUpdateAvailable(packageJson.version);
});

registerCommands(program, {
  login,
  logout,
  verify,
  apps,
  deploy,
  whoami,
  webhook,
  runLoaddata,
  runMigrate,
  runDumpdata,
  runCreatesuperuser,
  dbConnect,
  startMcpServer: () => startMcpServer({ version: packageJson.version }),
});

try {
  await program.parseAsync();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

import test from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";

import { registerCommands } from "../../lib/presentation/cli/command-registry.js";

test("registro de comandos mantém os comandos públicos da CLI", () => {
  const program = new Command();
  registerCommands(program, {
    login() {}, logout() {}, verify() {}, apps() {}, deploy() {}, whoami() {},
    webhook() {}, runLoaddata() {}, runMigrate() {}, runDumpdata() {},
    runCreatesuperuser() {}, dbConnect() {}, startMcpServer() {},
  });

  const names = program.commands.map((command) => command.name());
  assert.deepEqual(names, ["login", "logout", "verify", "apps", "deploy", "whoami", "webhook", "run", "db", "mcp"]);
});

/**
 * Comando `fabroku verify` — Verifica arquivos necessários para deploy.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve as pathResolve } from "node:path";
import chalk from "chalk";

import {
  detectProjectType,
  verifyRequiredFiles,
} from "../domain/verification/project-verification.js";
import { renderVerification } from "../presentation/renderers/verification.js";

function createFileAccess(dir) {
  return {
    exists: (filename) => existsSync(join(dir, filename)),
    read: (filename) => readFileSync(join(dir, filename), "utf8"),
    write: (filename, content) => writeFileSync(join(dir, filename), content),
  };
}

export function verify(options = {}) {
  const dir = pathResolve(options.dir || ".");
  const forceType = options.type || null;
  const fix = options.fix || false;
  const quiet = options.quiet || false;
  const access = createFileAccess(dir);
  const log = quiet ? () => {} : console.log.bind(console);

  log(`\n📂 Verificando: ${chalk.bold(dir)}\n`);

  const type = forceType || detectProjectType(access);
  if (!type) {
    log(chalk.yellow("⚠️  Não foi possível detectar o tipo da aplicação."));
    log(`   Use ${chalk.bold("--type frontend")} ou ${chalk.bold("--type backend")}\n`);
    if (!quiet) process.exit(1);
    return 1;
  }

  const result = verifyRequiredFiles(type, {
    exists: access.exists,
    write: access.write,
    fix,
  });

  log(renderVerification({ dir, type, fix, result }));

  return result.remaining === 0 ? 0 : 1;
}

/**
 * Comando `fabroku deploy` — Dispara redeploy de um app.
 *
 * Fluxo:
 *   1. Detecta o git remote do diretório atual
 *   2. Busca o app correspondente na API (por URL do repo)
 *   3. Roda `verify` antes do deploy
 *   4. Dispara redeploy via API
 *   5. Acompanha progresso até concluir
 */

import chalk from "chalk";

import { FabrokuAPI, APIError } from "../api.js";
import { findAppByGitUrl, findAppByNameOrId, getGitBranch, getGitRemoteUrl } from "../app-resolver.js";
import { waitForTask } from "../application/tasks/wait-for-task.js";
import { createAppGateway } from "../application/gateways/app-gateway.js";
import { isAuthenticated } from "../config.js";
import { verify } from "./verify.js";
import { renderProgress } from "../presentation/renderers/progress.js";

export async function deploy(options) {
  // 1. Verifica autenticação
  if (!isAuthenticated()) {
    console.log(chalk.red("❌ Você precisa fazer login primeiro."));
    console.log(`   Use: ${chalk.bold("fabroku login")}`);
    process.exit(1);
  }

  const dir = options.dir || ".";
  const api = new FabrokuAPI();
  const appGateway = createAppGateway(api);

  // 2. Se --app foi passado, busca direto por nome
  let app;
  if (options.app) {
    try {
      const data = await appGateway.list();
      const apps = data.results || [];
      app = findAppByNameOrId(apps, options.app);
      if (!app) {
        console.log(chalk.red(`❌ App "${options.app}" não encontrado.`));
        console.log(
          `   Use ${chalk.bold("fabroku apps")} para listar seus apps.`,
        );
        process.exit(1);
      }
    } catch (e) {
      handleApiError(e);
    }
  } else {
    // 3. Detecta via git remote
    const gitUrl = getGitRemoteUrl(dir);
    if (!gitUrl) {
      console.log(
        chalk.red(
          "❌ Não foi possível detectar o repositório git neste diretório.",
        ),
      );
      console.log("   Certifique-se de estar na raiz de um repositório git,");
      console.log(
        `   ou use ${chalk.bold("fabroku deploy --app <nome>")} para especificar o app.`,
      );
      process.exit(1);
    }

    const branch = getGitBranch(dir);
    console.log(`\n📦 Repositório detectado: ${chalk.cyan(gitUrl)}`);
    if (branch) console.log(`   Branch: ${chalk.cyan(branch)}`);

    try {
      app = findAppByGitUrl((await appGateway.list()).results || [], gitUrl);
    } catch (e) {
      handleApiError(e);
    }

    if (!app) {
      console.log(
        chalk.red("\n❌ Nenhum app encontrado com este repositório."),
      );
      console.log(
        `   Use ${chalk.bold("fabroku apps")} para listar seus apps.`,
      );
      console.log(
        `   Ou crie um novo app no painel: ${chalk.dim("https://fabroku.fabricadesoftware.ifc.edu.br")}`,
      );
      process.exit(1);
    }
  }

  console.log(
    `\n🚀 App: ${chalk.bold(app.name)} (${chalk.dim(app.status || "unknown")})`,
  );

  // 4. Roda verify antes (a menos que --skip-verify)
  if (!options.skipVerify) {
    console.log(chalk.dim("\n── Verificação de arquivos ──"));
    const code = verify({ dir, quiet: true });
    if (code) {
      console.log(
        chalk.red(
          "\n❌ Verificação falhou. Corrija os problemas antes do deploy.",
        ),
      );
      console.log(
        `   Use ${chalk.bold("fabroku verify --fix")} para gerar os arquivos faltantes.`,
      );
      process.exit(1);
    }
    console.log(chalk.green("   ✓ Arquivos de deploy OK\n"));
  }

  // 5. Dispara redeploy
  console.log(chalk.dim("── Deploy ──"));
  console.log(`   Disparando redeploy de ${chalk.bold(app.name)}...`);

  let result;
  try {
    result = await appGateway.redeploy(app.id);
  } catch (e) {
    if (e instanceof APIError) {
      if (e.statusCode === 409) {
        console.log(chalk.yellow(`\n⚠️  ${e.detail}`));
        process.exit(1);
      }
      if (e.statusCode === 400) {
        console.log(chalk.red(`\n❌ ${e.detail}`));
        process.exit(1);
      }
    }
    handleApiError(e);
  }

  const taskId = result.task_id;
  console.log(
    `   Deploy iniciado! ${chalk.dim(`(task: ${taskId.slice(0, 8)}...)`)}`,
  );

  // 6. Acompanha progresso (a menos que --no-wait)
  if (options.noWait) {
    console.log(
      `\n   Acompanhe o progresso no painel ou com: ${chalk.bold(`fabroku status --app ${app.name}`)}`,
    );
    return;
  }

  console.log(chalk.dim("   Acompanhando progresso...\n"));
  let deployResult;
  try {
    deployResult = await waitForTask({
      getStatus: () => appGateway.status(app.id),
      taskId,
      pollIntervalMs: 3000,
      maxPolls: 120,
      onStatus: ({ current = 0, status = "" }) => {
        process.stdout.clearLine?.(0);
        process.stdout.cursorTo?.(0);
        process.stdout.write(`   ${renderProgress({ current, status })}`);
      },
    });
  } catch (error) {
    deployResult = { success: false, status: { status: error.message } };
  }

  process.stdout.clearLine?.(0);
  process.stdout.cursorTo?.(0);
  process.stdout.write(`${deployResult.success ? `   ${renderProgress({ current: 100 })}\n` : "\n"}`);

  if (deployResult.success) {
    console.log(chalk.green.bold("\n✅ Deploy concluído com sucesso!"));
    if (app.domain) {
      console.log(`   🌐 ${chalk.cyan(`https://${app.domain}`)}`);
    }
  } else {
    console.log(
      chalk.red(
        `\n❌ Deploy falhou: ${deployResult.status?.status || "erro desconhecido"}`,
      ),
    );
    process.exit(1);
  }
}

function handleApiError(e) {
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

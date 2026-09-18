/**
 * Comando: fabroku webhook
 * Diagnostica e configura webhooks do GitHub para commit status.
 */

import chalk from "chalk";
import { FabrokuAPI } from "../api.js";
import { renderWebhookCheck, summarizeWebhookChecks } from "../presentation/renderers/webhook.js";

function check(label, result) {
  console.log(renderWebhookCheck(label, result));
}

export async function webhook(appId, options = {}, api = new FabrokuAPI()) {

  if (!appId) {
    // Listar apps para o usuário escolher
    console.log(chalk.cyan("Buscando apps..."));
    try {
      const data = await api.listApps();
      const apps = data.results || data;
      if (!apps.length) {
        console.log(chalk.yellow("Nenhum app encontrado."));
        return;
      }
      console.log(chalk.bold("\nSeus apps:"));
      for (const app of apps) {
        console.log(
          `  ${chalk.cyan(app.id)} - ${app.name} (${app.git || "sem git"})`,
        );
      }
      console.log(
        chalk.dim("\nUse: fabroku webhook <app_id>  para diagnosticar"),
      );
      return;
    } catch (err) {
      console.error(chalk.red(`Erro: ${err.message}`));
      process.exit(1);
    }
  }

  // Diagnóstico
  console.log(chalk.cyan.bold(`\n🔍 Diagnóstico do webhook — App #${appId}\n`));

  try {
    const diag = await api.diagnoseWebhook(appId);

    console.log(
      chalk.bold("App:"),
      `${diag.app.name} (${diag.app.git || "N/A"})`,
    );
    console.log(chalk.bold("Branch:"), diag.app.branch);
    console.log(chalk.bold("Webhook URL:"), diag.webhook_url);
    console.log();

    const checks = diag.checks;
    check("BACKEND_URL público", checks.backend_url_public);
    check("Seu git_token", checks.user_git_token);
    check("Token do projeto", checks.project_git_token);
    check("URL Git parseável", checks.git_url_parseable);

    if (checks.webhook_exists) {
      check("Webhook no GitHub", checks.webhook_exists);
    }
    if (checks.last_commit) {
      check("Último commit", checks.last_commit);
      if (checks.last_commit.sha) {
        console.log(`    ${chalk.dim("SHA:")} ${checks.last_commit.sha}`);
      }
    }

    // Resumo e ações sugeridas
    console.log();
    console.log(summarizeWebhookChecks(checks, appId));
    // Se --setup foi passado
    if (options.setup) {
      console.log();
      await setupWebhook(api, appId);
    }

    // Se --test foi passado
    if (options.test) {
      console.log();
      await testStatus(api, appId);
    }
  } catch (err) {
    console.error(chalk.red(`Erro: ${err.message}`));
    process.exit(1);
  }
}

async function setupWebhook(api, appId) {
  console.log(chalk.cyan("Configurando webhook..."));
  try {
    const result = await api.setupWebhook(appId);
    if (result.status === "webhook atualizado") {
      console.log(chalk.green.bold("Webhook reparado e atualizado com sucesso!"));
      console.log(chalk.dim(`  URL: ${result.webhook_url}`));
      console.log(chalk.dim(`  Hook ID: ${result.hook_id}`));
      return;
    }
    if (result.status === "webhook ja existe") {
      console.log(chalk.green("Webhook ja esta configurado."));
      console.log(chalk.dim(`  Hook ID: ${result.hook_id}`));
      return;
    }
    if (result.status === "webhook criado") {
      console.log(chalk.green.bold("✓ Webhook criado com sucesso!"));
      console.log(chalk.dim(`  URL: ${result.webhook_url}`));
      console.log(chalk.dim(`  Hook ID: ${result.hook_id}`));
    } else if (result.status === "webhook já existe") {
      console.log(chalk.green("✓ Webhook já está configurado."));
      console.log(chalk.dim(`  Hook ID: ${result.hook_id}`));
    } else {
      console.log(chalk.yellow(`Status: ${result.status}`));
    }
  } catch (err) {
    console.error(chalk.red(`Erro ao criar webhook: ${err.message}`));
  }
}

async function testStatus(api, appId) {
  console.log(chalk.cyan.bold("🧪 Testando commit status...\n"));
  try {
    const r = await api.testCommitStatus(appId);

    console.log(chalk.dim(`  Repo: ${r.repo_name}`));
    console.log(chalk.dim(`  Token: ${r.token_preview}`));
    console.log();

    if (r.repo_access) {
      check("Acesso ao repo", r.repo_access);
      if (!r.repo_access.ok) {
        console.log(chalk.red(`\n  Erro: ${r.repo_access.error}`));
        return;
      }
    }
    if (r.branch_access) {
      check("Acesso à branch", r.branch_access);
      if (r.branch_access.sha) {
        console.log(chalk.dim(`    SHA: ${r.branch_access.sha}`));
      }
      if (!r.branch_access.ok) {
        console.log(chalk.red(`\n  Erro: ${r.branch_access.error}`));
        return;
      }
    }
    if (r.create_status) {
      check("Criar commit status", r.create_status);
      if (r.create_status.ok) {
        console.log(
          chalk.green.bold(
            "\n  ✓ Commit status funciona! A bolinha apareceu no GitHub.",
          ),
        );
        console.log(
          chalk.dim(
            "  (Status de teste foi criado como 'success' para limpar)",
          ),
        );
      } else {
        console.log(chalk.red(`\n  Erro: ${r.create_status.error}`));
        if (r.create_status.message) {
          console.log(chalk.yellow(`  ${r.create_status.message}`));
        }
      }
    }
    if (r.unexpected_error) {
      console.log(chalk.red(`\n  Erro inesperado: ${r.unexpected_error}`));
    }
  } catch (err) {
    console.error(chalk.red(`Erro: ${err.message}`));
  }
}

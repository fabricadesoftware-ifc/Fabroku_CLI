import chalk from "chalk";

export function renderWebhookCheck(label, result) {
  const icon = result.ok ? chalk.green("✓") : chalk.red("✗");
  const lines = [`  ${icon} ${chalk.bold(label)}: ${result.message || ""}`];
  if (!result.ok && result.value) lines.push(`    ${chalk.dim("Valor atual:")} ${result.value}`);
  if (result.expected_url) lines.push(`    ${chalk.dim("URL esperada:")} ${result.expected_url}`);
  if (result.all_hooks?.length) {
    lines.push(`    ${chalk.dim("Webhooks no repo:")}`);
    for (const hook of result.all_hooks) lines.push(`      - ID ${hook.id}: ${hook.url}`);
  }
  if (result.fabroku_statuses?.length) {
    lines.push(`    ${chalk.dim("Últimos status fabroku/deploy:")}`);
    for (const status of result.fabroku_statuses) lines.push(`      - ${status.state} ${status.description} (${status.created_at})`);
  }
  return lines.join("\n");
}

export function summarizeWebhookChecks(checks, appId) {
  if (Object.values(checks).every((check) => check.ok)) return `${chalk.green.bold("✓ Tudo parece OK!")} Se o status ainda não aparece, verifique os logs do Celery no servidor.`;
  const lines = [chalk.yellow.bold("⚠ Problemas encontrados:")];
  if (!checks.backend_url_public?.ok) lines.push(chalk.yellow("  → BACKEND_URL está como localhost. Defina a variável de ambiente BACKEND_URL com a URL pública do backend."));
  if (!checks.user_git_token?.ok) lines.push(chalk.yellow("  → Faça login novamente no Fabroku para obter um token GitHub válido."));
  if (!checks.project_git_token?.ok) lines.push(chalk.yellow("  → Nenhum usuário do projeto tem token GitHub. Pelo menos 1 membro precisa fazer login."));
  if (checks.webhook_exists && !checks.webhook_exists.ok) lines.push(chalk.yellow(`  → Webhook ausente ou não verificável. Para tentar criar ou reparar, execute: fabroku webhook ${appId} --setup`));
  if (checks.last_commit && !checks.last_commit.ok && checks.last_commit.message) lines.push(chalk.yellow(`  → ${checks.last_commit.message}`));
  return lines.join("\n");
}

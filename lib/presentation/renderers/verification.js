import chalk from "chalk";

export function renderVerification({ dir, type, fix, result }) {
  const typeName = type === "frontend" ? "FrontEnd" : "BackEnd";
  const typeDesc = type === "frontend"
    ? "Aplicação SPA/estática (Vue, React, etc.)"
    : "Aplicação Python (Django, Flask, etc.)";
  const lines = [
    `\n📂 Verificando: ${chalk.bold(dir)}\n`,
    `🔍 Tipo detectado: ${chalk.cyan.bold(typeName)}`,
    `   ${typeDesc}\n`,
  ];

  for (const file of result.files) {
    if (file.present) lines.push(`  ${chalk.green("✅")} ${file.filename}`);
    else {
      lines.push(`  ${chalk.red("❌")} ${file.filename} — ${chalk.dim("faltando")}`);
      if (fix && file.info.content !== null) lines.push(`     ${chalk.yellow("→")} Gerado com conteúdo padrão`);
    }
  }

  lines.push("");
  if (result.missing === 0) lines.push(chalk.green("🚀 Projeto pronto para deploy!\n"));
  else if (fix && result.fixed > 0) {
    lines.push(chalk.yellow(`🔧 ${result.fixed} arquivo(s) gerado(s).`));
    if (result.remaining > 0) lines.push(chalk.red(`   ${result.remaining} arquivo(s) precisam ser criados manualmente.`));
    else lines.push(chalk.green("🚀 Projeto pronto para deploy!\n"));
  } else {
    lines.push(chalk.yellow(`⚠️  ${result.missing} arquivo(s) faltando para deploy.`));
    lines.push(`   Use ${chalk.bold("fabroku verify --fix")} para gerar automaticamente.\n`);
  }
  return lines.join("\n");
}

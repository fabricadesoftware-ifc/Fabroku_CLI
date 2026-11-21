/**
 * Comando `fabroku config` — tema e opções de interface da CLI.
 *
 *   fabroku config                  tela interativa (com prévia do tema)
 *   fabroku config list             mostra as opções atuais
 *   fabroku config get <chave>
 *   fabroku config set <chave> <valor>
 *   fabroku config temas            lista os temas
 *   fabroku config reset            volta ao padrão
 */
import chalk from "chalk";

import { DEFAULT_UI, getUiSettings, loadTui, saveUiSettings, UI_KEYS } from "../ui.js";

const VALORES = {
  interface: ["auto", "rica", "simples"],
  unicode: ["auto", "sim", "nao"],
  animacoes: ["true", "false"],
};

function mostrar(settings) {
  for (const [chave, desc] of Object.entries(UI_KEYS)) {
    console.log(`  ${chalk.bold(chave.padEnd(10))} ${String(settings[chave]).padEnd(12)} ${chalk.dim(desc)}`);
  }
}

async function temasDisponiveis() {
  const tui = await loadTui();
  return tui ? tui.themeNames() : null;
}

function falhar(msg) {
  console.log(chalk.red(`❌ ${msg}`));
  process.exitCode = 1;
}

export async function config(acao, chave, valor) {
  const atual = getUiSettings();

  if (!acao) {
    const tui = await loadTui();
    if (!tui || !process.stdout.isTTY || !process.stdin.isTTY) {
      console.log(chalk.bold("\nConfigurações da CLI\n"));
      mostrar(atual);
      console.log(`\n  Mude com ${chalk.bold("fabroku config set <chave> <valor>")}`);
      if (!tui) console.log(chalk.dim("  (a tela interativa precisa do Node 20 ou mais novo)"));
      console.log();
      return;
    }
    const novo = await tui.runConfigUi(atual);
    if (novo) {
      saveUiSettings(novo);
      console.log(chalk.green(`✅ Configurações salvas (tema ${novo.tema}).`));
    } else {
      console.log(chalk.dim("Nada mudou."));
    }
    return;
  }

  switch (acao) {
    case "list":
      console.log();
      mostrar(atual);
      console.log();
      return;

    case "get":
      if (!(chave in UI_KEYS)) return falhar(`Chave desconhecida: ${chave}. Use: ${Object.keys(UI_KEYS).join(", ")}`);
      console.log(String(atual[chave]));
      return;

    case "set": {
      if (!(chave in UI_KEYS)) return falhar(`Chave desconhecida: ${chave}. Use: ${Object.keys(UI_KEYS).join(", ")}`);
      if (valor === undefined) return falhar(`Falta o valor. Ex.: fabroku config set ${chave} ${VALORES[chave]?.[0] ?? "fabroku"}`);
      if (chave === "tema") {
        const temas = await temasDisponiveis();
        if (temas && !temas.includes(valor)) return falhar(`Tema "${valor}" não existe. Veja: fabroku config temas`);
      } else if (!VALORES[chave].includes(valor)) {
        return falhar(`Valor inválido para ${chave}: ${valor}. Use: ${VALORES[chave].join(" | ")}`);
      }
      saveUiSettings({ ...atual, [chave]: chave === "animacoes" ? valor === "true" : valor });
      console.log(chalk.green(`✅ ${chave} = ${valor}`));
      return;
    }

    case "temas": {
      const temas = await temasDisponiveis();
      if (!temas) return falhar("Os temas precisam do Node 20 ou mais novo.");
      for (const t of temas) console.log(`${t === atual.tema ? chalk.green("●") : " "} ${t}`);
      return;
    }

    case "reset":
      saveUiSettings(DEFAULT_UI);
      console.log(chalk.green("✅ Configurações de interface voltaram ao padrão."));
      return;

    default:
      falhar(`Ação desconhecida: ${acao}. Use: list, get, set, temas, reset`);
  }
}

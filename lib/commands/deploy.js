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

import { execSync } from "node:child_process";
import chalk from "chalk";

import { FabrokuAPI, APIError } from "../api.js";
import { isAuthenticated } from "../config.js";
import { richUi } from "../ui.js";
import { verify } from "./verify.js";

/**
 * Normaliza URL do git para comparação.
 * Remove .git, protocolo, trailing slashes.
 */
function normalizeGitUrl(url) {
  return url
    .replace(/\.git$/, "")
    .replace(/\/$/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^git@github\.com:/, "github.com/")
    .toLowerCase();
}

/**
 * Obtém o remote URL do repositório git no diretório atual.
 */
function getGitRemoteUrl(dir) {
  try {
    const url = execSync("git remote get-url origin", {
      cwd: dir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return url;
  } catch {
    return null;
  }
}

/**
 * Obtém a branch atual do repositório git.
 */
function getGitBranch(dir) {
  try {
    return execSync("git branch --show-current", {
      cwd: dir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Busca o app que corresponde ao remote URL do diretório.
 */
async function findAppByGitUrl(api, gitUrl) {
  const data = await api.listApps();
  const apps = data.results || [];
  const normalizedLocal = normalizeGitUrl(gitUrl);

  return apps.find((app) => normalizeGitUrl(app.git) === normalizedLocal);
}


/**
 * Acompanha o progresso do deploy via polling. `onProgress(percent, mensagem)`
 * é chamado quando algo muda; quem desenha é o repórter.
 */
async function pollDeployStatus(api, appId, onProgress) {
  const MAX_POLLS = 200; // ~10 min
  const INTERVAL = 3000;

  let lastProgress = -1;
  let lastStatus = "";

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, INTERVAL));

    let data;
    try {
      data = await api.getAppStatus(appId);
    } catch {
      continue; // ignora erros transitórios
    }

    const state = data.state;
    const progress = data.current || 0;
    const statusMsg = data.status || "";

    if (progress !== lastProgress || statusMsg !== lastStatus) {
      onProgress(progress, statusMsg);
      lastProgress = progress;
      lastStatus = statusMsg;
    }

    if (state === "SUCCESS") return { success: true };
    if (state === "FAILURE") return { success: false, error: statusMsg || data.status };
  }

  return { success: false, error: "Timeout — deploy demorou mais de 10 minutos" };
}

function progressBar(percent) {
  const width = 20;
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const bar = chalk.green("█".repeat(filled)) + chalk.dim("░".repeat(empty));
  return `[${bar}] ${String(percent).padStart(3)}%`;
}

// ---------------------------------------------------------------- repórteres

/** Saída de texto (pipes, CI, IA, `interface: simples`). */
function textReporter() {
  return {
    repo(gitUrl, branch) {
      console.log(`\n📦 Repositório detectado: ${chalk.cyan(gitUrl)}`);
      if (branch) console.log(`   Branch: ${chalk.cyan(branch)}`);
    },
    app(app) {
      console.log(`\n🚀 App: ${chalk.bold(app.name)} (${chalk.dim(app.status || "unknown")})`);
    },
    verifyStart() {
      console.log(chalk.dim("\n── Verificação de arquivos ──"));
    },
    verifyOk() {
      console.log(chalk.green("   ✓ Arquivos de deploy OK\n"));
    },
    verifySkipped() {},
    triggerStart(app) {
      console.log(chalk.dim("── Deploy ──"));
      console.log(`   Disparando redeploy de ${chalk.bold(app.name)}...`);
    },
    triggered(taskId) {
      console.log(`   Deploy iniciado! ${chalk.dim(`(task: ${taskId.slice(0, 8)}...)`)}`);
    },
    waiting() {
      console.log(chalk.dim("   Acompanhando progresso...\n"));
    },
    progress(percent, message) {
      const truncated = message.length > 50 ? message.slice(0, 50) + "…" : message;
      if (process.stdout.isTTY) {
        process.stdout.clearLine?.(0);
        process.stdout.cursorTo?.(0);
        process.stdout.write(`   ${progressBar(percent)} ${chalk.dim(truncated)}`);
      } else {
        // Sem terminal não dá para reescrever a linha: uma linha por mudança.
        console.log(`   ${percent}% ${truncated}`);
      }
    },
    async noWait() {
      console.log(`\n   Acompanhe o progresso no painel ou com: ${chalk.bold("fabroku apps")}`);
    },
    async success(app) {
      if (process.stdout.isTTY) {
        process.stdout.clearLine?.(0);
        process.stdout.cursorTo?.(0);
        process.stdout.write(`   ${progressBar(100)}\n`);
      }
      console.log(chalk.green.bold("\n✅ Deploy concluído com sucesso!"));
      if (app.domain) console.log(`   🌐 ${chalk.cyan(`https://${app.domain}`)}`);
    },
    async fail(message, hints = [], { warning = false } = {}) {
      if (process.stdout.isTTY) process.stdout.write("\n");
      console.log((warning ? chalk.yellow : chalk.red)(`\n${warning ? "⚠️ " : "❌"} ${message}`));
      for (const hint of hints) console.log(`   ${hint}`);
    },
  };
}

/** Interface rica (Ink + termcn): etapas com spinner, barra de progresso e resultado. */
function richReporter(tui, settings, { skipVerify }) {
  const view = tui.startDeployView(settings, [
    { id: "app", label: "Localizar o app" },
    { id: "verify", label: "Verificar arquivos de deploy" },
    { id: "trigger", label: "Disparar o deploy" },
    { id: "build", label: "Build e publicação" },
  ]);
  let atual = "app";
  const ir = (id, detail) => {
    atual = id;
    view.step(id, "rodando", detail);
  };
  const semCor = (s) => s.replace(/\x1B\[[0-9;]*m/g, "");
  ir("app");

  return {
    repo(gitUrl, branch) {
      view.header({ repo: gitUrl, branch: branch || undefined });
    },
    app(app) {
      view.header({ app: `${app.name} (${String(app.status || "?").toLowerCase()})` });
      view.step("app", "ok", app.name);
      if (skipVerify) view.step("verify", "pulado", "--skip-verify");
    },
    verifyStart() {
      ir("verify");
    },
    verifyOk() {
      view.step("verify", "ok");
    },
    verifySkipped() {},
    triggerStart() {
      ir("trigger");
    },
    triggered(taskId) {
      view.step("trigger", "ok", `task ${taskId.slice(0, 8)}`);
    },
    waiting() {
      ir("build");
      view.progress(0, "Na fila...");
    },
    progress(percent, message) {
      view.progress(percent, message);
    },
    async noWait(app) {
      view.step("build", "pulado", "--no-wait");
      await view.finish({
        ok: true,
        title: "Deploy disparado",
        message: `Acompanhe no painel ou com: fabroku apps${app?.domain ? "" : ""}`,
      });
    },
    async success(app) {
      view.step("build", "ok");
      await view.finish({
        ok: true,
        title: "Deploy concluído",
        url: app.domain ? `https://${app.domain}` : undefined,
      });
    },
    async fail(message, hints = []) {
      view.step(atual, "erro");
      await view.finish({ ok: false, title: semCor(message), message: hints.map(semCor).join("\n") });
    },
  };
}

// ---------------------------------------------------------------- comando

export async function deploy(options) {
  if (!isAuthenticated()) {
    console.log(chalk.red("❌ Você precisa fazer login primeiro."));
    console.log(`   Use: ${chalk.bold("fabroku login")}`);
    process.exit(1);
  }

  const dir = options.dir || ".";
  const api = new FabrokuAPI();
  const rich = await richUi();
  const out = rich
    ? richReporter(rich.tui, rich.settings, { skipVerify: Boolean(options.skipVerify) })
    : textReporter();

  const falhar = async (message, hints, extra) => {
    await out.fail(message, hints, extra);
    process.exit(1);
  };
  const falhaApi = async (e) => {
    if (e instanceof APIError && e.statusCode === 401) {
      await falhar("Token expirado ou inválido. Faça login novamente.", [`Use: ${chalk.bold("fabroku login")}`]);
    }
    await falhar(`Erro na API: ${e.message}`);
  };

  // 1. Encontra o app: por --app ou pelo git remote do diretório
  let app;
  if (options.app) {
    try {
      const data = await api.listApps();
      app = (data.results || []).find(
        (a) => a.name === options.app || String(a.id) === String(options.app),
      );
    } catch (e) {
      await falhaApi(e);
    }
    if (!app) {
      await falhar(`App "${options.app}" não encontrado.`, [`Use ${chalk.bold("fabroku apps")} para listar seus apps.`]);
    }
  } else {
    const gitUrl = getGitRemoteUrl(dir);
    if (!gitUrl) {
      await falhar("Não foi possível detectar o repositório git neste diretório.", [
        "Certifique-se de estar na raiz de um repositório git,",
        `ou use ${chalk.bold("fabroku deploy --app <nome>")} para especificar o app.`,
      ]);
    }
    out.repo(gitUrl, getGitBranch(dir));
    try {
      app = await findAppByGitUrl(api, gitUrl);
    } catch (e) {
      await falhaApi(e);
    }
    if (!app) {
      await falhar("Nenhum app encontrado com este repositório.", [
        `Use ${chalk.bold("fabroku apps")} para listar seus apps.`,
        `Ou crie um novo app no painel: ${chalk.dim("https://fabroku.fabricadesoftware.ifc.edu.br")}`,
      ]);
    }
  }
  out.app(app);

  // 2. Verifica os arquivos de deploy (a menos que --skip-verify)
  if (!options.skipVerify) {
    out.verifyStart();
    const code = verify({ dir, quiet: true });
    if (code) {
      await falhar("Verificação falhou. Corrija os problemas antes do deploy.", [
        `Use ${chalk.bold("fabroku verify --fix")} para gerar os arquivos faltantes.`,
      ]);
    }
    out.verifyOk();
  } else {
    out.verifySkipped();
  }

  // 3. Dispara o redeploy
  out.triggerStart(app);
  let result;
  try {
    result = await api.redeployApp(app.id);
  } catch (e) {
    if (e instanceof APIError && e.statusCode === 409) await falhar(e.detail, [], { warning: true });
    if (e instanceof APIError && e.statusCode === 400) await falhar(e.detail);
    await falhaApi(e);
  }
  out.triggered(result.task_id);

  // 4. Acompanha o progresso (a menos que --no-wait).
  // O commander guarda --no-wait como `options.wait === false`, não como `noWait`.
  if (options.wait === false) {
    await out.noWait(app);
    return;
  }

  out.waiting();
  const deployResult = await pollDeployStatus(api, app.id, (p, m) => out.progress(p, m));
  if (deployResult.success) {
    await out.success(app);
  } else {
    await falhar(`Deploy falhou: ${deployResult.error || "erro desconhecido"}`);
  }
}

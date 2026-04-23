/**
 * Comandos `fabroku run` para rotinas Django com artefatos locais.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import chalk from "chalk";

import { findAppByGitUrl, findAppByNameOrId, getGitBranch, getGitRemoteUrl } from "../app-resolver.js";
import { FabrokuAPI, APIError } from "../api.js";
import { isAuthenticated } from "../config.js";

const MAX_ARTIFACT_BYTES = 50 * 1024 * 1024;

function ensureAuthenticated() {
  if (!isAuthenticated()) {
    console.log(chalk.red("Voce precisa fazer login primeiro."));
    console.log(`   Use: ${chalk.bold("fabroku login")}`);
    process.exit(1);
  }
}

function handleApiError(error) {
  if (error instanceof APIError && error.statusCode === 401) {
    console.log(chalk.red("Token expirado ou invalido. Faca login novamente."));
    console.log(`   Use: ${chalk.bold("fabroku login")}`);
  } else {
    console.log(chalk.red(`Erro na API: ${error.message}`));
  }
  process.exit(1);
}

function ensureDjangoFlag(options) {
  if (!options.django) {
    console.log(chalk.red("Este comando exige a flag --django nesta versao."));
    process.exit(1);
  }
}

function resolveFixturePath(inputPath, dir) {
  const fromCwd = resolve(inputPath);
  if (existsSync(fromCwd)) return fromCwd;

  const fromDir = resolve(dir || ".", inputPath);
  if (existsSync(fromDir)) return fromDir;

  return fromCwd;
}

function validateJsonFile(filePath) {
  if (!existsSync(filePath)) {
    console.log(chalk.red(`Arquivo nao encontrado: ${filePath}`));
    process.exit(1);
  }

  const stats = statSync(filePath);
  if (!stats.isFile()) {
    console.log(chalk.red(`O caminho informado nao e um arquivo: ${filePath}`));
    process.exit(1);
  }
  if (!filePath.toLowerCase().endsWith(".json")) {
    console.log(chalk.red("O arquivo precisa ter extensao .json."));
    process.exit(1);
  }
  if (stats.size > MAX_ARTIFACT_BYTES) {
    console.log(chalk.red(`Arquivo excede o limite de ${MAX_ARTIFACT_BYTES} bytes.`));
    process.exit(1);
  }
}

function validateOutputPath(outputPath) {
  if (!outputPath) {
    console.log(chalk.red("Informe --output <arquivo.json> para salvar o dump."));
    process.exit(1);
  }
  if (!outputPath.toLowerCase().endsWith(".json")) {
    console.log(chalk.red("O output precisa ter extensao .json."));
    process.exit(1);
  }
}

async function resolveTargetApp(api, options) {
  let data;
  try {
    data = await api.listApps();
  } catch (error) {
    handleApiError(error);
  }

  const apps = data.results || [];
  if (options.app) {
    const app = findAppByNameOrId(apps, options.app);
    if (!app) {
      console.log(chalk.red(`App "${options.app}" nao encontrado.`));
      console.log(`   Use ${chalk.bold("fabroku apps")} para listar seus apps.`);
      process.exit(1);
    }
    return app;
  }

  const dir = options.dir || ".";
  const gitUrl = getGitRemoteUrl(dir);
  if (!gitUrl) {
    console.log(chalk.red("Nao foi possivel detectar o git remote neste diretorio."));
    console.log(`   Use ${chalk.bold("fabroku run ... --app <nome-ou-id>")} para especificar o app.`);
    process.exit(1);
  }

  const branch = getGitBranch(dir);
  console.log(`Repositorio detectado: ${chalk.cyan(gitUrl)}`);
  if (branch) console.log(`Branch: ${chalk.cyan(branch)}`);

  const app = findAppByGitUrl(apps, gitUrl);
  if (!app) {
    console.log(chalk.red("Nenhum app encontrado com este repositorio."));
    console.log(`   Use ${chalk.bold("fabroku apps")} para listar seus apps.`);
    console.log(`   Ou informe ${chalk.bold("--app <nome-ou-id>")}.`);
    process.exit(1);
  }
  return app;
}

async function pollRunStatus(api, appId) {
  const maxPolls = 240;
  const intervalMs = 3000;
  let lastStatus = "";

  for (let index = 0; index < maxPolls; index += 1) {
    await new Promise((resolvePoll) => setTimeout(resolvePoll, intervalMs));

    let data;
    try {
      data = await api.getAppStatus(appId);
    } catch {
      continue;
    }

    const state = data.state;
    const statusMessage = data.status || "";
    if (statusMessage && statusMessage !== lastStatus) {
      console.log(`   ${chalk.dim(statusMessage)}`);
      lastStatus = statusMessage;
    }

    if (state === "SUCCESS") return { success: true, data };
    if (state === "FAILURE") return { success: false, error: statusMessage || "erro desconhecido", data };
  }

  return { success: false, error: "Timeout: comando demorou mais de 12 minutos" };
}

export async function runLoaddata(fixturePath, options) {
  ensureAuthenticated();
  ensureDjangoFlag(options);

  const dir = options.dir || ".";
  const localFixturePath = resolveFixturePath(fixturePath, dir);
  validateJsonFile(localFixturePath);

  const api = new FabrokuAPI();
  const app = await resolveTargetApp(api, options);
  const content = readFileSync(localFixturePath);

  const formData = new FormData();
  formData.append("fixture", new Blob([content], { type: "application/json" }), basename(localFixturePath));
  formData.append("manage_path", options.manage || "manage.py");

  console.log(`App: ${chalk.bold(app.name)}`);
  console.log(`Enviando fixture: ${chalk.cyan(localFixturePath)}`);

  try {
    await api.runLoaddata(app.id, formData);
  } catch (error) {
    handleApiError(error);
  }

  console.log(chalk.dim("Acompanhando loaddata..."));
  const result = await pollRunStatus(api, app.id);
  if (!result.success) {
    console.log(chalk.red(`loaddata falhou: ${result.error}`));
    process.exit(1);
  }

  console.log(chalk.green("loaddata executado com sucesso."));
}

export async function runDumpdata(options, dumpArgs = []) {
  ensureAuthenticated();
  ensureDjangoFlag(options);
  validateOutputPath(options.output);

  const api = new FabrokuAPI();
  const app = await resolveTargetApp(api, options);
  const outputPath = resolve(options.output);
  const outputFilename = basename(outputPath);

  console.log(`App: ${chalk.bold(app.name)}`);
  console.log(`Gerando dumpdata: ${chalk.cyan(outputFilename)}`);

  try {
    await api.runDumpdata(app.id, {
      manage_path: options.manage || "manage.py",
      dump_args: dumpArgs,
      output_filename: outputFilename,
    });
  } catch (error) {
    handleApiError(error);
  }

  console.log(chalk.dim("Acompanhando dumpdata..."));
  const result = await pollRunStatus(api, app.id);
  if (!result.success) {
    console.log(chalk.red(`dumpdata falhou: ${result.error}`));
    process.exit(1);
  }

  const artifact = result.data?.artifact;
  if (!artifact?.download_url) {
    console.log(chalk.red("dumpdata concluiu, mas nao retornou artefato para download."));
    process.exit(1);
  }

  let content;
  try {
    content = await api.downloadArtifact(artifact.download_url);
  } catch (error) {
    handleApiError(error);
  }

  if (content.length > MAX_ARTIFACT_BYTES) {
    console.log(chalk.red(`Dump excede o limite de ${MAX_ARTIFACT_BYTES} bytes.`));
    process.exit(1);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content);
  console.log(chalk.green(`dumpdata salvo em ${outputPath} (${content.length} bytes).`));
}

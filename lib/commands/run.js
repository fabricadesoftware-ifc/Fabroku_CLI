/**
 * Comandos `fabroku run` para rotinas Django locais e sessoes interativas.
 */

import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import readline from "node:readline";

import chalk from "chalk";
import WebSocket from "ws";

import { findAppByGitUrl, findAppByNameOrId, getGitBranch, getGitRemoteUrl } from "../app-resolver.js";
import { FabrokuAPI, APIError } from "../api.js";
import { isAuthenticated } from "../config.js";

const MAX_ARTIFACT_BYTES = 50 * 1024 * 1024;
const MAX_STREAM_RECONNECTS = 5;

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

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
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

function normalizeContainerPath(pathValue) {
  return pathValue.replace(/\\/g, "/").replace(/^\.\//, "");
}

function validateFixtureContainerPath(fixturePath) {
  const normalized = normalizeContainerPath(fixturePath.trim());
  if (!normalized) {
    console.log(chalk.red("Informe o caminho do fixture JSON."));
    process.exit(1);
  }
  if (
    normalized.startsWith("/")
    || normalized.startsWith("~")
    || /^[A-Za-z]:/.test(normalized)
    || normalized.includes("\0")
    || normalized.includes("\n")
    || normalized.includes("\r")
  ) {
    console.log(chalk.red("O caminho do fixture precisa ser relativo ao app."));
    process.exit(1);
  }
  if (normalized.split("/").includes("..")) {
    console.log(chalk.red("O caminho do fixture nao pode conter '..'."));
    process.exit(1);
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(normalized)) {
    console.log(chalk.red('O caminho do fixture aceita apenas letras, numeros, ".", "_", "-" e "/".'));
    process.exit(1);
  }
  if (!normalized.toLowerCase().endsWith(".json")) {
    console.log(chalk.red("O fixture precisa ter extensao .json."));
    process.exit(1);
  }
  return normalized;
}

function resolveFixtureContainerPath(inputPath, dir) {
  const deployRoot = resolve(dir || ".");
  const candidates = [resolve(deployRoot, inputPath), resolve(inputPath)];
  const localFixturePath = candidates.find((candidate, index) => (
    existsSync(candidate) && candidates.indexOf(candidate) === index
  ));

  if (!localFixturePath) {
    return validateFixtureContainerPath(inputPath);
  }

  const stats = statSync(localFixturePath);
  if (!stats.isFile()) {
    console.log(chalk.red(`O caminho informado nao e um arquivo: ${localFixturePath}`));
    process.exit(1);
  }

  const relativePath = relative(deployRoot, localFixturePath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    console.log(chalk.red("O fixture precisa estar dentro do diretorio usado no deploy (--dir)."));
    process.exit(1);
  }

  return validateFixtureContainerPath(relativePath);
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
    await sleep(intervalMs);

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

function promptVisible(promptText) {
  return new Promise((resolveAnswer) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(promptText, (answer) => {
      rl.close();
      resolveAnswer(answer);
    });
  });
}

function promptHidden(promptText) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    return promptVisible(promptText);
  }

  return new Promise((resolveAnswer, rejectAnswer) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    const previousRawMode = Boolean(stdin.isRaw);
    let answer = "";
    let settled = false;

    stdout.write(promptText);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);

    function cleanup() {
      stdin.removeListener("data", onData);
      stdin.setRawMode(previousRawMode);
      stdin.pause();
    }

    function finish(result, isError = false) {
      if (settled) return;
      settled = true;
      cleanup();
      stdout.write("\n");
      if (isError) {
        rejectAnswer(result);
      } else {
        resolveAnswer(result);
      }
    }

    function onData(chunk) {
      for (const char of chunk) {
        if (char === "\u0003") {
          finish(new Error("USER_CANCELLED"), true);
          return;
        }
        if (char === "\r" || char === "\n") {
          finish(answer);
          return;
        }
        if (char === "\u0008" || char === "\u007F") {
          answer = answer.slice(0, -1);
          continue;
        }
        if (char === "\u001B") {
          continue;
        }
        answer += char;
      }
    }

    stdin.on("data", onData);
  });
}

async function promptForInteractiveValue(promptData) {
  const promptText = promptData.text || `${promptData.label || "Valor"}: `;
  if (promptData.secret) {
    return promptHidden(promptText);
  }
  return promptVisible(promptText);
}

async function cancelInteractiveSession(api, appId, sessionId, controller) {
  if (controller && !controller.signal.aborted) controller.abort();
  try {
    await api.cancelInteractiveSession(appId, sessionId);
  } catch {
    // Melhor esforço; o importante e interromper o fluxo local.
  }
}

async function consumeInteractiveSession(api, appId, sessionId) {
  let activeStreamController = null;
  let lastEventId = 0;
  let finished = false;
  let failed = false;
  let lastStatusMessage = "";
  let reconnectCount = 0;
  let cancellationRequested = false;
  let pendingAnswer = null;

  const onSigint = async () => {
    if (cancellationRequested) return;
    cancellationRequested = true;
    console.log(chalk.yellow("\nCancelando sessao interativa..."));
    await cancelInteractiveSession(api, appId, sessionId, activeStreamController);
    process.exit(130);
  };

  process.on("SIGINT", onSigint);

  try {
    while (!finished) {
      const streamController = new AbortController();
      activeStreamController = streamController;
      let expectedStreamClose = false;

      try {
        await api.streamInteractiveSessionEvents(appId, sessionId, {
          afterEventId: lastEventId,
          signal: streamController.signal,
          onEvent: async (event) => {
            if (event.id) {
              const numericId = Number(event.id);
              if (!Number.isNaN(numericId)) lastEventId = numericId;
            }

            const payload = event.data || {};
            if (event.event === "status") {
              const statusMessage = payload.message || "";
              if (statusMessage && statusMessage !== lastStatusMessage) {
                console.log(`   ${chalk.dim(statusMessage)}`);
                lastStatusMessage = statusMessage;
              }
              return;
            }

            if (event.event === "output") {
              if (payload.message) console.log(payload.message);
              return;
            }

            if (event.event === "prompt") {
              let answer;
              try {
                answer = await promptForInteractiveValue(payload);
              } catch (error) {
                if (error instanceof Error && error.message === "USER_CANCELLED") {
                  cancellationRequested = true;
                  await cancelInteractiveSession(api, appId, sessionId, streamController);
                  process.exit(130);
                }
                throw error;
              }

              pendingAnswer = {
                prompt_id: payload.prompt_id,
                value: answer,
              };
              expectedStreamClose = true;
              streamController.abort();
              return;
            }

            if (event.event === "complete") {
              if (!payload.silent) {
                console.log(chalk.green(payload.message || "Sessao concluida com sucesso."));
              }
              finished = true;
              failed = false;
              expectedStreamClose = true;
              streamController.abort();
              return;
            }

            if (event.event === "error") {
              if (!cancellationRequested) {
                console.log(chalk.red(payload.message || "Sessao interativa falhou."));
              }
              finished = true;
              failed = !cancellationRequested;
              expectedStreamClose = true;
              streamController.abort();
            }
          },
        });

        if (pendingAnswer && !cancellationRequested) {
          await sleep(100);
          try {
            await api.answerInteractiveSession(appId, sessionId, pendingAnswer);
          } catch (error) {
            handleApiError(error);
          } finally {
            pendingAnswer = null;
          }
          reconnectCount = 0;
          continue;
        }

        if (!finished) {
          reconnectCount += 1;
          if (reconnectCount > MAX_STREAM_RECONNECTS) {
            throw new Error("Fluxo de eventos interrompido muitas vezes.");
          }
          await sleep(500);
        }
      } catch (error) {
        if (cancellationRequested || finished) break;

        if (pendingAnswer && (expectedStreamClose || streamController.signal.aborted)) {
          await sleep(100);
          try {
            await api.answerInteractiveSession(appId, sessionId, pendingAnswer);
          } catch (answerError) {
            handleApiError(answerError);
          } finally {
            pendingAnswer = null;
          }
          reconnectCount = 0;
          continue;
        }

        if (expectedStreamClose || streamController.signal.aborted) {
          continue;
        }

        reconnectCount += 1;
        if (reconnectCount > MAX_STREAM_RECONNECTS) {
          throw error;
        }
        console.log(chalk.yellow("Conexao com a sessao interativa interrompida, tentando reconectar..."));
        await sleep(1000);
      } finally {
        if (activeStreamController === streamController) {
          activeStreamController = null;
        }
      }
    }
  } finally {
    process.off("SIGINT", onSigint);
  }

  if (!finished && !cancellationRequested) {
    throw new Error("Sessao interativa terminou sem confirmacao de sucesso.");
  }
  if (failed) process.exit(1);
}

function sendWebSocketJson(socket, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    throw new Error("WebSocket da sessao nao esta conectado.");
  }
  socket.send(JSON.stringify(payload));
}

async function consumeInteractiveSessionWebSocket(api, session) {
  let socket = null;
  let lastEventId = 0;
  let finished = false;
  let failed = false;
  let reconnectCount = 0;
  let cancellationRequested = false;
  let lastStatusMessage = "";

  const onSigint = async () => {
    if (cancellationRequested) return;
    cancellationRequested = true;
    console.log(chalk.yellow("\nCancelando sessao interativa..."));
    try {
      if (socket && socket.readyState === WebSocket.OPEN) {
        sendWebSocketJson(socket, { type: "cancel" });
        socket.close();
      } else {
        await api.cancelInteractiveSession(session.app_id, session.session_id);
      }
    } catch {
      // Melhor esforco; a sessao tambem expira por inatividade.
    }
    process.exit(130);
  };

  process.on("SIGINT", onSigint);

  async function handleMessage(message) {
    if (message.id) {
      const numericId = Number(message.id);
      if (!Number.isNaN(numericId)) lastEventId = Math.max(lastEventId, numericId);
    }

    if (message.type === "status") {
      const statusMessage = message.message || "";
      if (
        statusMessage
        && statusMessage !== lastStatusMessage
        && statusMessage !== "Conectado a sessao interativa."
      ) {
        console.log(`   ${chalk.dim(statusMessage)}`);
        lastStatusMessage = statusMessage;
      }
      return;
    }

    if (message.type === "output") {
      if (message.message) console.log(message.message);
      return;
    }

    if (message.type === "prompt") {
      let answer;
      try {
        answer = await promptForInteractiveValue(message);
      } catch (error) {
        if (error instanceof Error && error.message === "USER_CANCELLED") {
          cancellationRequested = true;
          await cancelInteractiveSession(api, session.app_id, session.session_id, null);
          process.exit(130);
        }
        throw error;
      }

      sendWebSocketJson(socket, {
        type: "answer",
        prompt_id: message.prompt_id,
        value: answer,
      });
      return;
    }

    if (message.type === "complete") {
      if (!message.silent) {
        console.log(chalk.green(message.message || "Sessao concluida com sucesso."));
      }
      finished = true;
      failed = false;
      if (socket && socket.readyState === WebSocket.OPEN) socket.close();
      return;
    }

    if (message.type === "error") {
      if (!cancellationRequested) {
        console.log(chalk.red(message.message || "Sessao interativa falhou."));
      }
      finished = true;
      failed = !cancellationRequested;
      if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    }
  }

  try {
    while (!finished) {
      const url = api.resolveWebSocketUrl(session.websocket_url, { after_event: lastEventId });

      await new Promise((resolveSocket, rejectSocket) => {
        let settled = false;
        socket = new WebSocket(url, { headers: api.websocketHeaders });

        function settle(error = null) {
          if (settled) return;
          settled = true;
          socket.removeAllListeners();
          if (error) rejectSocket(error);
          else resolveSocket();
        }

        socket.on("message", (data) => {
          let parsed;
          try {
            parsed = JSON.parse(data.toString("utf8"));
          } catch {
            return;
          }
          void handleMessage(parsed).catch(settle);
        });
        socket.on("close", () => settle());
        socket.on("error", (error) => settle(error));
      });

      if (!finished) {
        reconnectCount += 1;
        if (reconnectCount > MAX_STREAM_RECONNECTS) {
          throw new Error("WebSocket interrompido muitas vezes.");
        }
        console.log(chalk.yellow("Conexao WebSocket interrompida, tentando reconectar..."));
        await sleep(1000);
      }
    }
  } finally {
    process.off("SIGINT", onSigint);
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  }

  if (failed) process.exit(1);
}

export async function runLoaddata(fixturePath, options) {
  ensureAuthenticated();
  ensureDjangoFlag(options);

  const dir = options.dir || ".";
  const containerFixturePath = resolveFixtureContainerPath(fixturePath, dir);

  const api = new FabrokuAPI();
  const app = await resolveTargetApp(api, options);

  console.log(`App: ${chalk.bold(app.name)}`);
  console.log(`Fixture no container: ${chalk.cyan(containerFixturePath)}`);

  try {
    await api.runLoaddata(app.id, {
      fixture_path: containerFixturePath,
      manage_path: options.manage || "manage.py",
    });
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

export async function runMigrate(options) {
  ensureAuthenticated();

  const api = new FabrokuAPI();
  const app = await resolveTargetApp(api, options);
  const managePath = options.manage || "manage.py";
  const noinput = Boolean(options.noinput);

  console.log(`App: ${chalk.bold(app.name)}`);
  console.log(`Manage.py: ${chalk.cyan(managePath)}`);
  if (noinput) console.log(chalk.dim("Executando com --noinput."));

  try {
    await api.runMigrate(app.id, {
      manage_path: managePath,
      noinput,
    });
  } catch (error) {
    handleApiError(error);
  }

  console.log(chalk.dim("Acompanhando migrate..."));
  const result = await pollRunStatus(api, app.id);
  if (!result.success) {
    console.log(chalk.red(`migrate falhou: ${result.error}`));
    process.exit(1);
  }

  const output = result.data?.output?.trim();
  if (output) console.log(output);
  console.log(chalk.green("migrate executado com sucesso."));
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

export async function runCreatesuperuser(options) {
  ensureAuthenticated();

  const api = new FabrokuAPI();
  const app = await resolveTargetApp(api, options);

  console.log(`App: ${chalk.bold(app.name)}`);
  console.log(chalk.dim("Iniciando sessao interativa de createsuperuser..."));

  let session;
  try {
    session = await api.createInteractiveSession(app.id, {
      command_kind: "django_createsuperuser",
      manage_path: options.manage || "manage.py",
    });
  } catch (error) {
    handleApiError(error);
  }

  try {
    session.app_id = app.id;
    if (session.websocket_url) {
      try {
        await consumeInteractiveSessionWebSocket(api, session);
        return;
      } catch (error) {
        if (error instanceof Error) {
          console.log(chalk.yellow(`WebSocket indisponivel, usando SSE: ${error.message}`));
        }
      }
    }
    await consumeInteractiveSession(api, app.id, session.session_id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(chalk.red(`Sessao interativa falhou: ${message}`));
    process.exit(1);
  }
}

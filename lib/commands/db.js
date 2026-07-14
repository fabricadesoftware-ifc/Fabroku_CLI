/**
 * Comandos de banco de dados do Fabroku.
 */

import chalk from "chalk";
import WebSocket from "ws";

import { findAppByGitUrl, findAppByNameOrId, getGitBranch, getGitRemoteUrl } from "../app-resolver.js";
import { FabrokuAPI, APIError } from "../api.js";
import { isAuthenticated } from "../config.js";

const MAX_STREAM_RECONNECTS = 5;
const POSTGRES_SERVICE_TYPES = new Set(["postgres", "postgis"]);

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

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
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
    console.log(`   Use ${chalk.bold("fabroku db connect --app <nome-ou-id>")}.`);
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

function selectPostgresService(app, serviceOption) {
  const services = Array.isArray(app.services) ? app.services : [];
  const postgresServices = services.filter((service) => POSTGRES_SERVICE_TYPES.has(service.service_type));

  if (serviceOption) {
    const selected = postgresServices.find(
      (service) =>
        String(service.id) === String(serviceOption) ||
        service.name === serviceOption ||
        service.container_name === serviceOption,
    );
    if (!selected) {
      console.log(chalk.red(`Banco PostgreSQL/PostGIS "${serviceOption}" nao encontrado neste app.`));
      process.exit(1);
    }
    return selected;
  }

  if (postgresServices.length === 0) {
    console.log(chalk.red("Este app nao tem um banco PostgreSQL ou PostGIS vinculado."));
    process.exit(1);
  }

  if (postgresServices.length > 1) {
    console.log(chalk.red("Este app tem mais de um banco PostgreSQL/PostGIS vinculado. Informe --service."));
    for (const service of postgresServices) {
      console.log(`   ${chalk.cyan(service.id)} - ${service.name}`);
    }
    process.exit(1);
  }

  return postgresServices[0];
}

async function cancelSession(api, appId, sessionId, controller) {
  if (controller && !controller.signal.aborted) controller.abort();
  try {
    await api.cancelInteractiveSession(appId, sessionId);
  } catch {
    // Melhor esforco: a sessao tambem expira por inatividade no backend.
  }
}

function createTerminalInputPump(sendInput) {
  const stdin = process.stdin;
  const previousRawMode = Boolean(stdin.isRaw);
  const canUseRawMode = process.stdin.isTTY && typeof process.stdin.setRawMode === "function";
  let pendingInput = "";
  let flushTimer = null;
  let sendChain = Promise.resolve();
  let stopped = false;
  let onCancel = null;

  async function flushNow() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!pendingInput || stopped) return sendChain;

    const data = pendingInput;
    pendingInput = "";
    sendChain = sendChain.catch(() => undefined).then(() => sendInput(data));
    return sendChain;
  }

  function scheduleFlush(force = false) {
    if (force) {
      void flushNow().catch((error) => {
        console.error(chalk.red(`\nFalha ao enviar input: ${error.message}`));
      });
      return;
    }

    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      void flushNow().catch((error) => {
        console.error(chalk.red(`\nFalha ao enviar input: ${error.message}`));
      });
    }, 20);
  }

  function onData(chunk) {
    if (stopped) return;
    const value = chunk.toString("utf8");
    if (value.includes("\u0003")) {
      if (onCancel) void onCancel();
      return;
    }

    pendingInput += value;
    scheduleFlush(value.includes("\r") || value.includes("\n"));
  }

  function start(cancelHandler) {
    onCancel = cancelHandler;
    stdin.resume();
    stdin.setEncoding("utf8");
    if (canUseRawMode) stdin.setRawMode(true);
    stdin.on("data", onData);
  }

  async function stop() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    await flushNow().catch(() => undefined);
    stopped = true;
    stdin.removeListener("data", onData);
    if (canUseRawMode) stdin.setRawMode(previousRawMode);
    stdin.pause();
  }

  return { start, stop };
}

async function consumePostgresSession(api, appId, sessionId) {
  let activeStreamController = null;
  let lastOutputId = 0;
  let lastEventId = 0;
  let finished = false;
  let failed = false;
  let reconnectCount = 0;
  let cancellationRequested = false;
  const inputPump = createTerminalInputPump((data) => api.inputInteractiveSession(appId, sessionId, { data }));

  const cancel = async () => {
    if (cancellationRequested) return;
    cancellationRequested = true;
    process.stderr.write(chalk.yellow("\nCancelando sessao Postgres...\n"));
    await inputPump.stop();
    await cancelSession(api, appId, sessionId, activeStreamController);
    process.exit(130);
  };

  process.on("SIGINT", cancel);
  inputPump.start(cancel);

  try {
    while (!finished) {
      const streamController = new AbortController();
      activeStreamController = streamController;

      try {
        await api.streamInteractiveTerminalEvents(appId, sessionId, {
          afterOutputId: lastOutputId,
          afterEventId: lastEventId,
          signal: streamController.signal,
          onEvent: async (event) => {
            const eventId = String(event.id || "");
            if (eventId.startsWith("output-")) {
              const numericId = Number(eventId.slice("output-".length));
              if (!Number.isNaN(numericId)) lastOutputId = numericId;
            }
            if (eventId.startsWith("event-")) {
              const numericId = Number(eventId.slice("event-".length));
              if (!Number.isNaN(numericId)) lastEventId = numericId;
            }

            const payload = event.data || {};
            if (event.event === "output") {
              process.stdout.write(payload.content ?? payload.message ?? "");
              return;
            }

            if (event.event === "status") {
              if (payload.message) process.stderr.write(chalk.dim(`\n${payload.message}\n`));
              return;
            }

            if (event.event === "complete") {
              if (!payload.silent && payload.message) process.stderr.write(chalk.green(`\n${payload.message}\n`));
              finished = true;
              streamController.abort();
              return;
            }

            if (event.event === "error") {
              if (!cancellationRequested) {
                process.stderr.write(chalk.red(`\n${payload.message || "Sessao Postgres falhou."}\n`));
              }
              finished = true;
              failed = !cancellationRequested;
              streamController.abort();
            }
          },
        });

        if (!finished) {
          reconnectCount += 1;
          if (reconnectCount > MAX_STREAM_RECONNECTS) {
            throw new Error("Fluxo de eventos interrompido muitas vezes.");
          }
          await sleep(500);
        }
      } catch (error) {
        if (cancellationRequested || finished) break;
        reconnectCount += 1;
        if (reconnectCount > MAX_STREAM_RECONNECTS) throw error;
        process.stderr.write(chalk.yellow("\nConexao com o banco interrompida, tentando reconectar...\n"));
        await sleep(1000);
      } finally {
        if (activeStreamController === streamController) {
          activeStreamController = null;
        }
      }
    }
  } finally {
    process.off("SIGINT", cancel);
    await inputPump.stop();
  }

  if (failed) process.exit(1);
}

function sendWebSocketJson(socket, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    throw new Error("WebSocket da sessao nao esta conectado.");
  }
  socket.send(JSON.stringify(payload));
}

async function consumePostgresSessionWebSocket(api, session) {
  let socket = null;
  let lastOutputId = 0;
  let lastEventId = 0;
  let finished = false;
  let failed = false;
  let reconnectCount = 0;
  let cancellationRequested = false;
  const inputPump = createTerminalInputPump((data) => {
    sendWebSocketJson(socket, { type: "input", data });
  });

  const cancel = async () => {
    if (cancellationRequested) return;
    cancellationRequested = true;
    process.stderr.write(chalk.yellow("\nCancelando sessao Postgres...\n"));
    await inputPump.stop();
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

  process.on("SIGINT", cancel);
  inputPump.start(cancel);

  async function handleMessage(message) {
    if (message.output_id) {
      const numericId = Number(message.output_id);
      if (!Number.isNaN(numericId)) lastOutputId = Math.max(lastOutputId, numericId);
    }
    if (message.id) {
      const numericId = Number(message.id);
      if (!Number.isNaN(numericId)) lastEventId = Math.max(lastEventId, numericId);
    }

    if (message.type === "terminal.output") {
      process.stdout.write(message.content ?? "");
      return;
    }

    if (message.type === "output") {
      process.stdout.write(message.content ?? message.message ?? "");
      return;
    }

    if (message.type === "status") {
      if (message.message && message.message !== "Conectado a sessao interativa.") {
        process.stderr.write(chalk.dim(`\n${message.message}\n`));
      }
      return;
    }

    if (message.type === "complete") {
      if (!message.silent && message.message) process.stderr.write(chalk.green(`\n${message.message}\n`));
      finished = true;
      if (socket && socket.readyState === WebSocket.OPEN) socket.close();
      return;
    }

    if (message.type === "error") {
      if (!cancellationRequested) {
        process.stderr.write(chalk.red(`\n${message.message || "Sessao Postgres falhou."}\n`));
      }
      finished = true;
      failed = !cancellationRequested;
      if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    }
  }

  try {
    while (!finished) {
      const url = api.resolveWebSocketUrl(session.websocket_url, {
        after_output: lastOutputId,
        after_event: lastEventId,
      });

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
        process.stderr.write(chalk.yellow("\nConexao WebSocket com o banco interrompida, tentando reconectar...\n"));
        await sleep(1000);
      }
    }
  } finally {
    process.off("SIGINT", cancel);
    await inputPump.stop();
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  }

  if (failed) process.exit(1);
}

export async function dbConnect(options) {
  ensureAuthenticated();

  const api = new FabrokuAPI();
  const app = await resolveTargetApp(api, options);
  const service = selectPostgresService(app, options.service);

  console.log(`App: ${chalk.bold(app.name)}`);
  const databaseLabel = service.service_type === "postgis" ? "PostGIS" : "PostgreSQL";
  console.log(`${databaseLabel}: ${chalk.bold(service.name)}`);
  console.log(chalk.yellow("Aviso: esta sessao sera auditada. Tudo que for digitado e exibido sera registrado."));

  let session;
  try {
    session = await api.createInteractiveSession(app.id, {
      command_kind: "postgres_connect",
      service_id: service.id,
    });
  } catch (error) {
    handleApiError(error);
  }

  try {
    session.app_id = app.id;
    if (session.websocket_url) {
      try {
        await consumePostgresSessionWebSocket(api, session);
        return;
      } catch (error) {
        if (error instanceof Error) {
          process.stderr.write(chalk.yellow(`\nWebSocket indisponivel, usando SSE: ${error.message}\n`));
        }
      }
    }
    await consumePostgresSession(api, app.id, session.session_id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(chalk.red(`Sessao Postgres falhou: ${message}`));
    process.exit(1);
  }
}

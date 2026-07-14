import { APIError, FabrokuAPI } from "../api.js";
import { isAuthenticated } from "../config.js";

const SECRET_KEY_PATTERN = /(password|passwd|secret|token|api[_-]?key|private[_-]?key|credential|authorization)/i;
const SECRET_ASSIGNMENT_PATTERN = /\b([A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|DATABASE_URL|REDIS_URL)[A-Z0-9_]*)\s*[:=]\s*([^\s,;]+)/gi;
const URI_CREDENTIAL_PATTERN = /([a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:)([^@\s/]+)(@)/gi;

function asItems(response) {
  if (Array.isArray(response)) return response;
  return Array.isArray(response?.results) ? response.results : [];
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  );
}

export function redactText(value) {
  if (typeof value !== "string") return value;

  return value
    .replace(URI_CREDENTIAL_PATTERN, "$1***$3")
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1=***");
}

export function redactSecrets(value, key = "") {
  if (SECRET_KEY_PATTERN.test(key)) return "***";
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      redactSecrets(childValue, childKey),
    ]),
  );
}

export function sanitizeProject(project) {
  const users = project.users_detail || project.users;
  return compactObject({
    id: project.id,
    name: project.name,
    is_owner: project.is_owner,
    member_count: Array.isArray(users) ? users.length : undefined,
    created_at: project.created_at,
    updated_at: project.updated_at,
  });
}

export function sanitizeService(service) {
  return compactObject({
    id: service.id,
    name: service.name,
    service_type: service.service_type,
    app: service.app,
    project: service.project,
    container_name: service.container_name,
    env_key: service.env_key,
    image: service.image,
    image_version: service.image_version,
    task_id: service.task_id,
    created_at: service.created_at,
    updated_at: service.updated_at,
  });
}

export function sanitizeApp(app) {
  return compactObject({
    id: app.id,
    name: app.name,
    status: app.status,
    domain: app.domain,
    git: app.git,
    branch: app.branch,
    project: app.project,
    name_dokku: app.name_dokku,
    is_owner: app.is_owner,
    last_commit_sha: app.last_commit_sha,
    environment_keys: Object.keys(app.variables || {}).sort(),
    services: Array.isArray(app.services)
      ? app.services.map(sanitizeService)
      : undefined,
    created_at: app.created_at,
    updated_at: app.updated_at,
  });
}

function successResult(payload) {
  const safePayload = redactSecrets(payload);
  return {
    content: [{ type: "text", text: JSON.stringify(safePayload, null, 2) }],
    structuredContent: safePayload,
  };
}

function errorResult(error) {
  let message = error instanceof Error ? error.message : String(error);

  if (error instanceof APIError && error.statusCode === 401) {
    message = "Token expirado ou inválido. Execute `fabroku login` novamente.";
  }

  return {
    content: [{ type: "text", text: redactText(message) }],
    isError: true,
  };
}

async function resolveProject(api, reference) {
  if (reference === undefined || reference === null || reference === "") return null;

  const projects = asItems(await api.listProjects());
  const project = projects.find(
    (item) => item.name === reference || String(item.id) === String(reference),
  );
  if (!project) throw new Error(`Projeto "${reference}" não encontrado.`);
  return project;
}

export async function resolveApp(api, reference) {
  const apps = asItems(await api.listApps());
  const app = apps.find(
    (item) => item.name === reference || String(item.id) === String(reference),
  );
  if (!app) throw new Error(`App "${reference}" não encontrado.`);
  return app;
}

async function waitForTask({ api, appId, taskId, sleep, pollIntervalMs, maxPolls }) {
  let transientError;

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    try {
      const status = await api.getAppStatus(appId);
      transientError = undefined;

      if (status.task_id && taskId && status.task_id !== taskId) {
        throw new Error("O app iniciou outra tarefa enquanto esta operação era acompanhada.");
      }
      if (status.state === "SUCCESS") return { success: true, status };
      if (["FAILURE", "REVOKED"].includes(status.state)) {
        return { success: false, status };
      }
    } catch (error) {
      transientError = error;
    }

    if (attempt < maxPolls - 1) await sleep(pollIntervalMs);
  }

  if (transientError) throw transientError;
  throw new Error("Tempo limite excedido ao aguardar a tarefa do Fabroku.");
}

export function createFabrokuToolHandlers(options = {}) {
  const api = options.api || new FabrokuAPI();
  const authenticated = options.authenticated || isAuthenticated;
  const sleep = options.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const pollIntervalMs = options.pollIntervalMs ?? 3000;
  const maxPolls = options.maxPolls ?? 200;

  const run = (handler) => async (input = {}) => {
    try {
      if (!authenticated()) {
        throw new Error("A CLI não está autenticada. Execute `fabroku login` primeiro.");
      }
      return await handler(input);
    } catch (error) {
      return errorResult(error);
    }
  };

  const wait = (appId, taskId) => waitForTask({
    api,
    appId,
    taskId,
    sleep,
    pollIntervalMs,
    maxPolls,
  });

  return {
    listProjects: run(async () => {
      const projects = asItems(await api.listProjects()).map(sanitizeProject);
      return successResult({ projects, count: projects.length });
    }),

    listApps: run(async ({ project } = {}) => {
      const selectedProject = await resolveProject(api, project);
      let apps = asItems(await api.listApps());
      if (selectedProject) {
        apps = apps.filter((app) => String(app.project) === String(selectedProject.id));
      }
      const safeApps = apps.map(sanitizeApp);
      return successResult({ apps: safeApps, count: safeApps.length });
    }),

    getApp: run(async ({ app }) => {
      const selectedApp = await resolveApp(api, app);
      const details = await api.getApp(selectedApp.id);
      return successResult({ app: sanitizeApp(details) });
    }),

    listServices: run(async ({ app, project } = {}) => {
      const selectedApp = app ? await resolveApp(api, app) : null;
      const selectedProject = project ? await resolveProject(api, project) : null;
      const response = await api.listServices({
        app: selectedApp?.id,
        project: selectedProject?.id,
      });
      const services = asItems(response).map(sanitizeService);
      return successResult({ services, count: services.length });
    }),

    getStatus: run(async ({ app }) => {
      const selectedApp = await resolveApp(api, app);
      const status = await api.getAppStatus(selectedApp.id);
      return successResult({ app: sanitizeApp(selectedApp), task: status });
    }),

    getRuntimeLogs: run(async ({ app, lines = 100 }) => {
      const selectedApp = await resolveApp(api, app);
      const response = await api.getRuntimeLogs(selectedApp.id, lines);
      const runtimeLines = Array.isArray(response?.lines)
        ? response.lines.map(redactText)
        : [];
      return successResult({
        app: { id: selectedApp.id, name: selectedApp.name },
        lines: runtimeLines,
        count: runtimeLines.length,
      });
    }),

    redeploy: run(async ({ app, confirmed_committed_and_pushed, wait: shouldWait = true }) => {
      if (!confirmed_committed_and_pushed) {
        throw new Error(
          "Redeploy recusado: teste as alterações, faça `git commit` e `git push`, depois confirme `confirmed_committed_and_pushed=true`. O Fabroku publica apenas o repositório remoto.",
        );
      }

      const selectedApp = await resolveApp(api, app);
      const started = await api.redeployApp(selectedApp.id);
      if (!shouldWait) {
        return successResult({
          app: { id: selectedApp.id, name: selectedApp.name },
          task_id: started.task_id,
          state: started.status || "DEPLOYING",
        });
      }

      const result = await wait(selectedApp.id, started.task_id);
      const payload = {
        app: { id: selectedApp.id, name: selectedApp.name },
        task_id: started.task_id,
        task: result.status,
      };
      return result.success ? successResult(payload) : { ...successResult(payload), isError: true };
    }),

    runMigrate: run(async ({ app, manage_path = "manage.py", noinput = true, wait: shouldWait = true }) => {
      const selectedApp = await resolveApp(api, app);
      const started = await api.runMigrate(selectedApp.id, { manage_path, noinput });
      if (!shouldWait) {
        return successResult({
          app: { id: selectedApp.id, name: selectedApp.name },
          task_id: started.task_id,
          state: started.status || "RUNNING",
        });
      }

      const result = await wait(selectedApp.id, started.task_id);
      const payload = {
        app: { id: selectedApp.id, name: selectedApp.name },
        task_id: started.task_id,
        task: result.status,
      };
      return result.success ? successResult(payload) : { ...successResult(payload), isError: true };
    }),
  };
}

/**
 * Cliente HTTP para a API Fabroku.
 */

import { getApiUrl, getToken } from "./config.js";

export class APIError extends Error {
  constructor(statusCode, detail) {
    super(`[${statusCode}] ${detail}`);
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

export class FabrokuAPI {
  constructor() {
    this.baseUrl = getApiUrl();
    this.token = getToken();
  }

  get headers() {
    const h = { Accept: "application/json" };
    if (this.token) h.Authorization = `CLI ${this.token}`;
    return h;
  }

  async request(method, path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = { ...this.headers, ...options.headers };
    let body;

    if (options.formData) {
      body = options.formData;
    } else if (Object.hasOwn(options, "body")) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const resp = await fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(options.timeoutMs || 15000),
    });

    if (!resp.ok) {
      let detail;
      try {
        const data = await resp.json();
        detail = data.detail || data.error || JSON.stringify(data);
      } catch {
        detail = await resp.text();
      }
      throw new APIError(resp.status, detail);
    }
    return resp.json();
  }

  async get(path) {
    return this.request("GET", path);
  }
  async post(path, body) {
    return this.request("POST", path, { body });
  }
  async postForm(path, formData, options = {}) {
    return this.request("POST", path, { formData, timeoutMs: options.timeoutMs });
  }
  async download(path, options = {}) {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: this.headers,
      signal: AbortSignal.timeout(options.timeoutMs || 120000),
    });

    if (!resp.ok) {
      let detail;
      try {
        const data = await resp.json();
        detail = data.detail || data.error || JSON.stringify(data);
      } catch {
        detail = await resp.text();
      }
      throw new APIError(resp.status, detail);
    }

    return Buffer.from(await resp.arrayBuffer());
  }

  async stream(path, options = {}) {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const headers = { ...this.headers, Accept: "text/event-stream" };
    const resp = await fetch(url, {
      method: "GET",
      headers,
      signal: options.signal,
    });

    if (!resp.ok) {
      let detail;
      try {
        const data = await resp.json();
        detail = data.detail || data.error || JSON.stringify(data);
      } catch {
        detail = await resp.text();
      }
      throw new APIError(resp.status, detail);
    }

    if (!resp.body) return;

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let boundaryIndex = buffer.indexOf("\n\n");
      while (boundaryIndex !== -1) {
        const rawEvent = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);
        const parsedEvent = parseSSEEvent(rawEvent);
        if (parsedEvent && options.onEvent) {
          await options.onEvent(parsedEvent);
        }
        boundaryIndex = buffer.indexOf("\n\n");
      }
    }

    if (buffer.trim()) {
      const parsedEvent = parseSSEEvent(buffer);
      if (parsedEvent && options.onEvent) {
        await options.onEvent(parsedEvent);
      }
    }
  }

  // --- Endpoints ---

  async checkAuth() {
    return this.get("/api/auth/check/");
  }
  async listApps() {
    return this.get("/api/apps/apps/");
  }
  async listProjects() {
    return this.get("/api/projects/projects/");
  }
  async getUserMe() {
    return this.get("/api/auth/users/me/");
  }
  async redeployApp(appId) {
    return this.post(`/api/apps/apps/${appId}/redeploy/`);
  }
  async getAppStatus(appId) {
    return this.get(`/api/apps/apps/${appId}/get_app_status/`);
  }
  async runLoaddata(appId, formData) {
    return this.postForm(`/api/apps/apps/${appId}/run_loaddata/`, formData, { timeoutMs: 120000 });
  }
  async runDumpdata(appId, body) {
    return this.post(`/api/apps/apps/${appId}/run_dumpdata/`, body);
  }
  async createInteractiveSession(appId, body) {
    return this.post(`/api/apps/apps/${appId}/interactive_sessions/`, body);
  }
  async answerInteractiveSession(appId, sessionId, body) {
    return this.post(`/api/apps/apps/${appId}/interactive_sessions/${sessionId}/answer/`, body);
  }
  async cancelInteractiveSession(appId, sessionId) {
    return this.post(`/api/apps/apps/${appId}/interactive_sessions/${sessionId}/cancel/`, {});
  }
  async streamInteractiveSessionEvents(appId, sessionId, options = {}) {
    const query = options.afterEventId ? `?after=${options.afterEventId}` : "";
    return this.stream(`/api/apps/apps/${appId}/interactive_sessions/${sessionId}/events/${query}`, options);
  }
  async downloadArtifact(downloadUrl) {
    return this.download(downloadUrl, { timeoutMs: 120000 });
  }
  async diagnoseWebhook(appId) {
    return this.get(`/api/apps/apps/${appId}/diagnose_webhook/`);
  }
  async setupWebhook(appId) {
    return this.post(`/api/apps/apps/${appId}/setup_webhook/`);
  }
  async testCommitStatus(appId) {
    return this.post(`/api/apps/apps/${appId}/test_commit_status/`);
  }
}

export function parseSSEEvent(rawEvent) {
  const trimmedEvent = rawEvent.replace(/\r/g, "").trim();
  if (!trimmedEvent || trimmedEvent.startsWith(":")) return null;

  let id = null;
  let event = "message";
  const dataLines = [];

  for (const line of trimmedEvent.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("id:")) {
      id = line.slice(3).trim();
      continue;
    }
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!dataLines.length) return null;

  let data;
  const rawData = dataLines.join("\n");
  try {
    data = JSON.parse(rawData);
  } catch {
    data = rawData;
  }

  return { id, event, data };
}

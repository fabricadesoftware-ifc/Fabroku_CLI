/**
 * Cliente HTTP para a API Fabroku.
 */

import { getApiUrl, getToken } from "./config.js";
import { fetchPaginated } from "./application/pagination/fetch-paginated.js";
import { APIError, HttpClient } from "./infrastructure/http/http-client.js";
import { createSseStream, parseSseEvent } from "./infrastructure/http/sse-stream.js";

export { APIError } from "./infrastructure/http/http-client.js";

export class FabrokuAPI {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || getApiUrl();
    this.token = Object.hasOwn(options, "token") ? options.token : getToken();
    this.httpClient = options.httpClient || new HttpClient({
      baseUrl: this.baseUrl,
      token: this.token,
      fetchImpl: options.fetchImpl,
    });
    this.sseStream = options.sseStream || createSseStream({ fetchImpl: options.fetchImpl });
  }

  get headers() {
    const h = { Accept: "application/json" };
    if (this.token) h.Authorization = `CLI ${this.token}`;
    return h;
  }

  get websocketHeaders() {
    const h = {};
    if (this.token) h.Authorization = `CLI ${this.token}`;
    return h;
  }

  resolveWebSocketUrl(path, params = {}) {
    const url = new URL(path, this.baseUrl);
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  async request(method, path, options = {}) {
    return this.httpClient.request(method, path, options);
  }

  async get(path) {
    return this.request("GET", path);
  }
  async getPaginated(path) {
    return fetchPaginated({
      path,
      get: (pagePath) => this.get(pagePath),
      resolvePath: (pagePath) => this.resolvePaginatedPath(pagePath),
      createCycleError: () => new APIError(500, "Paginação da API retornou uma página repetida."),
    });
  }
  resolvePaginatedPath(pathOrUrl) {
    if (!pathOrUrl.startsWith("http")) return pathOrUrl;

    const url = new URL(pathOrUrl);
    return `${url.pathname}${url.search}`;
  }
  async post(path, body, options = {}) {
    return this.request("POST", path, { body, timeoutMs: options.timeoutMs });
  }
  async postForm(path, formData, options = {}) {
    return this.request("POST", path, { formData, timeoutMs: options.timeoutMs });
  }
  async download(path, options = {}) {
    return this.httpClient.download(path, options);
  }

  async stream(path, options = {}) {
    return this.sseStream(path, {
      ...options,
      baseUrl: this.baseUrl,
      headers: { ...this.headers, Accept: "text/event-stream, application/json" },
    });
  }

  // --- Endpoints ---

  async checkAuth() {
    return this.get("/api/auth/check/");
  }
  async listApps() {
    return this.getPaginated("/api/apps/apps/");
  }
  async listProjects() {
    return this.getPaginated("/api/projects/projects/");
  }
  async getApp(appId) {
    return this.get(`/api/apps/apps/${appId}/`);
  }
  async listServices(filters = {}) {
    const params = new URLSearchParams();
    if (filters.app) params.set("app", String(filters.app));
    if (filters.project) params.set("project", String(filters.project));
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.getPaginated(`/api/apps/services/${query}`);
  }
  async getRuntimeLogs(appId, num = 100) {
    const params = new URLSearchParams({
      app: String(appId),
      num: String(num),
    });
    return this.get(`/api/logs/app-runtime/?${params.toString()}`);
  }
  async getUserMe() {
    return this.get("/api/auth/users/me/");
  }
  async getPlatformConfig() {
    return this.get("/api/platform/config/");
  }
  async redeployApp(appId) {
    return this.post(`/api/apps/apps/${appId}/redeploy/`);
  }
  async getAppStatus(appId) {
    return this.get(`/api/apps/apps/${appId}/get_app_status/`);
  }
  async runMigrate(appId, body) {
    return this.post(`/api/apps/apps/${appId}/run_migrate/`, body, { timeoutMs: 120000 });
  }
  async runLoaddata(appId, body) {
    return this.post(`/api/apps/apps/${appId}/run_loaddata/`, body, { timeoutMs: 120000 });
  }
  async runDumpdata(appId, body) {
    return this.post(`/api/apps/apps/${appId}/run_dumpdata/`, body);
  }
  async createInteractiveSession(appId, body) {
    return this.post(`/api/apps/apps/${appId}/interactive_sessions/`, body);
  }
  async answerInteractiveSession(appId, sessionId, body) {
    return this.post(`/api/apps/apps/${appId}/interactive_sessions/${sessionId}/answer/`, body, { timeoutMs: 60000 });
  }
  async inputInteractiveSession(appId, sessionId, body) {
    return this.post(`/api/apps/apps/${appId}/interactive_sessions/${sessionId}/input/`, body, { timeoutMs: 60000 });
  }
  async cancelInteractiveSession(appId, sessionId) {
    return this.post(`/api/apps/apps/${appId}/interactive_sessions/${sessionId}/cancel/`, {});
  }
  async streamInteractiveSessionEvents(appId, sessionId, options = {}) {
    const query = options.afterEventId ? `?after=${options.afterEventId}` : "";
    return this.stream(`/api/apps/apps/${appId}/interactive_sessions/${sessionId}/events/${query}`, options);
  }
  async streamInteractiveTerminalEvents(appId, sessionId, options = {}) {
    const params = new URLSearchParams();
    if (options.afterOutputId) params.set("after_output", String(options.afterOutputId));
    if (options.afterEventId) params.set("after_event", String(options.afterEventId));
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.stream(`/api/apps/apps/${appId}/interactive_sessions/${sessionId}/terminal_events/${query}`, options);
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

export const parseSSEEvent = parseSseEvent;

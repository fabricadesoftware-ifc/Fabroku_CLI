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

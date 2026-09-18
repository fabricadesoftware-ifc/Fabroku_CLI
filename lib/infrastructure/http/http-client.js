export class APIError extends Error {
  constructor(statusCode, detail) {
    super(`[${statusCode}] ${detail}`);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

export class HttpClient {
  constructor({ baseUrl, token = null, fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  get headers() {
    const headers = { Accept: "application/json" };
    if (this.token) headers.Authorization = `CLI ${this.token}`;
    return headers;
  }

  resolveUrl(path) {
    return path.startsWith("http") ? path : `${this.baseUrl}${path}`;
  }

  async request(method, path, options = {}) {
    const headers = { ...this.headers, ...options.headers };
    let body;

    if (options.formData) {
      body = options.formData;
    } else if (Object.hasOwn(options, "body")) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const response = await this.fetchImpl(this.resolveUrl(path), {
      method,
      headers,
      body,
      signal: options.signal || AbortSignal.timeout(options.timeoutMs || 15000),
    });

    if (!response.ok) throw await this.createApiError(response);
    return response.json();
  }

  async download(path, options = {}) {
    const response = await this.fetchImpl(this.resolveUrl(path), {
      method: "GET",
      headers: this.headers,
      signal: options.signal || AbortSignal.timeout(options.timeoutMs || 120000),
    });

    if (!response.ok) throw await this.createApiError(response);
    return Buffer.from(await response.arrayBuffer());
  }

  async createApiError(response) {
    let detail;
    try {
      const data = await response.json();
      detail = data.detail || data.error || JSON.stringify(data);
    } catch {
      detail = await response.text();
    }
    return new APIError(response.status, detail);
  }
}

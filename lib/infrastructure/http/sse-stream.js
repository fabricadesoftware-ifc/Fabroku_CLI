import { APIError } from "./http-client.js";

export function parseSseEvent(rawEvent) {
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
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }

  if (!dataLines.length) return null;

  const rawData = dataLines.join("\n");
  let data;
  try {
    data = JSON.parse(rawData);
  } catch {
    data = rawData;
  }

  return { id, event, data };
}

async function responseDetail(response) {
  try {
    const data = await response.json();
    return data.detail || data.error || JSON.stringify(data);
  } catch {
    return response.text();
  }
}

export function createSseStream({ fetchImpl = globalThis.fetch } = {}) {
  return async function stream(path, options = {}) {
    const url = path.startsWith("http") ? path : new URL(path, options.baseUrl).toString();
    const response = await fetchImpl(url, {
      method: "GET",
      headers: options.headers,
      signal: options.signal,
    });

    if (!response.ok) throw new APIError(response.status, await responseDetail(response));
    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let boundaryIndex = buffer.indexOf("\n\n");
      while (boundaryIndex !== -1) {
        const event = parseSseEvent(buffer.slice(0, boundaryIndex));
        buffer = buffer.slice(boundaryIndex + 2);
        if (event && options.onEvent) await options.onEvent(event);
        boundaryIndex = buffer.indexOf("\n\n");
      }
    }

    const event = parseSseEvent(buffer);
    if (event && options.onEvent) await options.onEvent(event);
  };
}

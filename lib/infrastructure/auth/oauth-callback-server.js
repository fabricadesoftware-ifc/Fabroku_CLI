import { createServer } from "node:http";
import { parseLoginCallback } from "../../domain/auth/login-callback.js";

export function findFreePort({ createServerImpl = createServer } = {}) {
  return new Promise((resolve, reject) => {
    const server = createServerImpl();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function htmlPage(title, body) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:system-ui,sans-serif;display:flex;justify-content:center;
  align-items:center;min-height:100vh;margin:0;background:#1a1a2e;color:#eee}
  div{text-align:center;padding:2rem}
  h1{margin-bottom:1rem}
</style></head>
<body><div>${body}</div></body></html>`;
}

export function waitForOAuthCallback({
  port,
  timeoutMs = 120_000,
  createServerImpl = createServer,
  onCallback,
} = {}) {
  return new Promise((resolve) => {
    const connections = new Set();
    const server = createServerImpl((req, res) => {
      const result = parseLoginCallback(req.url);
      if (new URL(req.url, `http://localhost:${port}`).pathname === "/callback") {
        const success = Boolean(result.token);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(htmlPage(
          success ? "Fabroku CLI — Autenticado" : "Fabroku CLI — Erro",
          success
            ? "<h1>✅ Login realizado com sucesso!</h1><p>Pode fechar esta janela e voltar para o terminal.</p>"
            : `<h1>❌ Erro na autenticação</h1><p>${result.message || result.error || "Erro desconhecido"}</p>`,
        ));
        onCallback?.(result);
        shutdown();
        resolve(result);
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage("Fabroku CLI", "<p>Aguardando callback...</p>"));
    });

    server.on("connection", (socket) => {
      connections.add(socket);
      socket.on("close", () => connections.delete(socket));
    });

    const timer = setTimeout(() => {
      shutdown();
      resolve({ token: null, user: null, error: "timeout", message: "Timeout" });
    }, timeoutMs);

    function shutdown() {
      clearTimeout(timer);
      server.close();
      for (const socket of connections) socket.destroy();
    }

    server.listen(port);
  });
}

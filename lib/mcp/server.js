import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

import { createFabrokuToolHandlers } from "./tools.js";
import { createMcpDiagnostics } from "../infrastructure/mcp/mcp-diagnostics.js";

export const FABROKU_MCP_INSTRUCTIONS = `
Use as ferramentas Fabroku para consultar e operar apps aos quais o usuário já tem acesso.
Faça alterações no código e execute os testes com as ferramentas normais do ambiente, não pelo MCP.
Antes de chamar fabroku_redeploy, confira o diff, teste as alterações, crie um commit e execute git push para a branch configurada no app.
O redeploy usa exclusivamente o repositório remoto: alterações locais sem commit ou sem push não serão publicadas.
Nunca confirme confirmed_committed_and_pushed sem ter concluído esses passos.
Se uma operação falhar, consulte fabroku_get_status e fabroku_get_runtime_logs antes de tentar novamente.
As ferramentas não retornam valores de variáveis de ambiente nem outros segredos.
`.trim();

const appReferenceSchema = z.string().min(1).describe("Nome ou ID do app no Fabroku.");
const projectReferenceSchema = z.string().min(1).describe("Nome ou ID do projeto no Fabroku.");

export function createFabrokuMcpServer(options = {}) {
  const handlers = createFabrokuToolHandlers(options);
  const server = new McpServer(
    { name: "fabroku", version: options.version || "0.0.0" },
    { instructions: FABROKU_MCP_INSTRUCTIONS },
  );

  server.registerTool(
    "fabroku_list_projects",
    {
      title: "Listar projetos Fabroku",
      description: "Lista os projetos acessíveis ao usuário autenticado, sem expor dados pessoais dos membros.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    handlers.listProjects,
  );

  server.registerTool(
    "fabroku_list_apps",
    {
      title: "Listar apps Fabroku",
      description: "Lista apps acessíveis e, opcionalmente, filtra por projeto. Retorna nomes das envs, nunca seus valores.",
      inputSchema: { project: projectReferenceSchema.optional() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    handlers.listApps,
  );

  server.registerTool(
    "fabroku_get_app",
    {
      title: "Consultar app Fabroku",
      description: "Obtém detalhes seguros de um app, incluindo estado, repositório, branch e nomes das variáveis configuradas.",
      inputSchema: { app: appReferenceSchema },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    handlers.getApp,
  );

  server.registerTool(
    "fabroku_list_services",
    {
      title: "Listar serviços Fabroku",
      description: "Lista PostgreSQL, PostGIS, Redis e outros serviços visíveis, com filtros opcionais de app e projeto.",
      inputSchema: {
        app: appReferenceSchema.optional(),
        project: projectReferenceSchema.optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    handlers.listServices,
  );

  server.registerTool(
    "fabroku_get_status",
    {
      title: "Consultar status do app",
      description: "Consulta o app e o estado da tarefa atualmente associada a ele.",
      inputSchema: { app: appReferenceSchema },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    handlers.getStatus,
  );

  server.registerTool(
    "fabroku_get_runtime_logs",
    {
      title: "Consultar logs runtime",
      description: "Obtém as últimas linhas dos logs do container, com dados sensíveis mascarados.",
      inputSchema: {
        app: appReferenceSchema,
        lines: z.number().int().min(1).max(200).default(100),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    handlers.getRuntimeLogs,
  );

  server.registerTool(
    "fabroku_redeploy",
    {
      title: "Executar redeploy Fabroku",
      description: "Executa redeploy do código que já está no repositório remoto. Antes de usar, teste as alterações, faça git commit e git push. Esta ferramenta não cria commit nem envia código local.",
      inputSchema: {
        app: appReferenceSchema,
        confirmed_committed_and_pushed: z.boolean().describe(
          "Confirme somente após testar, executar git commit e git push para a branch remota do app.",
        ),
        wait: z.boolean().default(true).describe("Aguardar a conclusão da tarefa."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    handlers.redeploy,
  );

  server.registerTool(
    "fabroku_run_migrate",
    {
      title: "Executar migrations Django",
      description: "Executa Django migrate no app usando um caminho de manage.py validado pelo backend.",
      inputSchema: {
        app: appReferenceSchema,
        manage_path: z.string().min(1).default("manage.py"),
        noinput: z.boolean().default(true),
        wait: z.boolean().default(true).describe("Aguardar a conclusão da tarefa."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    handlers.runMigrate,
  );

  return server;
}

export async function startMcpServer(options = {}) {
  const server = createFabrokuMcpServer(options);
  const transport = new StdioServerTransport();
  const diagnostics = createMcpDiagnostics();
  server.onerror = diagnostics.report;
  process.stdin.resume();
  await server.connect(transport);
  return server;
}

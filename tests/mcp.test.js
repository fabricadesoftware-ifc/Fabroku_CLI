import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createFabrokuMcpServer, FABROKU_MCP_INSTRUCTIONS } from "../lib/mcp/server.js";
import { createFabrokuToolHandlers, redactText } from "../lib/mcp/tools.js";

function createFakeApi(overrides = {}) {
  return {
    async listProjects() {
      return { results: [{ id: "project-1", name: "Projeto", users: [1, 2] }] };
    },
    async listApps() {
      return {
        results: [{
          id: 7,
          name: "api-demo",
          status: "RUNNING",
          project: "project-1",
          variables: {
            DATABASE_URL: "postgres://user:password@database:5432/app",
            SECRET_KEY: "super-secret",
          },
        }],
      };
    },
    async getApp() {
      return (await this.listApps()).results[0];
    },
    async listServices() {
      return { results: [] };
    },
    async getAppStatus() {
      return { task_id: "task-1", state: "SUCCESS", status: "Concluído", current: 100 };
    },
    async getRuntimeLogs() {
      return { lines: ["DATABASE_URL=postgres://user:password@database:5432/app"] };
    },
    async redeployApp() {
      return { task_id: "task-1", status: "DEPLOYING" };
    },
    async runMigrate() {
      return { task_id: "task-1", status: "RUNNING" };
    },
    ...overrides,
  };
}

function resultJson(result) {
  return JSON.parse(result.content[0].text);
}

test("MCP negotiates and exposes only the intended tools", async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createFabrokuMcpServer({
    api: createFakeApi(),
    authenticated: () => true,
    version: "test",
  });
  const client = new Client({ name: "fabroku-test", version: "test" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  try {
    const response = await client.listTools();
    assert.deepEqual(
      response.tools.map((tool) => tool.name).sort(),
      [
        "fabroku_get_app",
        "fabroku_get_runtime_logs",
        "fabroku_get_status",
        "fabroku_list_apps",
        "fabroku_list_projects",
        "fabroku_list_services",
        "fabroku_redeploy",
        "fabroku_run_migrate",
      ],
    );

    const redeploy = response.tools.find((tool) => tool.name === "fabroku_redeploy");
    assert.match(redeploy.description, /git commit/i);
    assert.match(redeploy.description, /git push/i);
    assert.match(FABROKU_MCP_INSTRUCTIONS, /repositório remoto/i);

    const appsResult = await client.callTool({
      name: "fabroku_list_apps",
      arguments: {},
    });
    assert.equal(appsResult.isError, undefined);
    assert.doesNotMatch(appsResult.content[0].text, /super-secret|password@database/);
  } finally {
    await client.close();
    await server.close();
  }
});

test("fabroku mcp starts through stdio without corrupting protocol output", async () => {
  const configDirectory = mkdtempSync(join(tmpdir(), "fabroku-mcp-test-"));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["bin/fabroku.js", "mcp"],
    cwd: process.cwd(),
    env: { FABROKU_CONFIG_DIR: configDirectory },
    stderr: "pipe",
  });
  const client = new Client({ name: "fabroku-stdio-test", version: "test" });

  await client.connect(transport);
  try {
    const response = await client.listTools();
    assert.ok(response.tools.some((tool) => tool.name === "fabroku_redeploy"));
  } finally {
    await client.close();
    rmSync(configDirectory, { recursive: true, force: true });
  }
});

test("list apps exposes environment names but never values", async () => {
  const handlers = createFabrokuToolHandlers({
    api: createFakeApi(),
    authenticated: () => true,
  });

  const result = await handlers.listApps({});
  const payload = resultJson(result);

  assert.deepEqual(payload.apps[0].environment_keys, ["DATABASE_URL", "SECRET_KEY"]);
  assert.doesNotMatch(result.content[0].text, /super-secret|password@database/);
  assert.equal(payload.apps[0].variables, undefined);
});

test("runtime logs redact credentials and sensitive assignments", async () => {
  const handlers = createFabrokuToolHandlers({
    api: createFakeApi(),
    authenticated: () => true,
  });

  const result = await handlers.getRuntimeLogs({ app: "api-demo", lines: 20 });

  assert.doesNotMatch(result.content[0].text, /password@database/);
  assert.match(result.content[0].text, /DATABASE_URL=\*\*\*/);
  assert.equal(redactText("TOKEN=abc123"), "TOKEN=***");
});

test("tools return a login instruction instead of starting unauthenticated calls", async () => {
  let called = false;
  const handlers = createFabrokuToolHandlers({
    api: createFakeApi({
      async listApps() {
        called = true;
        return { results: [] };
      },
    }),
    authenticated: () => false,
  });

  const result = await handlers.listApps({});

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /fabroku login/);
  assert.equal(called, false);
});

test("redeploy is blocked until commit and push are explicitly confirmed", async () => {
  let redeployCalls = 0;
  const handlers = createFabrokuToolHandlers({
    api: createFakeApi({
      async redeployApp() {
        redeployCalls += 1;
        return { task_id: "task-1" };
      },
    }),
    authenticated: () => true,
  });

  const result = await handlers.redeploy({
    app: "api-demo",
    confirmed_committed_and_pushed: false,
  });

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /git commit/);
  assert.match(result.content[0].text, /git push/);
  assert.equal(redeployCalls, 0);
});

test("confirmed redeploy waits for the matching task", async () => {
  let statusCalls = 0;
  const handlers = createFabrokuToolHandlers({
    api: createFakeApi({
      async getAppStatus() {
        statusCalls += 1;
        return statusCalls === 1
          ? { task_id: "deploy-1", state: "PROGRESS", current: 50 }
          : { task_id: "deploy-1", state: "SUCCESS", current: 100 };
      },
      async redeployApp() {
        return { task_id: "deploy-1", status: "DEPLOYING" };
      },
    }),
    authenticated: () => true,
    sleep: async () => {},
    maxPolls: 3,
  });

  const result = await handlers.redeploy({
    app: "api-demo",
    confirmed_committed_and_pushed: true,
    wait: true,
  });

  assert.equal(result.isError, undefined);
  assert.equal(resultJson(result).task.state, "SUCCESS");
  assert.equal(statusCalls, 2);
});

test("migrate sends validated options and reports backend failure", async () => {
  let requestBody;
  const handlers = createFabrokuToolHandlers({
    api: createFakeApi({
      async runMigrate(_appId, body) {
        requestBody = body;
        return { task_id: "migrate-1", status: "RUNNING" };
      },
      async getAppStatus() {
        return { task_id: "migrate-1", state: "FAILURE", status: "Migration failed" };
      },
    }),
    authenticated: () => true,
    sleep: async () => {},
  });

  const result = await handlers.runMigrate({
    app: "api-demo",
    manage_path: "src/manage.py",
    noinput: true,
    wait: true,
  });

  assert.deepEqual(requestBody, { manage_path: "src/manage.py", noinput: true });
  assert.equal(result.isError, true);
  assert.equal(resultJson(result).task.state, "FAILURE");
});

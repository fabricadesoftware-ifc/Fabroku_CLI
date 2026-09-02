import test from "node:test";
import assert from "node:assert/strict";

import { createAppGateway } from "../../lib/application/gateways/app-gateway.js";
import { createProjectGateway } from "../../lib/application/gateways/project-gateway.js";
import { createServiceGateway } from "../../lib/application/gateways/service-gateway.js";

test("AppGateway delega listagem e operações de app", async () => {
  const calls = [];
  const gateway = createAppGateway({
    listApps: async () => { calls.push("list"); return { results: [{ id: 1 }] }; },
    getApp: async (id) => { calls.push(["get", id]); return { id }; },
  });

  assert.deepEqual(await gateway.list(), { results: [{ id: 1 }] });
  assert.deepEqual(await gateway.get(1), { id: 1 });
  assert.deepEqual(calls, ["list", ["get", 1]]);
});

test("ProjectGateway e ServiceGateway mantêm filtros no gateway", async () => {
  let filters;
  const project = createProjectGateway({ listProjects: async () => ({ results: [] }) });
  const service = createServiceGateway({ listServices: async (value) => { filters = value; return { results: [] }; } });

  assert.deepEqual(await project.list(), { results: [] });
  await service.list({ app: 7, project: 2 });
  assert.deepEqual(filters, { app: 7, project: 2 });
});

import test from "node:test";
import assert from "node:assert/strict";

import { ApplicationError, classifyApiError } from "../../lib/domain/errors.js";
import { resolveAppReference } from "../../lib/application/apps/resolve-app-reference.js";
import { waitForTask } from "../../lib/application/tasks/wait-for-task.js";

test("ApplicationError keeps a stable kind and cause", () => {
  const cause = new Error("network down");
  const error = new ApplicationError("Falha de rede", {
    kind: "network",
    statusCode: 503,
    cause,
  });

  assert.equal(error.name, "ApplicationError");
  assert.equal(error.kind, "network");
  assert.equal(error.statusCode, 503);
  assert.equal(error.cause, cause);
});

test("classifyApiError maps unauthorized API errors to authentication", () => {
  const error = classifyApiError({ statusCode: 401, detail: "expired" });

  assert.equal(error.kind, "authentication");
  assert.equal(error.statusCode, 401);
  assert.equal(error.message, "expired");
});

test("resolveAppReference resolves an app by name or id", () => {
  const apps = [{ id: 7, name: "api-demo" }, { id: 8, name: "web-demo" }];

  assert.deepEqual(resolveAppReference(apps, "api-demo"), apps[0]);
  assert.deepEqual(resolveAppReference(apps, 8), apps[1]);
});

test("resolveAppReference reports an unknown app without process exit", () => {
  assert.throws(
    () => resolveAppReference([], "missing"),
    (error) => error.kind === "not-found" && /missing/.test(error.message),
  );
});

test("waitForTask returns success after transient status updates", async () => {
  const statuses = [
    { task_id: "task-1", state: "PROGRESS", current: 30 },
    { task_id: "task-1", state: "SUCCESS", current: 100 },
  ];
  const result = await waitForTask({
    getStatus: async () => statuses.shift(),
    taskId: "task-1",
    sleep: async () => {},
    maxPolls: 3,
    onStatus: (status) => status.current,
  });

  assert.equal(result.success, true);
  assert.equal(result.status.state, "SUCCESS");
});

test("waitForTask rejects when another task replaces the expected task", async () => {
  let attempts = 0;
  await assert.rejects(
    () => waitForTask({
      getStatus: async () => {
        attempts += 1;
        return { task_id: "task-2", state: "PROGRESS" };
      },
      taskId: "task-1",
      sleep: async () => {},
      maxPolls: 5,
    }),
    /outra tarefa/,
  );
  assert.equal(attempts, 1);
});

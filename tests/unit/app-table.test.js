import test from "node:test";
import assert from "node:assert/strict";

import { renderAppsTable } from "../../lib/presentation/renderers/app-table.js";

test("renderer de apps mantém cabeçalho, status e total", () => {
  const output = renderAppsTable([
    { id: 7, name: "api", status: "RUNNING", domain: "api.test", project: 2 },
  ]);

  assert.match(output, /ID/);
  assert.match(output, /api/);
  assert.match(output, /Running/);
  assert.match(output, /Total: 1 app\(s\)/);
});

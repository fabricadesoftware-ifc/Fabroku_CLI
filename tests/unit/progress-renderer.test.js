import test from "node:test";
import assert from "node:assert/strict";

import { renderProgress } from "../../lib/presentation/renderers/progress.js";

test("renderer de progresso limita mensagem e mantém percentual", () => {
  const output = renderProgress({ current: 42, status: "x".repeat(80) });
  assert.match(output, /42%/);
  assert.match(output, /…/);
  assert.doesNotMatch(output, /x{51}/);
});

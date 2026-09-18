import test from "node:test";
import assert from "node:assert/strict";

import { renderVerification } from "../../lib/presentation/renderers/verification.js";

test("renderer de verify apresenta arquivos e resumo sem conhecer filesystem", () => {
  const output = renderVerification({
    dir: "/tmp/app",
    type: "backend",
    fix: false,
    result: {
      files: [
        { filename: "Procfile", present: true, info: { content: null } },
        { filename: "requirements.txt", present: false, info: { content: null } },
      ],
      missing: 1,
      fixed: 0,
      remaining: 1,
    },
  });

  assert.match(output, /Procfile/);
  assert.match(output, /requirements\.txt/);
  assert.match(output, /1 arquivo/);
});

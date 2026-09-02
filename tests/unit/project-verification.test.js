import test from "node:test";
import assert from "node:assert/strict";

import {
  detectProjectType,
  verifyRequiredFiles,
} from "../../lib/domain/verification/project-verification.js";

test("detectProjectType identifies a Node-backed project as backend", () => {
  const files = new Map([["package.json", "{}"], ["Procfile", "web: npm start"]]);

  assert.equal(
    detectProjectType({
      exists: (path) => files.has(path),
      read: (path) => files.get(path),
    }),
    "backend",
  );
});

test("detectProjectType identifies Python markers as backend", () => {
  assert.equal(
    detectProjectType({ exists: (path) => path === "manage.py", read: () => "" }),
    "backend",
  );
});

test("verifyRequiredFiles reports missing files and generated files separately", () => {
  const written = [];
  const result = verifyRequiredFiles("frontend", {
    exists: (path) => path === ".static",
    write: (path, content) => written.push({ path, content }),
    fix: true,
  });

  assert.equal(result.missing, 2);
  assert.equal(result.fixed, 2);
  assert.equal(result.remaining, 0);
  assert.deepEqual(written.map((item) => item.path), [".buildpacks", "static.json"]);
});

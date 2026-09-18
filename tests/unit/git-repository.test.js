import test from "node:test";
import assert from "node:assert/strict";

import { normalizeGitUrl, findAppByGitUrl } from "../../lib/domain/git/git-url.js";

test("normaliza formatos equivalentes de remote GitHub", () => {
  assert.equal(
    normalizeGitUrl("git@github.com:fabricadesoftware-ifc/Fabroku.git"),
    "github.com/fabricadesoftware-ifc/fabroku",
  );
  assert.equal(
    normalizeGitUrl("https://github.com/fabricadesoftware-ifc/Fabroku/"),
    "github.com/fabricadesoftware-ifc/fabroku",
  );
});

test("encontra app pelo remote normalizado", () => {
  const app = findAppByGitUrl([
    { id: 1, git: "https://github.com/org/app.git" },
  ], "git@github.com:org/app.git");

  assert.equal(app.id, 1);
});

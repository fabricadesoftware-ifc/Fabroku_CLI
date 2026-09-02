import test from "node:test";
import assert from "node:assert/strict";

import { fetchPaginated } from "../../lib/application/pagination/fetch-paginated.js";

test("fetchPaginated agrega páginas e normaliza next/previous", async () => {
  const pages = new Map([
    ["/items", { results: [{ id: 1 }], next: "https://api.test/items?page=2", previous: null }],
    ["/items?page=2", { results: [{ id: 2 }], next: null, previous: "/items" }],
  ]);

  const result = await fetchPaginated({
    path: "/items",
    get: async (path) => pages.get(path),
    resolvePath: (path) => path.startsWith("http") ? new URL(path).pathname + new URL(path).search : path,
    createCycleError: () => new Error("cycle"),
  });

  assert.deepEqual(result.results, [{ id: 1 }, { id: 2 }]);
  assert.equal(result.next, null);
  assert.equal(result.previous, null);
});

test("fetchPaginated falha ao detectar ciclo", async () => {
  await assert.rejects(
    () => fetchPaginated({
      path: "/items",
      get: async () => ({ results: [{ id: 1 }], next: "/items" }),
      resolvePath: (path) => path,
      createCycleError: () => new Error("cycle"),
    }),
    /cycle/,
  );
});

#!/usr/bin/env node
/** Compila tui/ (TSX) para lib/tui/index.js. Roda no `npm test` e antes de publicar (prepack). */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [join(root, "tui", "index.ts")],
  outfile: join(root, "lib", "tui", "index.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  jsx: "automatic",
  tsconfig: join(root, "tui", "tsconfig.json"), // resolve os imports "@/..."
  // Dependências de runtime ficam no node_modules (package.json "dependencies").
  external: ["ink", "react", "react/jsx-runtime", "cli-spinners", "string-width"],
  logLevel: "warning",
});
console.log("tui compilada em lib/tui/index.js");

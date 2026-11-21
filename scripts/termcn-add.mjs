#!/usr/bin/env node
/**
 * Copia componentes do termcn (https://termcn.dev) para tui/, no estilo shadcn:
 * o código passa a ser nosso e pode ser editado. Resolve as dependências do
 * registry recursivamente.
 *
 *   node scripts/termcn-add.mjs ink/spinner ink/table ...
 *   node scripts/termcn-add.mjs --themes        # todos os temas ink/theme-*
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://termcn.dev/r/";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "tui");

const seen = new Set();
const npmDeps = new Set();

function destino(file) {
  if (file.target) return file.target;
  return file.path
    .replace(/^registry\/ui\//, "components/ui/")
    .replace(/^registry\/hooks\//, "hooks/")
    .replace(/^registry\/lib\//, "lib/")
    .replace(/^registry\/providers\//, "providers/")
    .replace(/^registry\/themes\//, "lib/terminal-themes/");
}

async function buscar(nome) {
  if (seen.has(nome)) return;
  seen.add(nome);
  const res = await fetch(`${BASE}${nome}.json`);
  if (!res.ok) throw new Error(`${nome}: HTTP ${res.status}`);
  const item = await res.json();
  for (const dep of item.dependencies ?? []) npmDeps.add(dep);
  for (const file of item.files ?? []) {
    const alvo = join(ROOT, destino(file));
    mkdirSync(dirname(alvo), { recursive: true });
    writeFileSync(alvo, file.content);
  }
  for (const reg of item.registryDependencies ?? []) {
    await buscar(reg.replace(BASE, "").replace(/\.json$/, ""));
  }
}

let nomes = process.argv.slice(2);
if (nomes.includes("--themes")) {
  const indice = await (await fetch(`${BASE}registry.json`)).json();
  const temas = indice.items
    .map((i) => i.name)
    .filter((n) => n.startsWith("ink/theme-") && n !== "ink/theme-provider");
  nomes = nomes.filter((n) => n !== "--themes").concat(temas);
}
for (const nome of nomes) await buscar(nome);
console.log(`${seen.size} itens copiados para tui/`);
console.log(`dependências npm: ${[...npmDeps].sort().join(", ")}`);

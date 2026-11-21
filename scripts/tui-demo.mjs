#!/usr/bin/env node
/**
 * Mostra as telas da interface rica com dados de exemplo (não chama a API).
 *   node scripts/tui-demo.mjs apps|deploy|deploy-erro [tema]
 */
import { getUiSettings } from "../lib/ui.js";

const tui = await import("../lib/tui/index.js");
const [tela = "deploy", tema] = process.argv.slice(2);
const settings = { ...getUiSettings(), ...(tema ? { tema } : {}) };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const apps = [
  { id: 240, name: "galeria-s3", status: "RUNNING", domain: "galeria-s3.class.fabricadesoftware.ifc.edu.br", project: "574d6fa9-3272" },
  { id: 231, name: "portal-api", status: "DEPLOYING", domain: "portal-api.class.fabricadesoftware.ifc.edu.br", project: "a1b2c3d4-0000" },
  { id: 198, name: "feira-de-ciencias-frontend-2026", status: "ERROR", domain: null, project: "a1b2c3d4-0000" },
  { id: 120, name: "estagios", status: "STOPPED", domain: "estagios.class.fabricadesoftware.ifc.edu.br", project: "ffee0011-2222" },
];

if (tela === "apps") {
  await tui.renderApps(apps, settings);
} else {
  const view = tui.startDeployView(settings, [
    { id: "app", label: "Localizar o app" },
    { id: "verify", label: "Verificar arquivos de deploy" },
    { id: "trigger", label: "Disparar o deploy" },
    { id: "build", label: "Build e publicação" },
  ]);
  view.step("app", "rodando");
  view.header({ repo: "https://github.com/jonatasperaza/fabroku-s3-demo", branch: "main" });
  await esperar(700);
  view.header({ app: "galeria-s3 (running)" });
  view.step("app", "ok", "galeria-s3");
  view.step("verify", "rodando");
  await esperar(700);
  view.step("verify", "ok");
  view.step("trigger", "rodando");
  await esperar(500);
  view.step("trigger", "ok", "task 6a6b880f");
  view.step("build", "rodando");
  const etapas = ["Clonando o repositório", "Instalando dependências", "Construindo a imagem", "Liberando a nova versão"];
  for (let p = 0; p <= 100; p += 5) {
    view.progress(p, etapas[Math.min(etapas.length - 1, Math.floor(p / 26))]);
    await esperar(120);
    if (tela === "deploy-erro" && p === 60) {
      view.step("build", "erro");
      await view.finish({ ok: false, title: "Deploy falhou", message: "ModuleNotFoundError: No module named 'storages'" });
      process.exit(1);
    }
  }
  view.step("build", "ok");
  await view.finish({ ok: true, title: "Deploy concluído", url: "https://galeria-s3.class.fabricadesoftware.ifc.edu.br" });
}

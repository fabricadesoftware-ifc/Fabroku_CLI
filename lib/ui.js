/**
 * Preferências de interface (~/.fabroku/config.json, chave "ui") e decisão de quando
 * usar a interface rica (Ink + termcn) ou o texto simples de sempre.
 *
 * Texto simples quando: não há terminal (pipe, redirecionamento, IA rodando o comando),
 * CI, TERM=dumb, `interface: simples`, ou FABROKU_UI=simples.
 * O servidor MCP nunca usa a interface rica: o stdout dele é do protocolo.
 */
import { loadConfig, saveConfig } from "./config.js";

export const DEFAULT_UI = Object.freeze({
  tema: "fabroku",
  interface: "auto",
  animacoes: true,
  unicode: "auto",
});

export const UI_KEYS = {
  tema: "nome do tema (veja `fabroku config temas`)",
  interface: "auto | rica | simples",
  animacoes: "true | false",
  unicode: "auto | sim | nao",
};

export function getUiSettings() {
  return { ...DEFAULT_UI, ...(loadConfig().ui ?? {}) };
}

export function saveUiSettings(ui) {
  const config = loadConfig();
  config.ui = { ...DEFAULT_UI, ...ui };
  saveConfig(config);
}

export function wantsRichUi(settings = getUiSettings()) {
  const modo = (process.env.FABROKU_UI || settings.interface || "auto").toLowerCase();
  if (modo === "simples" || modo === "plain") return false;
  const terminal = Boolean(process.stdout.isTTY) && process.env.TERM !== "dumb";
  if (!terminal) return false;
  if (modo === "rica") return true;
  return !process.env.CI;
}

let tuiPromise;

/** Carrega a interface rica (lib/tui, compilada). Devolve null se não der (Node antigo, build ausente). */
export function loadTui() {
  tuiPromise ??= import("./tui/index.js").catch(() => null);
  return tuiPromise;
}

/** A interface rica, se ela deve ser usada agora; senão null. */
export async function richUi() {
  const settings = getUiSettings();
  if (!wantsRichUi(settings)) return null;
  const tui = await loadTui();
  return tui ? { tui, settings } : null;
}

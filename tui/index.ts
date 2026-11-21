/**
 * Interface rica da CLI (Ink + componentes do termcn). Compilada para lib/tui/index.js
 * por scripts/build-tui.mjs e carregada só quando há terminal de verdade (ver lib/ui.js).
 */
export { renderApps } from "@/apps";
export { runConfigUi } from "@/config";
export { startDeployView } from "@/deploy";
export type { UiSettings } from "@/shell";
export { themeNames } from "@/themes";

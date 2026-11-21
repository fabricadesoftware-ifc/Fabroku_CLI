// Gerado a partir de tui/lib/terminal-themes (node scripts/... ou à mão ao adicionar tema).
import type { Theme } from "@/components/ui/types";
import { amoledTheme } from "@/lib/terminal-themes/amoled";
import { auraTheme } from "@/lib/terminal-themes/aura";
import { ayuTheme } from "@/lib/terminal-themes/ayu";
import { carbonfoxTheme } from "@/lib/terminal-themes/carbonfox";
import { catppuccinFrappeTheme } from "@/lib/terminal-themes/catppuccin-frappe";
import { catppuccinMacchiatoTheme } from "@/lib/terminal-themes/catppuccin-macchiato";
import { catppuccinTheme } from "@/lib/terminal-themes/catppuccin";
import { cobalt2Theme } from "@/lib/terminal-themes/cobalt2";
import { cursorTheme } from "@/lib/terminal-themes/cursor";
import { defaultTheme } from "@/lib/terminal-themes/default";
import { draculaTheme } from "@/lib/terminal-themes/dracula";
import { everforestTheme } from "@/lib/terminal-themes/everforest";
import { fabrokuTheme } from "@/lib/terminal-themes/fabroku";
import { flexokiTheme } from "@/lib/terminal-themes/flexoki";
import { githubTheme } from "@/lib/terminal-themes/github";
import { gruvboxTheme } from "@/lib/terminal-themes/gruvbox";
import { highContrastLightTheme } from "@/lib/terminal-themes/high-contrast-light";
import { highContrastTheme } from "@/lib/terminal-themes/high-contrast";
import { kanagawaTheme } from "@/lib/terminal-themes/kanagawa";
import { lucentOrngTheme } from "@/lib/terminal-themes/lucent-orng";
import { materialTheme } from "@/lib/terminal-themes/material";
import { matrixTheme } from "@/lib/terminal-themes/matrix";
import { mercuryTheme } from "@/lib/terminal-themes/mercury";
import { monokaiTheme } from "@/lib/terminal-themes/monokai";
import { nightowlTheme } from "@/lib/terminal-themes/nightowl";
import { nordTheme } from "@/lib/terminal-themes/nord";
import { oc2Theme } from "@/lib/terminal-themes/oc-2";
import { oneDarkTheme } from "@/lib/terminal-themes/one-dark";
import { onedarkproTheme } from "@/lib/terminal-themes/onedarkpro";
import { opencodeTheme } from "@/lib/terminal-themes/opencode";
import { orngTheme } from "@/lib/terminal-themes/orng";
import { osakaJadeTheme } from "@/lib/terminal-themes/osaka-jade";
import { palenightTheme } from "@/lib/terminal-themes/palenight";
import { rosepineTheme } from "@/lib/terminal-themes/rosepine";
import { shadesofpurpleTheme } from "@/lib/terminal-themes/shadesofpurple";
import { solarizedTheme } from "@/lib/terminal-themes/solarized";
import { synthwave84Theme } from "@/lib/terminal-themes/synthwave84";
import { tokyoNightTheme } from "@/lib/terminal-themes/tokyo-night";
import { vercelTheme } from "@/lib/terminal-themes/vercel";
import { vesperTheme } from "@/lib/terminal-themes/vesper";
import { zenburnTheme } from "@/lib/terminal-themes/zenburn";

/** Temas por nome (o mesmo que aparece em `fabroku config`). */
export const THEMES: Record<string, Theme> = {
  "amoled": amoledTheme,
  "aura": auraTheme,
  "ayu": ayuTheme,
  "carbonfox": carbonfoxTheme,
  "catppuccin-frappe": catppuccinFrappeTheme,
  "catppuccin-macchiato": catppuccinMacchiatoTheme,
  "catppuccin": catppuccinTheme,
  "cobalt2": cobalt2Theme,
  "cursor": cursorTheme,
  "default": defaultTheme,
  "dracula": draculaTheme,
  "everforest": everforestTheme,
  "fabroku": fabrokuTheme,
  "flexoki": flexokiTheme,
  "github": githubTheme,
  "gruvbox": gruvboxTheme,
  "high-contrast-light": highContrastLightTheme,
  "high-contrast": highContrastTheme,
  "kanagawa": kanagawaTheme,
  "lucent-orng": lucentOrngTheme,
  "material": materialTheme,
  "matrix": matrixTheme,
  "mercury": mercuryTheme,
  "monokai": monokaiTheme,
  "nightowl": nightowlTheme,
  "nord": nordTheme,
  "oc-2": oc2Theme,
  "one-dark": oneDarkTheme,
  "onedarkpro": onedarkproTheme,
  "opencode": opencodeTheme,
  "orng": orngTheme,
  "osaka-jade": osakaJadeTheme,
  "palenight": palenightTheme,
  "rosepine": rosepineTheme,
  "shadesofpurple": shadesofpurpleTheme,
  "solarized": solarizedTheme,
  "synthwave84": synthwave84Theme,
  "tokyo-night": tokyoNightTheme,
  "vercel": vercelTheme,
  "vesper": vesperTheme,
  "zenburn": zenburnTheme,
};

export const DEFAULT_THEME = "fabroku";

export const themeNames = (): string[] => [DEFAULT_THEME, ...Object.keys(THEMES).filter((n) => n !== DEFAULT_THEME).sort()];

export const getTheme = (name?: string): Theme => THEMES[name ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME];

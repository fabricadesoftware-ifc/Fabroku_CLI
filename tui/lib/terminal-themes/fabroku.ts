import type { Theme } from "@/components/ui/types";

/** Tema padrão da CLI: as cores do painel e da logo do Fabroku (#4357E0, #7A89EA, #A997FF). */
export const fabrokuTheme: Theme = {
  border: {
    color: "#3D4470",
    focusColor: "#7A89EA",
    style: "round",
  },
  colors: {
    accent: "#A997FF",
    accentForeground: "#11142B",
    background: "#11142B",
    border: "#3D4470",
    error: "#F2667A",
    errorForeground: "#11142B",

    focusRing: "#7A89EA",
    foreground: "#E6E8F5",
    info: "#6FC3F7",
    infoForeground: "#11142B",
    muted: "#1C2042",
    mutedForeground: "#8A90B8",
    primary: "#7A89EA",
    primaryForeground: "#11142B",

    secondary: "#A997FF",
    secondaryForeground: "#11142B",
    selection: "#4357E0",
    selectionForeground: "#FFFFFF",
    success: "#5FD08A",

    successForeground: "#11142B",
    warning: "#F2B95F",
    warningForeground: "#11142B",
  },
  name: "fabroku",
  spacing: {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    6: 6,
    8: 8,
  },
  typography: {
    base: "",
    bold: true,
    lg: "bold",
    sm: "dim",
    xl: "bold",
  },
};

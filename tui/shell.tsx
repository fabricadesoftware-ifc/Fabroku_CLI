import type { ReactNode } from "react";

import { MotionProvider } from "@/providers/motion-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { UnicodeProvider } from "@/providers/unicode-provider";
import { getTheme } from "@/themes";

/** Preferências de interface, gravadas em ~/.fabroku/config.json (chave "ui"). */
export interface UiSettings {
  tema: string;
  interface: "auto" | "rica" | "simples";
  animacoes: boolean;
  unicode: "auto" | "sim" | "nao";
}

export const Shell = ({
  settings,
  themeOverride,
  children,
}: {
  settings: UiSettings;
  themeOverride?: string;
  children: ReactNode;
}) => (
  <ThemeProvider theme={getTheme(themeOverride ?? settings.tema)}>
    <UnicodeProvider
      unicode={settings.unicode === "auto" ? undefined : settings.unicode === "sim"}
    >
      <MotionProvider reducedMotion={!settings.animacoes}>{children}</MotionProvider>
    </UnicodeProvider>
  </ThemeProvider>
);

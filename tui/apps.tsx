import { Box, render, Text, useApp } from "ink";
import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";
import { useTheme } from "@/hooks/use-theme";
import { Shell, type UiSettings } from "@/shell";

interface AppItem {
  id: number | string;
  name?: string;
  status?: string;
  domain?: string | null;
  project?: string | number;
}

const STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  RUNNING: { label: "no ar", variant: "success" },
  STOPPED: { label: "parado", variant: "secondary" },
  ERROR: { label: "erro", variant: "error" },
  STARTING: { label: "subindo", variant: "warning" },
  RESTARTING: { label: "reiniciando", variant: "warning" },
  DEPLOYING: { label: "em deploy", variant: "info" },
  STOPPING: { label: "parando", variant: "warning" },
  DELETING: { label: "apagando", variant: "error" },
};

const SUFIXO = ".class.fabricadesoftware.ifc.edu.br";

const cortar = (texto: string, max: number) =>
  texto.length > max ? `${texto.slice(0, Math.max(1, max - 1))}…` : texto;

const AppsView = ({ apps, filtro }: { apps: AppItem[]; filtro?: string }) => {
  const { exit } = useApp();
  const theme = useTheme();
  useEffect(() => {
    exit();
  }, [exit]);

  // Cabe na largura do terminal: o domínio é a coluna que cede espaço.
  const largura = process.stdout.columns || 100;
  const larguraDominio = Math.max(12, largura - 4 - 6 - 26 - 14 - 12 - 12);
  const linhas = apps.map((a) => {
    const st = STATUS[a.status ?? "STOPPED"] ?? { label: String(a.status), variant: "default" };
    // Domínio inteiro quando cabe; senão some o sufixo padrão do Fabroku.
    const completo = a.domain ?? "-";
    const dominio =
      completo.length > larguraDominio && completo.endsWith(SUFIXO)
        ? `${completo.slice(0, -SUFIXO.length)}.class…`
        : completo;
    return {
      id: String(a.id),
      nome: cortar(a.name ?? "", 24),
      status: st.label,
      dominio: cortar(dominio, larguraDominio),
      projeto: String(a.project ?? "").slice(0, 8),
    };
  });

  const contagem = new Map<string, number>();
  for (const a of apps) {
    const s = a.status ?? "STOPPED";
    contagem.set(s, (contagem.get(s) ?? 0) + 1);
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Table
        aria-label="Apps"
        borderColor={theme.colors.border}
        columns={[
          { header: "ID", key: "id", align: "right" },
          { header: "Nome", key: "nome" },
          { header: "Status", key: "status" },
          { header: "Domínio", key: "dominio" },
          { header: "Projeto", key: "projeto" },
        ]}
        data={linhas}
        getRowKey={(row) => row.id}
      />
      <Box gap={1} marginTop={1}>
        <Text color={theme.colors.mutedForeground}>
          {apps.length} app(s){filtro ? ` no projeto ${filtro.slice(0, 8)}` : ""}:
        </Text>
        {[...contagem.entries()].map(([status, n]) => {
          const st = STATUS[status] ?? { label: status, variant: "default" as BadgeVariant };
          return (
            <Badge key={status} variant={st.variant}>
              {`${n} ${st.label}`}
            </Badge>
          );
        })}
      </Box>
    </Box>
  );
};

export async function renderApps(apps: AppItem[], settings: UiSettings, filtro?: string) {
  const instance = render(
    <Shell settings={settings}>
      <AppsView apps={apps} filtro={filtro} />
    </Shell>,
    { patchConsole: false },
  );
  await instance.waitUntilExit();
}

import { Box, render, Text, useApp, useInput } from "ink";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useTheme } from "@/hooks/use-theme";
import { Shell, type UiSettings } from "@/shell";
import { themeNames } from "@/themes";

const INTERFACES: UiSettings["interface"][] = ["auto", "rica", "simples"];
const UNICODES: UiSettings["unicode"][] = ["auto", "sim", "nao"];

const DESCRICAO = {
  interface: {
    auto: "rica no terminal, texto simples em pipes, CI e IA",
    rica: "sempre rica quando houver terminal",
    simples: "sempre texto simples, como antes",
  },
  unicode: { auto: "detecta pelo terminal", sim: "símbolos ✓ ● ╭─╮", nao: "só ASCII (+ - |)" },
} as const;

const proximo = <T,>(lista: T[], atual: T) => lista[(lista.indexOf(atual) + 1) % lista.length];

const Previa = () => {
  const theme = useTheme();
  return (
    <Box
      borderStyle="round"
      borderColor={theme.colors.border}
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      gap={1}
      width={50}
    >
      <Text bold color={theme.colors.primary}>
        Prévia · {theme.name}
      </Text>
      <Box gap={1}>
        <Badge bordered={false} variant="success">no ar</Badge>
        <Badge bordered={false} variant="info">em deploy</Badge>
        <Badge bordered={false} variant="warning">subindo</Badge>
        <Badge bordered={false} variant="error">erro</Badge>
      </Box>
      <Spinner label="Construindo a imagem..." />
      <ProgressBar value={64} width={24} showPercent />
      <Alert variant="success" title="Deploy concluído">
        https://meu-app.class.fabricadesoftware…
      </Alert>
    </Box>
  );
};

const ConfigView = ({
  inicial,
  onFim,
}: {
  inicial: UiSettings;
  onFim: (s: UiSettings | null) => void;
}) => {
  const { exit } = useApp();
  const [rascunho, setRascunho] = useState(inicial);
  const [tela, setTela] = useState<"menu" | "tema">("menu");
  const [temaPrevia, setTemaPrevia] = useState(inicial.tema);

  const sair = (salvar: boolean) => {
    onFim(salvar ? rascunho : null);
    exit();
  };

  useInput((_input, key) => {
    if (key.escape) {
      if (tela === "tema") {
        setTemaPrevia(rascunho.tema);
        setTela("menu");
      } else {
        sair(false);
      }
    }
  });

  return (
    <Shell settings={rascunho} themeOverride={temaPrevia}>
      <Box flexDirection="column" paddingY={1} gap={1}>
        <Text bold>Fabroku · configurações da CLI</Text>
        <Box gap={3}>
          <Box flexDirection="column" width={44}>
            {tela === "menu" ? (
              <Select
                key={JSON.stringify(rascunho)}
                autoFocus
                label="Escolha e aperte Enter"
                options={[
                  { value: "tema", label: "Tema", hint: rascunho.tema },
                  { value: "interface", label: "Interface", hint: rascunho.interface },
                  { value: "animacoes", label: "Animações", hint: rascunho.animacoes ? "ligadas" : "desligadas" },
                  { value: "unicode", label: "Símbolos", hint: rascunho.unicode },
                  { value: "salvar", label: "Salvar e sair" },
                  { value: "cancelar", label: "Sair sem salvar" },
                ]}
                onSubmit={(opcao) => {
                  if (opcao === "tema") setTela("tema");
                  else if (opcao === "interface")
                    setRascunho({ ...rascunho, interface: proximo(INTERFACES, rascunho.interface) });
                  else if (opcao === "animacoes") setRascunho({ ...rascunho, animacoes: !rascunho.animacoes });
                  else if (opcao === "unicode")
                    setRascunho({ ...rascunho, unicode: proximo(UNICODES, rascunho.unicode) });
                  else sair(opcao === "salvar");
                }}
              />
            ) : (
              <Select
                autoFocus
                label="Tema (↑↓ para ver, Enter escolhe, Esc volta)"
                maxVisible={12}
                defaultValue={rascunho.tema}
                options={themeNames().map((n) => ({ value: n, label: n, hint: n === "fabroku" ? "padrão" : undefined }))}
                onHighlight={(n) => setTemaPrevia(n)}
                onSubmit={(n) => {
                  setRascunho({ ...rascunho, tema: n });
                  setTemaPrevia(n);
                  setTela("menu");
                }}
              />
            )}
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>Interface: {DESCRICAO.interface[rascunho.interface]}</Text>
              <Text dimColor>Símbolos: {DESCRICAO.unicode[rascunho.unicode]}</Text>
            </Box>
          </Box>
          <Previa />
        </Box>
      </Box>
    </Shell>
  );
};

/** Abre a tela de configuração. Resolve com as novas preferências, ou null se cancelou. */
export async function runConfigUi(inicial: UiSettings): Promise<UiSettings | null> {
  let resultado: UiSettings | null = null;
  const instance = render(<ConfigView inicial={inicial} onFim={(s) => (resultado = s)} />);
  await instance.waitUntilExit();
  return resultado;
}

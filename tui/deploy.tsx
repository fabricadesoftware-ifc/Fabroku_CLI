import { Box, render, Text, useApp } from "ink";
import { useEffect, useSyncExternalStore } from "react";

import { Alert } from "@/components/ui/alert";
import { KeyValue } from "@/components/ui/key-value";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Spinner } from "@/components/ui/spinner";
import { useTheme } from "@/hooks/use-theme";
import { useUnicode } from "@/hooks/use-unicode";
import { Shell, type UiSettings } from "@/shell";

export type StepStatus = "pendente" | "rodando" | "ok" | "erro" | "pulado";

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

interface DeployState {
  header: { app?: string; repo?: string; branch?: string; status?: string };
  steps: Step[];
  progress?: { value: number; message: string };
  result?: { ok: boolean; title: string; message?: string; url?: string };
}

function createStore(initial: DeployState) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(update: (s: DeployState) => DeployState) {
      state = update(state);
      for (const l of listeners) l();
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

type Store = ReturnType<typeof createStore>;

const StepRow = ({ step }: { step: Step }) => {
  const theme = useTheme();
  const unicode = useUnicode();
  const icon = {
    ok: { char: unicode ? "✓" : "+", color: theme.colors.success },
    erro: { char: unicode ? "✗" : "x", color: theme.colors.error },
    pendente: { char: unicode ? "○" : "-", color: theme.colors.mutedForeground },
    pulado: { char: unicode ? "↷" : ">", color: theme.colors.mutedForeground },
  } as const;

  return (
    <Box gap={1}>
      {step.status === "rodando" ? (
        <Spinner label={step.label} />
      ) : (
        <>
          <Text color={icon[step.status].color}>{icon[step.status].char}</Text>
          <Text
            color={step.status === "pendente" ? theme.colors.mutedForeground : theme.colors.foreground}
          >
            {step.label}
          </Text>
        </>
      )}
      {step.detail && <Text color={theme.colors.mutedForeground}>{step.detail}</Text>}
    </Box>
  );
};

const DeployView = ({ store }: { store: Store }) => {
  const state = useSyncExternalStore(store.subscribe, store.get);
  const theme = useTheme();
  const { exit } = useApp();

  useEffect(() => {
    if (state.result) {
      // Um quadro com o resultado e encerra o Ink.
      const t = setTimeout(() => exit(), 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state.result, exit]);

  const { header } = state;
  const itens = [
    header.app && { key: "App", value: header.app },
    header.repo && { key: "Repositório", value: header.repo },
    header.branch && { key: "Branch", value: header.branch },
  ].filter(Boolean) as { key: string; value: string }[];

  return (
    <Box flexDirection="column" paddingY={1} gap={1}>
      <Text bold color={theme.colors.primary}>
        Fabroku · deploy
      </Text>
      {itens.length > 0 && <KeyValue items={itens} keyWidth={12} />}
      <Box flexDirection="column">
        {state.steps.map((s) => (
          <StepRow key={s.id} step={s} />
        ))}
      </Box>
      {state.progress && !state.result && (
        <Box flexDirection="column">
          <ProgressBar value={state.progress.value} width={30} showPercent />
          <Text color={theme.colors.mutedForeground}>{state.progress.message}</Text>
        </Box>
      )}
      {state.result && (
        <Alert variant={state.result.ok ? "success" : "error"} title={state.result.title}>
          {[state.result.message, state.result.url].filter(Boolean).join("\n")}
        </Alert>
      )}
    </Box>
  );
};

export function startDeployView(settings: UiSettings, steps: { id: string; label: string }[]) {
  const store = createStore({
    header: {},
    steps: steps.map((s) => ({ ...s, status: "pendente" as StepStatus })),
  });
  const instance = render(
    <Shell settings={settings}>
      <DeployView store={store} />
    </Shell>,
    { patchConsole: false },
  );

  return {
    header(h: DeployState["header"]) {
      store.set((s) => ({ ...s, header: { ...s.header, ...h } }));
    },
    step(id: string, status: StepStatus, detail?: string) {
      store.set((s) => ({
        ...s,
        steps: s.steps.map((st) => (st.id === id ? { ...st, status, detail } : st)),
      }));
    },
    progress(value: number, message: string) {
      store.set((s) => ({ ...s, progress: { value, message } }));
    },
    /** Mostra o resultado e espera o Ink terminar de desenhar. */
    async finish(result: NonNullable<DeployState["result"]>) {
      store.set((s) => ({ ...s, result }));
      await instance.waitUntilExit();
    },
  };
}

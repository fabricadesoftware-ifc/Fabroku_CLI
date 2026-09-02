import { ApplicationError } from "../../domain/errors.js";

const TERMINAL_FAILURE_STATES = new Set(["FAILURE", "REVOKED"]);

export async function waitForTask({
  getStatus,
  taskId,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  pollIntervalMs = 3000,
  maxPolls = 200,
  onStatus,
}) {
  let transientError;

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    try {
      const status = await getStatus();
      transientError = undefined;

      if (status?.task_id && taskId && status.task_id !== taskId) {
        throw new ApplicationError(
          "O app iniciou outra tarefa enquanto esta operação era acompanhada.",
          { kind: "conflict", details: { expectedTaskId: taskId, actualTaskId: status.task_id } },
        );
      }

      await onStatus?.(status);

      if (status?.state === "SUCCESS") return { success: true, status };
      if (TERMINAL_FAILURE_STATES.has(status?.state)) {
        return { success: false, status };
      }
    } catch (error) {
      if (error instanceof ApplicationError && error.kind === "conflict") throw error;
      transientError = error;
    }

    if (attempt < maxPolls - 1) await sleep(pollIntervalMs);
  }

  throw new ApplicationError("Tempo limite excedido ao aguardar a tarefa do Fabroku.", {
    kind: "timeout",
    cause: transientError,
  });
}

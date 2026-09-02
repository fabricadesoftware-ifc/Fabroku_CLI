export function createTerminalInputPump({
  stdin = process.stdin,
  sendInput,
  flushDelayMs = 20,
  onError = () => {},
}) {
  const previousRawMode = Boolean(stdin.isRaw);
  const canUseRawMode = stdin.isTTY && typeof stdin.setRawMode === "function";
  let pendingInput = "";
  let flushTimer = null;
  let sendChain = Promise.resolve();
  let stopped = false;
  let onCancel = null;

  async function flushNow() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!pendingInput || stopped) return sendChain;

    const data = pendingInput;
    pendingInput = "";
    sendChain = sendChain.catch(() => undefined).then(() => sendInput(data));
    return sendChain;
  }

  function scheduleFlush(force = false) {
    if (force) {
      void flushNow().catch(onError);
      return;
    }
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      void flushNow().catch(onError);
    }, flushDelayMs);
  }

  function onData(chunk) {
    if (stopped) return;
    const value = chunk.toString("utf8");
    if (value.includes("\u0003")) {
      if (onCancel) void onCancel();
      return;
    }

    pendingInput += value;
    scheduleFlush(value.includes("\r") || value.includes("\n"));
  }

  function start(cancelHandler) {
    onCancel = cancelHandler;
    stdin.resume();
    stdin.setEncoding?.("utf8");
    if (canUseRawMode) stdin.setRawMode(true);
    stdin.on("data", onData);
  }

  async function stop() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    await flushNow().catch(onError);
    stopped = true;
    stdin.removeListener("data", onData);
    if (canUseRawMode) stdin.setRawMode(previousRawMode);
    stdin.pause();
  }

  return { start, stop, flush: flushNow };
}

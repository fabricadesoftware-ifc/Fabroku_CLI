export function readSecretInput({ stdin = process.stdin, stdout = process.stdout, prompt = "" } = {}) {
  return new Promise((resolve, reject) => {
    const previousRawMode = Boolean(stdin.isRaw);
    let answer = "";
    let settled = false;

    stdout.write(prompt);
    stdin.resume();
    stdin.setEncoding?.("utf8");
    stdin.setRawMode?.(true);

    function cleanup() {
      stdin.removeListener("data", onData);
      stdin.setRawMode?.(previousRawMode);
      stdin.pause();
    }

    function finish(value, failed = false) {
      if (settled) return;
      settled = true;
      cleanup();
      stdout.write("\n");
      failed ? reject(value) : resolve(value);
    }

    function onData(chunk) {
      for (const char of chunk) {
        if (char === "\u0003") return finish(new Error("USER_CANCELLED"), true);
        if (char === "\r" || char === "\n") return finish(answer);
        if (char === "\u0008" || char === "\u007F") {
          answer = answer.slice(0, -1);
          continue;
        }
        if (char !== "\u001B") answer += char;
      }
    }

    stdin.on("data", onData);
  });
}

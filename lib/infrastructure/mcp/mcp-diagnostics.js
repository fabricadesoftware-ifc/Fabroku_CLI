export function createMcpDiagnostics({ stderr = process.stderr } = {}) {
  return {
    report(error) {
      const message = error instanceof Error ? error.message : String(error);
      stderr.write(`[fabroku:mcp] ${message}\n`);
    },
  };
}

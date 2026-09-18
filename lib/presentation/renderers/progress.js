import chalk from "chalk";

export function renderProgress({ current = 0, status = "", width = 20 } = {}) {
  const percent = Math.max(0, Math.min(100, Number(current) || 0));
  const filled = Math.round((percent / 100) * width);
  const bar = chalk.green("█".repeat(filled)) + chalk.dim("░".repeat(width - filled));
  const message = status.length > 50 ? `${status.slice(0, 50)}…` : status;
  return `[${bar}] ${String(percent).padStart(3)}%${message ? ` ${chalk.dim(message)}` : ""}`;
}

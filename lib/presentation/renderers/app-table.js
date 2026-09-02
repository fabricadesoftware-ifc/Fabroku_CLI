import chalk from "chalk";

const STATUS_COLORS = {
  RUNNING: "green",
  STOPPED: "red",
  ERROR: "red",
  STARTING: "yellow",
  DEPLOYING: "cyan",
  DELETING: "magenta",
  STOPPING: "yellow",
  RESTARTING: "blue",
};

export function renderAppsTable(appList) {
  const lines = [
    "",
    chalk.dim("ID".padEnd(6) + "Nome".padEnd(25) + "Status".padEnd(14) + "Domínio".padEnd(30) + "Projeto"),
    chalk.dim("─".repeat(85)),
  ];

  for (const app of appList) {
    const status = app.status || "STOPPED";
    const color = STATUS_COLORS[status] || "white";
    const statusText = status.charAt(0) + status.slice(1).toLowerCase();
    lines.push(
      String(app.id || "").padEnd(6)
      + (app.name || "").padEnd(25)
      + chalk[color](statusText.padEnd(14))
      + (app.domain || "-").padEnd(30)
      + String(app.project || ""),
    );
  }

  lines.push(`\n📦 Total: ${appList.length} app(s)\n`);
  return lines.join("\n");
}

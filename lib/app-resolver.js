import { execSync } from "node:child_process";

export function normalizeGitUrl(url = "") {
  return url
    .replace(/\.git$/, "")
    .replace(/\/$/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^git@github\.com:/, "github.com/")
    .toLowerCase();
}

export function getGitRemoteUrl(dir) {
  try {
    return execSync("git remote get-url origin", {
      cwd: dir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

export function getGitBranch(dir) {
  try {
    return execSync("git branch --show-current", {
      cwd: dir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

export function findAppByNameOrId(apps, appNameOrId) {
  return apps.find((app) => app.name === appNameOrId || String(app.id) === String(appNameOrId));
}

export function findAppByGitUrl(apps, gitUrl) {
  const normalizedLocal = normalizeGitUrl(gitUrl);
  return apps.find((app) => normalizeGitUrl(app.git) === normalizedLocal);
}

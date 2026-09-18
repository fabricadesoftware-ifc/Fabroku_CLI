import { execFileSync } from "node:child_process";

function runGit(args, dir) {
  try {
    return execFileSync("git", args, {
      cwd: dir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

export function createGitRepository() {
  return {
    getRemoteUrl(dir) {
      return runGit(["remote", "get-url", "origin"], dir);
    },
    getBranch(dir) {
      return runGit(["branch", "--show-current"], dir);
    },
  };
}

import { resolveAppReference } from "./application/apps/resolve-app-reference.js";
import { findAppByGitUrl as findAppByGitUrlDomain, normalizeGitUrl } from "./domain/git/git-url.js";
import { createGitRepository } from "./infrastructure/git/git-repository.js";

const gitRepository = createGitRepository();

export { normalizeGitUrl };

export function getGitRemoteUrl(dir) {
  return gitRepository.getRemoteUrl(dir);
}

export function getGitBranch(dir) {
  return gitRepository.getBranch(dir);
}

export function findAppByNameOrId(apps, appNameOrId) {
  try {
    return resolveAppReference(apps, appNameOrId);
  } catch {
    return undefined;
  }
}

export function findAppByGitUrl(apps, gitUrl) {
  return findAppByGitUrlDomain(apps, gitUrl);
}

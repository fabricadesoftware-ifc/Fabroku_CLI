export function normalizeGitUrl(url = "") {
  return url
    .replace(/\.git$/, "")
    .replace(/\/$/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^git@github\.com:/, "github.com/")
    .toLowerCase();
}

export function findAppByGitUrl(apps, gitUrl) {
  const normalizedLocal = normalizeGitUrl(gitUrl);
  return apps.find((app) => normalizeGitUrl(app.git) === normalizedLocal);
}

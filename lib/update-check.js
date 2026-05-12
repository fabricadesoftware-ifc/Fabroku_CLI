/**
 * Verificacao leve de atualizacao da CLI.
 *
 * O deploy.yml roda semantic-release, que calcula a proxima versao e atualiza
 * o package.json no pacote publicado. Por isso o binario deve ler a versao do
 * pacote instalado, nao manter uma segunda versao hardcoded.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import chalk from "chalk";

const PACKAGE_NAME = "fabroku";
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const CACHE_DIR = join(homedir(), ".fabroku");
const CACHE_FILE = join(CACHE_DIR, "update-check.json");
const SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 1500;

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function readCache() {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function writeCache(cache) {
  try {
    ensureCacheDir();
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    // Cache e so otimizacao; nao deve quebrar nenhum comando da CLI.
  }
}

function parseVersion(version) {
  const [core, prerelease = ""] = String(version || "").replace(/^v/, "").split("-");
  const parts = core.split(".").map((part) => Number.parseInt(part, 10) || 0);
  return { parts: [parts[0] || 0, parts[1] || 0, parts[2] || 0], prerelease };
}

export function compareVersions(leftVersion, rightVersion) {
  const left = parseVersion(leftVersion);
  const right = parseVersion(rightVersion);

  for (let index = 0; index < 3; index += 1) {
    if (left.parts[index] > right.parts[index]) return 1;
    if (left.parts[index] < right.parts[index]) return -1;
  }

  if (left.prerelease && !right.prerelease) return -1;
  if (!left.prerelease && right.prerelease) return 1;
  return left.prerelease.localeCompare(right.prerelease);
}

async function fetchLatestVersion() {
  const response = await fetch(REGISTRY_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`npm registry respondeu ${response.status}`);
  }

  const data = await response.json();
  return data.version;
}

async function getLatestVersion() {
  const cache = readCache();
  const now = Date.now();
  const cacheAge = cache?.checked_at ? now - cache.checked_at : Number.POSITIVE_INFINITY;
  const cacheTtl = cache?.latest_version ? SUCCESS_TTL_MS : FAILURE_TTL_MS;

  if (cache && cacheAge < cacheTtl) {
    return cache.latest_version || null;
  }

  try {
    const latestVersion = await fetchLatestVersion();
    writeCache({ checked_at: now, latest_version: latestVersion });
    return latestVersion;
  } catch {
    writeCache({ checked_at: now, latest_version: null });
    return null;
  }
}

export async function notifyIfUpdateAvailable(currentVersion) {
  if (process.env.FABROKU_SKIP_UPDATE_CHECK === "1") return;

  const latestVersion = await getLatestVersion();
  if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) return;

  console.log(chalk.yellow(`Atualizacao disponivel: fabroku ${latestVersion} (instalado: ${currentVersion}).`));
  console.log(chalk.yellow(`Atualize com: ${chalk.bold("npm i -g fabroku")}\n`));
}

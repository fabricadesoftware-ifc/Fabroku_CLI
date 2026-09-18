/**
 * Gerenciamento de configuração da CLI (~/.fabroku/config.json).
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { FileConfigStore } from "./infrastructure/config/file-config-store.js";

export const DEFAULT_CONFIG = {
  api_url: "https://fabroku-api.fabricadesoftware.ifc.edu.br",
  token: null,
  user: null,
};

export function getConfigDir() {
  return process.env.FABROKU_CONFIG_DIR || join(homedir(), ".fabroku");
}

export function getConfigStore() {
  return new FileConfigStore({ directory: getConfigDir(), defaults: DEFAULT_CONFIG });
}

export function loadConfig() {
  return getConfigStore().load();
}

export function saveConfig(config) {
  getConfigStore().save(config);
}

export function getToken() {
  return loadConfig().token;
}

export function getApiUrl() {
  return loadConfig().api_url || DEFAULT_CONFIG.api_url;
}

export function setCredentials(token, user, apiUrl) {
  const config = loadConfig();
  config.token = token;
  config.user = user;
  if (apiUrl) config.api_url = apiUrl;
  saveConfig(config);
}

export function clearCredentials() {
  const config = loadConfig();
  config.token = null;
  config.user = null;
  config.api_url = DEFAULT_CONFIG.api_url;
  saveConfig(config);
}

export function isAuthenticated() {
  return getToken() !== null;
}

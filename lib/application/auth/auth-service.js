import { ApplicationError } from "../../domain/errors.js";

const DEFAULT_PLATFORM_CONFIG = {
  privileged_role_label: "Membro da Fábrica",
};

export function createAuthService({ configStore, apiFactory, defaultApiUrl } = {}) {
  if (!configStore) throw new Error("AuthService exige um ConfigStore.");

  function getSession() {
    const config = configStore.load();
    return {
      apiUrl: config.api_url,
      token: config.token,
      user: config.user,
    };
  }

  return {
    getSession,
    isAuthenticated() {
      return getSession().token !== null;
    },
    setCredentials(token, user, apiUrl) {
      const config = configStore.load();
      config.token = token;
      config.user = user;
      if (apiUrl) config.api_url = apiUrl;
      configStore.save(config);
    },
    clearCredentials() {
      const config = configStore.load();
      config.token = null;
      config.user = null;
      if (defaultApiUrl) config.api_url = defaultApiUrl;
      configStore.save(config);
    },
    async whoAmI() {
      const session = getSession();
      if (!session.token) {
        throw new ApplicationError("A CLI não está autenticada.", {
          kind: "authentication",
        });
      }

      if (!apiFactory) throw new Error("AuthService exige um apiFactory para whoAmI.");
      const api = apiFactory(session);
      const platform = await api.getPlatformConfig().catch(() => DEFAULT_PLATFORM_CONFIG);
      const user = await api.getUserMe();
      return { session, platform, user };
    },
  };
}

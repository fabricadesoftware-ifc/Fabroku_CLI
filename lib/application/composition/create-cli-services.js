import { FabrokuAPI } from "../../api.js";
import { createAuthService } from "../auth/auth-service.js";
import { DEFAULT_CONFIG, getConfigStore } from "../../config.js";
import { createGateways } from "./create-gateways.js";

export function createCliServices(options = {}) {
  const configStore = options.configStore || getConfigStore();
  const apiFactory = options.apiFactory || ((session = {}) => new FabrokuAPI({
    baseUrl: session.apiUrl,
    token: session.token,
  }));

  const api = options.api || apiFactory();
  return {
    configStore,
    auth: options.auth || createAuthService({
      configStore,
      apiFactory,
      defaultApiUrl: DEFAULT_CONFIG.api_url,
    }),
    apiFactory,
    api,
    gateways: options.gateways || createGateways(api),
  };
}

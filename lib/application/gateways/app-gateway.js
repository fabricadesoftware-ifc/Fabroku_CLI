export function createAppGateway(api) {
  return {
    list: () => api.listApps(),
    get: (appId) => api.getApp(appId),
    status: (appId) => api.getAppStatus(appId),
    redeploy: (appId) => api.redeployApp(appId),
    runtimeLogs: (appId, lines) => api.getRuntimeLogs(appId, lines),
    runMigrate: (appId, body) => api.runMigrate(appId, body),
    runLoaddata: (appId, body) => api.runLoaddata(appId, body),
    runDumpdata: (appId, body) => api.runDumpdata(appId, body),
  };
}

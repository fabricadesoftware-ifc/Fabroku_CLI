export function createInteractiveSessionGateway(api) {
  return {
    create: (appId, body) => api.createInteractiveSession(appId, body),
    answer: (appId, sessionId, body) => api.answerInteractiveSession(appId, sessionId, body),
    input: (appId, sessionId, body) => api.inputInteractiveSession(appId, sessionId, body),
    cancel: (appId, sessionId) => api.cancelInteractiveSession(appId, sessionId),
    events: (appId, sessionId, options) => api.streamInteractiveSessionEvents(appId, sessionId, options),
    terminalEvents: (appId, sessionId, options) => api.streamInteractiveTerminalEvents(appId, sessionId, options),
  };
}

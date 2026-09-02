export function createProjectGateway(api) {
  return { list: () => api.listProjects() };
}

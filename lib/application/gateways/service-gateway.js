export function createServiceGateway(api) {
  return { list: (filters) => api.listServices(filters) };
}

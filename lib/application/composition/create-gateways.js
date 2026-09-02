import { createAppGateway } from "../gateways/app-gateway.js";
import { createProjectGateway } from "../gateways/project-gateway.js";
import { createServiceGateway } from "../gateways/service-gateway.js";

export function createGateways(api) {
  return {
    apps: createAppGateway(api),
    projects: createProjectGateway(api),
    services: createServiceGateway(api),
  };
}

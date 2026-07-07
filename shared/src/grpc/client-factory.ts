import * as grpc from "@grpc/grpc-js";
import { logger } from "@infrastructure/observability/logger";

const SERVICE_NAME = process.env.SERVICE_NAME ?? "unknown-service";
const clients = new Map<string, any>();

export function getGrpcClient(
  serviceName: string,
  ServiceClientCtor: any,
  hostEnvVar: string,
  portEnvVar: string
): any {
  if (clients.has(serviceName)) return clients.get(serviceName);

  const host = process.env[hostEnvVar];
  const port = process.env[portEnvVar];

  if (!host || !port) {
    throw new Error(`${hostEnvVar} and ${portEnvVar} must be set`);
  }

  const client = new ServiceClientCtor(
    `${host}:${port}`,
    grpc.credentials.createInsecure()
  );

  logger.debug(SERVICE_NAME, `Created gRPC client for ${serviceName}`, {
    target: `${host}:${port}`,
  });

  clients.set(serviceName, client);
  return client;
}

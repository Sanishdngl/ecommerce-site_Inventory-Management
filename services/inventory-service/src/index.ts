import "dotenv/config";
import "@infrastructure/observability/tracing";
import * as grpc from "@grpc/grpc-js";
import { testDbConnection } from "@infrastructure/database/mysql";
import { testRedisConnection } from "@infrastructure/redis/redis";
import { ensureProductBucket } from "./storage/rustfs";
import { startMetricsServer } from "@infrastructure/observability/metrics-server";
import { logger } from "@infrastructure/observability/logger";
import { createServer } from "./grpc/server";

const SERVICE_NAME = "inventory-service";
const PORT = parseInt(process.env.INVENTORY_SERVICE_PORT ?? "50052", 10);
const METRICS_PORT = parseInt(process.env.INVENTORY_METRICS_PORT ?? "9102", 10);

async function bootstrap(): Promise<void> {
  await testDbConnection();
  logger.info(SERVICE_NAME, "Database connected");

  await testRedisConnection();
  logger.info(SERVICE_NAME, "Redis connected");

  await ensureProductBucket();
  logger.info(SERVICE_NAME, "RustFS bucket ready");

  startMetricsServer(METRICS_PORT, SERVICE_NAME);

  const server = createServer();

  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        logger.error(SERVICE_NAME, "Failed to bind gRPC server", {
          error: err.message,
        });
        process.exit(1);
      }
      logger.info(SERVICE_NAME, `gRPC server running on port ${port}`);
    }
  );
}

bootstrap().catch((err) => {
  logger.error(SERVICE_NAME, "Bootstrap failed", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});

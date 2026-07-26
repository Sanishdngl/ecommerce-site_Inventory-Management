import "dotenv/config";
import "@infrastructure/observability/tracing";
import { startConsumer } from "@infrastructure/kafka/consumer";
import { startMetricsServer } from "@infrastructure/observability/metrics-server";
import { logger } from "@infrastructure/observability/logger";
import { handleInvalidationMessage, TOPICS } from "./consumers/invalidation";

const SERVICE_NAME = "cache-invalidation-service";
const CONSUMER_GROUP_ID = "cache-invalidation";
const METRICS_PORT = parseInt(
  process.env.CACHE_INVALIDATION_METRICS_PORT ?? "9106",
  10
);

async function bootstrap(): Promise<void> {
  startMetricsServer(METRICS_PORT, SERVICE_NAME);

  // No gRPC surface, same reasoning as search-indexer-service — health is
  // inferred from the metrics endpoint responding.
  await startConsumer(CONSUMER_GROUP_ID, TOPICS, handleInvalidationMessage);

  logger.info(SERVICE_NAME, "Cache invalidation service started", {
    topics: TOPICS,
  });
}

bootstrap().catch((err) => {
  logger.error(SERVICE_NAME, "Bootstrap failed", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});

import "dotenv/config";
import "@infrastructure/observability/tracing";
import { testEsConnection } from "./elasticsearch/client";
import { ensureProductIndex } from "./elasticsearch/setup-index";
import { connectIdempotencyStore } from "@infrastructure/kafka/idempotency";
import { startConsumer } from "@infrastructure/kafka/consumer";
import { startMetricsServer } from "@infrastructure/observability/metrics-server";
import { logger } from "@infrastructure/observability/logger";
import { handleIndexerMessage, TOPICS } from "./consumers/indexer";

const SERVICE_NAME = "search-indexer-service";
const CONSUMER_GROUP_ID = "search-indexer";
const METRICS_PORT = parseInt(process.env.SEARCH_INDEXER_METRICS_PORT ?? "9105", 10);

async function bootstrap(): Promise<void> {
  await testEsConnection();
  logger.info(SERVICE_NAME, "Elasticsearch connected");

  await ensureProductIndex();
  logger.info(SERVICE_NAME, "Elasticsearch product index ready");

  await connectIdempotencyStore();
  logger.info(SERVICE_NAME, "Idempotency store (Redis) connected");

  startMetricsServer(METRICS_PORT, SERVICE_NAME);

  // No gRPC server — this service has no synchronous API surface, it only
  // reacts to Kafka events. Health is inferred from the metrics endpoint
  // responding (see docker-compose healthcheck) rather than a dedicated
  // gRPC HealthCheck RPC like the other services expose.
  await startConsumer(CONSUMER_GROUP_ID, TOPICS, handleIndexerMessage);

  logger.info(SERVICE_NAME, "Search indexer service started", {
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

import { cacheDel, cacheDelPattern, CacheKey } from "@infrastructure/redis/redis";
import { logger } from "@infrastructure/observability/logger";
import type { OutboxMessage } from "@infrastructure/kafka/consumer";
import type {
  ProductEventPayload,
  StockEventPayload,
} from "@shared/types/events";

const SERVICE_NAME = "cache-invalidation-service";

export const TOPICS = ["inventory.product.events", "inventory.stock.events"];

interface Envelope<T> {
  event_id: string;
  event_type: string;
  occurred_at: string;
  payload: T;
}

// No idempotency/dedupe check here (unlike search-indexer-service and the
// eventual stock-reservation consumer) — deliberately, not an oversight.
// Redis DEL and the SCAN-based pattern delete in cacheDelPattern are
// naturally idempotent: invalidating an already-invalidated (or
// already-expired) key is a no-op. Double-processing costs a few wasted
// Redis calls, never incorrect behavior, so the extra dedupe-store
// round-trip isn't worth paying on every message here.
export async function handleInvalidationMessage(
  msg: OutboxMessage
): Promise<void> {
  if (msg.topic === "inventory.product.events") {
    await invalidateForProductEvent(
      msg.value as unknown as Envelope<ProductEventPayload>
    );
  } else if (msg.topic === "inventory.stock.events") {
    await invalidateForStockEvent(
      msg.value as unknown as Envelope<StockEventPayload>
    );
  } else {
    logger.warn(SERVICE_NAME, "Received message on unhandled topic", {
      topic: msg.topic,
    });
  }
}

async function invalidateForProductEvent(
  envelope: Envelope<ProductEventPayload>
): Promise<void> {
  const p = envelope.payload;

  await cacheDel(CacheKey.product(p.product_id));
  await Promise.all([
    cacheDelPattern(CacheKey.productListPattern(p.category_id)),
    cacheDelPattern(CacheKey.productListAllPattern()),
  ]);

  logger.info(SERVICE_NAME, "Invalidated cache for product event", {
    product_id: p.product_id,
    event_type: envelope.event_type,
  });
}

async function invalidateForStockEvent(
  envelope: Envelope<StockEventPayload>
): Promise<void> {
  const p = envelope.payload;

  // StockEventPayload doesn't carry category_id (see shared/src/types/events.ts),
  // so the category-scoped list cache can't be targeted directly here — only
  // the all-products list and the product/stock detail keys. Category list
  // caches have a 5min TTL (TTL.PRODUCT_LIST) regardless, so this is a bounded
  // staleness window, not an unbounded one.
  await cacheDel(CacheKey.stock(p.product_id), CacheKey.product(p.product_id));
  await cacheDelPattern(CacheKey.productListAllPattern());

  logger.info(SERVICE_NAME, "Invalidated cache for stock event", {
    product_id: p.product_id,
    event_type: envelope.event_type,
  });
}

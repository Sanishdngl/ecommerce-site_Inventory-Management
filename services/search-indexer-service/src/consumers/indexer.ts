import { getEsClient } from "../elasticsearch/client";
import { PRODUCT_INDEX } from "../elasticsearch/setup-index";
import { alreadyProcessed } from "@infrastructure/kafka/idempotency";
import { logger } from "@infrastructure/observability/logger";
import type { OutboxMessage } from "@infrastructure/kafka/consumer";
import type {
  ProductEventPayload,
  StockEventPayload,
} from "@shared/types/events";

const CONSUMER_NAME = "search-indexer";
const SERVICE_NAME = "search-indexer-service";

export const TOPICS = ["inventory.product.events", "inventory.stock.events"];

// Envelope shape written by writeOutboxEvent (infrastructure/database/outbox.ts):
// { event_id, event_type, occurred_at, payload: <business fields> }.
// msg.value here is that whole envelope, not the business payload directly.
interface Envelope<T> {
  event_id: string;
  event_type: string;
  occurred_at: string;
  payload: T;
}

export async function handleIndexerMessage(msg: OutboxMessage): Promise<void> {
  if (await alreadyProcessed(CONSUMER_NAME, msg.eventId)) {
    logger.info(SERVICE_NAME, "Skipping already-processed event", {
      event_id: msg.eventId,
      event_type: msg.eventType,
      topic: msg.topic,
    });
    return;
  }

  if (msg.topic === "inventory.product.events") {
    await indexProductEvent(msg.value as unknown as Envelope<ProductEventPayload>);
  } else if (msg.topic === "inventory.stock.events") {
    await indexStockEvent(msg.value as unknown as Envelope<StockEventPayload>);
  } else {
    // Shouldn't happen given TOPICS above, but don't silently drop an
    // unrecognized topic if the connector routing config ever changes.
    logger.warn(SERVICE_NAME, "Received message on unhandled topic", {
      topic: msg.topic,
    });
  }
}

async function indexProductEvent(
  envelope: Envelope<ProductEventPayload>
): Promise<void> {
  const p = envelope.payload;
  const es = getEsClient();

  // Product events carry a full snapshot of product fields (see
  // product.handlers.ts) but never stock_quantity — using a partial `doc`
  // update with doc_as_upsert preserves whatever stock_quantity a prior
  // stock event already set, instead of wiping it back to undefined.
  await es.update({
    index: PRODUCT_INDEX,
    id: p.product_id,
    doc: {
      product_id: p.product_id,
      category_id: p.category_id,
      name: p.name,
      description: p.description ?? null,
      price: parseFloat(p.price),
      is_active: p.is_active,
      thumbnail_url: p.thumbnail_url ?? null,
      list_image_url: p.list_image_url ?? null,
      indexed_at: new Date().toISOString(),
    },
    doc_as_upsert: true,
  });

  logger.info(SERVICE_NAME, "Indexed product event", {
    product_id: p.product_id,
    event_type: envelope.event_type,
  });
}

async function indexStockEvent(
  envelope: Envelope<StockEventPayload>
): Promise<void> {
  const p = envelope.payload;
  const es = getEsClient();

  await es.update({
    index: PRODUCT_INDEX,
    id: p.product_id,
    doc: {
      product_id: p.product_id,
      stock_quantity: p.resulting_stock,
      indexed_at: new Date().toISOString(),
    },
    doc_as_upsert: true,
  });

  logger.info(SERVICE_NAME, "Indexed stock event", {
    product_id: p.product_id,
    resulting_stock: p.resulting_stock,
    event_type: envelope.event_type,
  });
}

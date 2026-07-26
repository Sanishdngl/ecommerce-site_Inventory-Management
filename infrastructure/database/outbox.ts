import type { DbClient } from "./mysql";
import { generateId } from "@shared/utils/uuid";

export type AggregateType = "product" | "stock" | "order";

export interface OutboxEventInput {
  aggregate_type: AggregateType;
  aggregate_id: string;
  event_type: string; // e.g. "created" | "updated" | "stock_adjusted" | "placed"
  payload: Record<string, unknown>;
}

// Must be called with the SAME connection/transaction as the business write
// it represents — that's the entire point of the outbox pattern (atomicity
// without 2PC). Passing the pool directly instead of a transaction
// connection defeats this; callers should always pass the `conn` from
// withTransaction().
export async function writeOutboxEvent(
  db: DbClient,
  event: OutboxEventInput
): Promise<void> {
  const id = generateId();
  const now = new Date();

  // The `payload` column stores the full OutboxEnvelope (shared/src/types/events.ts),
  // not just the business payload — this is what Debezium relays to Kafka
  // verbatim (see infrastructure/kafka-connect/outbox-connector.json), so
  // consumers get event_id for idempotency dedupe without a second lookup.
  const envelope = {
    event_id: id,
    event_type: event.event_type,
    occurred_at: now.toISOString(),
    payload: event.payload,
  };

  await db.execute(
    `INSERT INTO outbox_events
       (id, aggregate_type, aggregate_id, event_type, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      event.aggregate_type,
      event.aggregate_id,
      event.event_type,
      JSON.stringify(envelope),
      now,
    ]
  );
}

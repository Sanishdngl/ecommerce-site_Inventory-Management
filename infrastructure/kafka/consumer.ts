import { Kafka, logLevel, type EachMessagePayload } from "kafkajs";
import { logger } from "@infrastructure/observability/logger";

const SERVICE_NAME = process.env.SERVICE_NAME ?? "unknown-service";

function getBrokers(): string[] {
  const brokers = process.env.KAFKA_BROKERS;
  if (!brokers) {
    throw new Error("Missing required KAFKA_BROKERS environment variable");
  }
  return brokers.split(",").map((b) => b.trim());
}

export interface OutboxMessage {
  eventId: string; // header "eventType" set by Debezium SMT; body carries the outbox payload columns
  eventType: string;
  topic: string;
  key: string | null;
  value: Record<string, unknown>;
}

// Parses the envelope Debezium's outbox EventRouter SMT produces: message
// key = aggregate_id, value = the outbox `payload` column (already JSON per
// the connector's JsonConverter config), eventType arrives as a header
// because of `table.fields.additional.placement=event_type:header:eventType`.
function parseMessage(
  topic: string,
  payload: EachMessagePayload["message"]
): OutboxMessage {
  const key = payload.key?.toString() ?? null;
  const value = payload.value ? JSON.parse(payload.value.toString()) : {};
  const eventType = payload.headers?.eventType?.toString() ?? "unknown";
  // event_id comes from the OutboxEnvelope written by writeOutboxEvent()
  // (infrastructure/database/outbox.ts) — the outbox row's own id, embedded
  // in the payload JSON so it survives the Debezium relay without a second
  // lookup. Falls back to the message key (aggregate_id) only if a producer
  // bypassed writeOutboxEvent — that fallback is NOT a valid per-event
  // dedupe key (it's per-aggregate, not per-event), so treat it as a sign
  // something upstream wrote the outbox row incorrectly, not a safe default.
  const eventId = (value.event_id as string) ?? key ?? "";
  return { eventId, eventType, topic, key, value };
}

// One consumer group per logical consumer (search-indexer, cache-invalidation).
// `onMessage` should be idempotent — see idempotency.ts.
export async function startConsumer(
  groupId: string,
  topics: string[],
  onMessage: (msg: OutboxMessage) => Promise<void>
): Promise<void> {
  const kafka = new Kafka({
    clientId: SERVICE_NAME,
    brokers: getBrokers(),
    logLevel: logLevel.ERROR, // winston logger below handles our own logging
  });

  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topics, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const parsed = parseMessage(topic, message);
      try {
        await onMessage(parsed);
      } catch (err) {
        // Don't swallow — let it surface in logs/metrics. kafkajs will not
        // auto-retry this message; a poison-message / DLQ strategy is an
        // open item (see design doc) and isn't implemented here.
        logger.error(SERVICE_NAME, "Failed to process kafka message", {
          topic,
          partition,
          eventType: parsed.eventType,
          eventId: parsed.eventId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  });

  logger.info(SERVICE_NAME, "Kafka consumer started", { groupId, topics });
}

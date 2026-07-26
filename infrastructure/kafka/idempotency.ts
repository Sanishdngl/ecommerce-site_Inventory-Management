// Debezium/Kafka Connect gives at-least-once delivery — every consumer must
// dedupe on the outbox event id before applying an effect. Reuses the
// existing Redis instance (already available to every service) rather than
// adding a new dedupe store; a SET with NX+EX is enough for this scale.
import Redis from "ioredis";

let client: Redis | null = null;

function getRedis(): Redis {
  if (client) return client;
  const { REDIS_HOST, REDIS_PORT } = process.env;
  if (!REDIS_HOST) {
    throw new Error("Missing required REDIS_HOST environment variable");
  }
  client = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT ? parseInt(REDIS_PORT, 10) : 6379,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
  return client;
}

export async function connectIdempotencyStore(): Promise<void> {
  await getRedis().connect();
}

const DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days — comfortably longer than any plausible consumer downtime/rebalance window

// Returns true if this event has already been processed (skip it).
// Returns false and marks it processed if this is the first time seen.
export async function alreadyProcessed(
  consumerName: string,
  eventId: string
): Promise<boolean> {
  if (!eventId) {
    // No event id to dedupe on — fail open (process it) rather than silently
    // dropping messages; this should only happen if a producer forgot to
    // include event_id in the payload, which is a bug to fix at the source.
    return false;
  }
  const redis = getRedis();
  const key = `idempotency:${consumerName}:${eventId}`;
  const result = await redis.set(key, "1", "EX", DEDUPE_TTL_SECONDS, "NX");
  return result === null; // null means key already existed — already processed
}

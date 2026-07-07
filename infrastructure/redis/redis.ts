import Redis from "ioredis";
import { logger } from "@infrastructure/observability/logger";
import { cacheHits, cacheMisses } from "@infrastructure/observability/metrics";

const SERVICE_NAME = process.env.SERVICE_NAME ?? "unknown-service";

let client: Redis | null = null;

// Not exported — every consumer goes through the cache* helpers below,
// which is the only reason a client is ever needed.
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

  client.on("error", (err) => {
    logger.error(SERVICE_NAME, "Redis connection error", {
      error: err.message,
    });
  });

  return client;
}

export async function testRedisConnection(): Promise<void> {
  const redis = getRedis();
  await redis.connect();
  await redis.ping();
}

// key_type is the segment before the first ':' (e.g. "product", "cart") —
// bounded cardinality, matches the CacheKey namespaces below.
function keyType(key: string): string {
  return key.split(":", 1)[0];
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  const raw = await redis.get(key);
  if (!raw) {
    cacheMisses.inc({ key_type: keyType(key) });
    return null;
  }
  cacheHits.inc({ key_type: keyType(key) });
  return JSON.parse(raw) as T;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  const redis = getRedis();
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const redis = getRedis();
  await redis.del(...keys);
}

// Delete keys matching a pattern using SCAN (non-blocking).
// Used when the exact cache keys aren't known (e.g. paginated list caches).
export async function cacheDelPattern(pattern: string): Promise<void> {
  const redis = getRedis();
  const keys: string[] = [];
  let cursor = "0";

  do {
    const [next, batch] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100
    );
    cursor = next;
    keys.push(...batch);
  } while (cursor !== "0");

  if (keys.length > 0) await redis.del(...keys);
}

export const TTL = {
  PRODUCT_DETAIL: 600, // 10 min
  PRODUCT_LIST: 300, // 5 min
  CATEGORIES_ALL: 1800, // 30 min
  STOCK: 60, // 1 min
  CART: 86400, // 24h
  REFRESH_TOKEN_ADMIN: 7 * 24 * 60 * 60, // 7 days
  REFRESH_TOKEN_CUSTOMER: 30 * 24 * 60 * 60, // 30 days
  REFRESH_GRACE_PERIOD: 10, // 10 seconds - 2 browser reload same time fallback
} as const;

export const CacheKey = {
  product: (id: string) => `product:${id}`,
  productList: (categoryId: string, page = 1, limit = 20) =>
    `products:list:${categoryId}:${page}:${limit}`,
  productListAll: (page = 1, limit = 20) =>
    `products:list:all:${page}:${limit}`,

  // Only page 1 is cached. Match all cached page-1 variants regardless of
  // the requested `limit` so writes can invalidate them all.
  productListPattern: (categoryId: string) => `products:list:${categoryId}:1:*`,
  productListAllPattern: () => `products:list:all:1:*`,

  categoriesAll: () => `categories:all`,
  stock: (productId: string) => `stock:${productId}`,
  cart: (customerId: string) => `cart:${customerId}`,
  refreshAdmin: (adminId: string, deviceId: string) =>
    `refresh:admin:${adminId}:${deviceId}`,
  refreshCustomer: (customerId: string, deviceId: string) =>
    `refresh:customer:${customerId}:${deviceId}`,
} as const;

import Redis from "ioredis";

let client: Redis | null = null;

export function getRedis(): Redis {
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
    console.error("[redis] connection error:", err.message);
  });

  return client;
}

export async function testRedisConnection(): Promise<void> {
  const redis = getRedis();
  await redis.connect();
  await redis.ping();
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  const raw = await redis.get(key);
  if (!raw) return null;
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

export const TTL = {
  PRODUCT_DETAIL: 600, // 10 min
  PRODUCT_LIST: 300, // 5 min
  CATEGORIES_ALL: 1800, // 30 min
  STOCK: 60, // 1 min
  CART: 86400, // 24h
} as const;

export const CacheKey = {
  product: (id: string) => `product:${id}`,
  productList: (categoryId: string) => `products:list:${categoryId}`,
  categoriesAll: () => `categories:all`,
  stock: (productId: string) => `stock:${productId}`,
  cart: (customerId: string) => `cart:${customerId}`,
} as const;

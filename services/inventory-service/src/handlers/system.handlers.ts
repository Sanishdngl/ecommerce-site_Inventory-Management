import { getDb, testDbConnection } from "@infrastructure/database/mysql";
import { testRedisConnection } from "@infrastructure/redis/redis";
import { handle } from "@shared/errors";
import {
  countActiveProducts,
  countLowStockProducts,
} from "../db/product.queries";
import { countCategories } from "../db/category.queries";

const SERVICE_NAME = "inventory-service";
const DEFAULT_LOW_STOCK_THRESHOLD = 10;

export const getInventoryStats = handle(async (call, callback) => {
  const db = getDb();
  const threshold =
    (call.request as any)?.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

  const [total_products, total_categories, low_stock_count] = await Promise.all(
    [
      countActiveProducts(db),
      countCategories(db),
      countLowStockProducts(db, threshold),
    ]
  );

  callback(null, { total_products, total_categories, low_stock_count });
});

export function healthCheck(_call: any, callback: any): void {
  Promise.all([testDbConnection(), testRedisConnection()])
    .then(() => {
      callback(null, {
        service: SERVICE_NAME,
        ok: true,
        message: "OK",
        checked_at: new Date().toISOString(),
      });
    })
    .catch((err) => {
      callback(null, {
        service: SERVICE_NAME,
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        checked_at: new Date().toISOString(),
      });
    });
}

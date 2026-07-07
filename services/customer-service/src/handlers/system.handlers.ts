import { testDbConnection } from "@infrastructure/database/mysql";
import { testRedisConnection } from "@infrastructure/redis/redis";

const SERVICE_NAME = "customer-service";

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

import "dotenv/config";
import * as grpc from "@grpc/grpc-js";
import { testDbConnection } from "@shared/db";
import { testRedisConnection } from "@shared/redis";
import { ensureBucket } from "./storage/rustfs.client";
import { createServer } from "./grpc/server";

const PORT = parseInt(process.env.INVENTORY_GRPC_PORT ?? "50052", 10);

async function bootstrap(): Promise<void> {
  await testDbConnection();
  console.log("[inventory-service] database connected");

  await testRedisConnection();
  console.log("[inventory-service] redis connected");

  await ensureBucket();
  console.log("[inventory-service] RustFS bucket ready");

  const server = createServer();

  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error("[inventory-service] failed to bind:", err.message);
        process.exit(1);
      }
      console.log(`[inventory-service] gRPC server running on port ${port}`);
    }
  );
}

bootstrap().catch((err) => {
  console.error("[inventory-service] bootstrap failed:", err);
  process.exit(1);
});

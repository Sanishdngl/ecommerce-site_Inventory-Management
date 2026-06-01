import "dotenv/config";
import * as grpc from "@grpc/grpc-js";
import { testDbConnection } from "@shared/db";
import { testRedisConnection } from "@shared/redis";
import { createServer } from "./grpc/server";

const PORT = parseInt(process.env.CUSTOMER_GRPC_PORT ?? "50053", 10);

async function bootstrap(): Promise<void> {
  await testDbConnection();
  console.log("[customer-service] database connected");

  await testRedisConnection();
  console.log("[customer-service] redis connected");

  const server = createServer();

  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error("[customer-service] failed to bind:", err.message);
        process.exit(1);
      }
      console.log(`[customer-service] gRPC server running on port ${port}`);
    }
  );
}

bootstrap().catch((err) => {
  console.error("[customer-service] bootstrap failed:", err);
  process.exit(1);
});

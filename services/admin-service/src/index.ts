import "dotenv/config";
import * as grpc from "@grpc/grpc-js";
import { testDbConnection } from "@shared/db";
import { createServer } from "./grpc/server";

const PORT = parseInt(process.env.ADMIN_GRPC_PORT ?? "50051", 10);

async function bootstrap(): Promise<void> {
  await testDbConnection();
  console.log("[admin-service] database connected");

  const server = createServer();

  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error("[admin-service] failed to bind:", err.message);
        process.exit(1);
      }
      console.log(`[admin-service] gRPC server running on port ${port}`);
    }
  );
}

bootstrap().catch((err) => {
  console.error("[admin-service] bootstrap failed:", err);
  process.exit(1);
});

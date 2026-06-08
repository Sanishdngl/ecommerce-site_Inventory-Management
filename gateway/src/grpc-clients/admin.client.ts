import * as grpc from "@grpc/grpc-js";
import { getAdminPackage } from "@shared/proto-loader";

let client: any = null;

export function getAdminClient(): any {
  if (client) return client;

  const host = process.env.ADMIN_SERVICE_HOST;
  const port = process.env.ADMIN_SERVICE_PORT;

  if (!host || !port) {
    throw new Error("ADMIN_SERVICE_HOST and ADMIN_SERVICE_PORT must be set");
  }

  const AdminServiceClient = getAdminPackage()["AdminService"] as any;

  client = new AdminServiceClient(
    `${host}:${port}`,
    grpc.credentials.createInsecure()
  );

  return client;
}

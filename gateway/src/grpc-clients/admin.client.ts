import * as grpc from "@grpc/grpc-js";
import { getAdminPackage } from "@shared/proto-loader";

const adminPkg = getAdminPackage();
const AdminServiceClient = adminPkg["AdminService"] as any;

if (!process.env.ADMIN_SERVICE_HOST || !process.env.ADMIN_SERVICE_PORT) {
  throw new Error("ADMIN_SERVICE_HOST and ADMIN_SERVICE_PORT must be set");
}

export const adminClient = new AdminServiceClient(
  `${process.env.ADMIN_SERVICE_HOST}:${process.env.ADMIN_SERVICE_PORT}`,
  grpc.credentials.createInsecure()
);

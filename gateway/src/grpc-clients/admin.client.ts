import { getAdminPackage } from "@shared/grpc/proto-loader";
import { getGrpcClient } from "@shared/grpc/client-factory";

export function getAdminClient(): any {
  const pkg = getAdminPackage();
  return getGrpcClient(
    "admin",
    pkg["AdminService"],
    "ADMIN_SERVICE_HOST",
    "ADMIN_SERVICE_PORT"
  );
}

import { getInventoryPackage } from "@shared/grpc/proto-loader";
import { getGrpcClient } from "@shared/grpc/client-factory";

export function getInventoryClient(): any {
  const pkg = getInventoryPackage();
  return getGrpcClient(
    "inventory",
    pkg["InventoryService"],
    "INVENTORY_SERVICE_HOST",
    "INVENTORY_SERVICE_PORT"
  );
}

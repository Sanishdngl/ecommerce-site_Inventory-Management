import * as grpc from "@grpc/grpc-js";
import { getInventoryPackage } from "@shared/proto-loader";

const inventoryPkg = getInventoryPackage();
const InventoryServiceClient = inventoryPkg["InventoryService"] as any;

if (
  !process.env.INVENTORY_SERVICE_HOST ||
  !process.env.INVENTORY_SERVICE_PORT
) {
  throw new Error(
    "INVENTORY_SERVICE_HOST and INVENTORY_SERVICE_PORT must be set"
  );
}

export const inventoryClient = new InventoryServiceClient(
  `${process.env.INVENTORY_SERVICE_HOST}:${process.env.INVENTORY_SERVICE_PORT}`,
  grpc.credentials.createInsecure()
);

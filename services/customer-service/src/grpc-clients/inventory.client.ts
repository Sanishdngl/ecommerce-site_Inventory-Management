import * as grpc from "@grpc/grpc-js";
import { getInventoryPackage } from "@shared/proto-loader";

let client: any = null;

function getInventoryClient(): any {
  if (client) return client;

  const host = process.env.INVENTORY_SERVICE_HOST;
  const port = process.env.INVENTORY_SERVICE_PORT;

  if (!host || !port) {
    throw new Error(
      "INVENTORY_SERVICE_HOST and INVENTORY_SERVICE_PORT must be set"
    );
  }

  const pkg = getInventoryPackage();
  const InventoryServiceClient = pkg["InventoryService"] as any;

  client = new InventoryServiceClient(
    `${host}:${port}`,
    grpc.credentials.createInsecure()
  );

  return client;
}

export function callInventory<Req, Res>(
  method: string,
  request: Req
): Promise<Res> {
  return new Promise((resolve, reject) => {
    getInventoryClient()[method](
      request,
      new grpc.Metadata(),
      (err: grpc.ServiceError | null, response: Res) => {
        if (err) reject(err);
        else resolve(response);
      }
    );
  });
}

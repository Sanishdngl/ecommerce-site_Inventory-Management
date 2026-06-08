import * as grpc from "@grpc/grpc-js";
import { getCustomerPackage } from "@shared/proto-loader";

let client: any = null;

export function getCustomerClient(): any {
  if (client) return client;

  const host = process.env.CUSTOMER_SERVICE_HOST;
  const port = process.env.CUSTOMER_SERVICE_PORT;

  if (!host || !port) {
    throw new Error(
      "CUSTOMER_SERVICE_HOST and CUSTOMER_SERVICE_PORT must be set"
    );
  }

  const CustomerServiceClient = getCustomerPackage()["CustomerService"] as any;

  client = new CustomerServiceClient(
    `${host}:${port}`,
    grpc.credentials.createInsecure()
  );

  return client;
}

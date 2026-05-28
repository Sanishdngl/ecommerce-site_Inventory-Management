import * as grpc from "@grpc/grpc-js";
import { getCustomerPackage } from "@shared/proto-loader";

const customerPkg = getCustomerPackage();
const CustomerServiceClient = customerPkg["CustomerService"] as any;

if (!process.env.CUSTOMER_SERVICE_HOST || !process.env.CUSTOMER_SERVICE_PORT) {
  throw new Error(
    "CUSTOMER_SERVICE_HOST and CUSTOMER_SERVICE_PORT must be set"
  );
}

export const customerClient = new CustomerServiceClient(
  `${process.env.CUSTOMER_SERVICE_HOST}:${process.env.CUSTOMER_SERVICE_PORT}`,
  grpc.credentials.createInsecure()
);

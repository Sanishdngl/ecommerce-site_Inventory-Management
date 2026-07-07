import { getCustomerPackage } from "@shared/grpc/proto-loader";
import { getGrpcClient } from "@shared/grpc/client-factory";

export function getCustomerClient(): any {
  const pkg = getCustomerPackage();
  return getGrpcClient(
    "customer",
    pkg["CustomerService"],
    "CUSTOMER_SERVICE_HOST",
    "CUSTOMER_SERVICE_PORT"
  );
}

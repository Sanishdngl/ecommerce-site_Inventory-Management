import * as grpc from "@grpc/grpc-js";
import { getCustomerPackage } from "@shared/grpc/proto-loader";
import {
  registerCustomer,
  loginCustomer,
  oAuthLogin,
  refreshCustomerToken,
  logoutCustomer,
} from "../handlers/auth.handlers";
import { getProfile, updateProfile } from "../handlers/profile.handlers";
import {
  addToCart,
  updateCartItem,
  removeFromCart,
  getCart,
} from "../handlers/cart.handlers";
import {
  listPublicCategories,
  listPublicProducts,
  getPublicProduct,
} from "../handlers/public.handlers";
import { healthCheck } from "../handlers/system.handlers";
import { withGrpcMetrics } from "@infrastructure/observability/metrics";

export function createServer(): grpc.Server {
  const server = new grpc.Server();
  const pkg = getCustomerPackage();
  const Service = pkg["CustomerService"] as any;

  server.addService(Service.service, {
    RegisterCustomer: withGrpcMetrics("RegisterCustomer", registerCustomer),
    LoginCustomer: withGrpcMetrics("LoginCustomer", loginCustomer),
    OAuthLogin: withGrpcMetrics("OAuthLogin", oAuthLogin),
    RefreshToken: withGrpcMetrics("RefreshToken", refreshCustomerToken),
    LogoutCustomer: withGrpcMetrics("LogoutCustomer", logoutCustomer),
    GetProfile: withGrpcMetrics("GetProfile", getProfile),
    UpdateProfile: withGrpcMetrics("UpdateProfile", updateProfile),
    AddToCart: withGrpcMetrics("AddToCart", addToCart),
    UpdateCartItem: withGrpcMetrics("UpdateCartItem", updateCartItem),
    RemoveFromCart: withGrpcMetrics("RemoveFromCart", removeFromCart),
    GetCart: withGrpcMetrics("GetCart", getCart),
    ListCategories: withGrpcMetrics("ListCategories", listPublicCategories),
    ListProducts: withGrpcMetrics("ListProducts", listPublicProducts),
    GetProduct: withGrpcMetrics("GetProduct", getPublicProduct),

    // void-returning, not Promise-based — see admin-service/src/grpc/server.ts
    HealthCheck: healthCheck,
  });

  return server;
}

import * as grpc from "@grpc/grpc-js";
import { getCustomerPackage } from "@shared/proto-loader";
import {
  registerCustomer,
  loginCustomer,
  oAuthLogin,
} from "../handlers/auth.handlers";
import { getProfile, updateProfile } from "../handlers/profile.handlers";
import {
  addToCart,
  updateCartItem,
  removeFromCart,
  getCart,
} from "../handlers/cart.handlers";

export function createServer(): grpc.Server {
  const server = new grpc.Server();
  const pkg = getCustomerPackage();
  const Service = pkg["CustomerService"] as any;

  server.addService(Service.service, {
    RegisterCustomer: registerCustomer,
    LoginCustomer: loginCustomer,
    OAuthLogin: oAuthLogin,
    GetProfile: getProfile,
    UpdateProfile: updateProfile,
    AddToCart: addToCart,
    UpdateCartItem: updateCartItem,
    RemoveFromCart: removeFromCart,
    GetCart: getCart,
  });

  return server;
}

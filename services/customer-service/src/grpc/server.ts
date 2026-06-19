import * as grpc from "@grpc/grpc-js";
import { getCustomerPackage } from "@shared/proto-loader";
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

export function createServer(): grpc.Server {
  const server = new grpc.Server();
  const pkg = getCustomerPackage();
  const Service = pkg["CustomerService"] as any;

  server.addService(Service.service, {
    RegisterCustomer: registerCustomer,
    LoginCustomer: loginCustomer,
    OAuthLogin: oAuthLogin,
    RefreshToken: refreshCustomerToken,
    LogoutCustomer: logoutCustomer,
    GetProfile: getProfile,
    UpdateProfile: updateProfile,
    AddToCart: addToCart,
    UpdateCartItem: updateCartItem,
    RemoveFromCart: removeFromCart,
    GetCart: getCart,
    ListCategories: listPublicCategories,
    ListProducts: listPublicProducts,
    GetProduct: getPublicProduct,
  });

  return server;
}

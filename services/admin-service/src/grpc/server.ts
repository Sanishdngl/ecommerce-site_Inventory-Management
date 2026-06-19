import * as grpc from "@grpc/grpc-js";
import { getAdminPackage } from "@shared/proto-loader";
import {
  loginAdmin,
  logoutAdmin,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  toggleAdminStatus,
  listAdminUsersHandler,
  refreshAdminToken,
} from "../handlers/admin.handlers";
import {
  createCategory,
  listCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  listProducts,
  getProduct,
  updateStock,
  uploadProductImage,
  bulkUploadProducts,
} from "../handlers/inventory.handlers";

export function createServer(): grpc.Server {
  const server = new grpc.Server();
  const pkg = getAdminPackage();
  const Service = pkg["AdminService"] as any;

  server.addService(Service.service, {
    LoginAdmin: loginAdmin,
    CreateAdminUser: createAdminUser,
    UpdateAdminUser: updateAdminUser,
    DeleteAdminUser: deleteAdminUser,
    ToggleAdminStatus: toggleAdminStatus,
    ListAdminUsers: listAdminUsersHandler,
    RefreshToken: refreshAdminToken,
    LogoutAdmin: logoutAdmin,

    CreateCategory: createCategory,
    ListCategories: listCategories,
    CreateProduct: createProduct,
    UpdateProduct: updateProduct,
    DeleteProduct: deleteProduct,
    ListProducts: listProducts,
    GetProduct: getProduct,
    UpdateStock: updateStock,
    UploadProductImage: uploadProductImage,
    BulkUploadProducts: bulkUploadProducts,
  });

  return server;
}

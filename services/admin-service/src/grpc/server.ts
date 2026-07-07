import * as grpc from "@grpc/grpc-js";
import { getAdminPackage } from "@shared/grpc/proto-loader";
import {
  loginAdmin,
  logoutAdmin,
  createAdminUser,
  getAdminUser,
  updateAdminUser,
  deleteAdminUser,
  toggleAdminStatus,
  listAdminUsersHandler,
  refreshAdminToken,
} from "../handlers/admin.handlers";
import {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  listProducts,
  getProduct,
  updateStock,
  uploadProductImage,
  bulkUploadProducts,
  getInventoryStats,
} from "../handlers/inventory.handlers";
import { listAuditLogsHandler, healthCheck } from "../handlers/system.handlers";
import { withGrpcMetrics } from "@infrastructure/observability/metrics";

export function createServer(): grpc.Server {
  const server = new grpc.Server();
  const pkg = getAdminPackage();
  const Service = pkg["AdminService"] as any;

  server.addService(Service.service, {
    LoginAdmin: withGrpcMetrics("LoginAdmin", loginAdmin),
    CreateAdminUser: withGrpcMetrics("CreateAdminUser", createAdminUser),
    GetAdminUser: withGrpcMetrics("GetAdminUser", getAdminUser),
    UpdateAdminUser: withGrpcMetrics("UpdateAdminUser", updateAdminUser),
    DeleteAdminUser: withGrpcMetrics("DeleteAdminUser", deleteAdminUser),
    ToggleAdminStatus: withGrpcMetrics("ToggleAdminStatus", toggleAdminStatus),
    ListAdminUsers: withGrpcMetrics("ListAdminUsers", listAdminUsersHandler),
    RefreshToken: withGrpcMetrics("RefreshToken", refreshAdminToken),
    LogoutAdmin: withGrpcMetrics("LogoutAdmin", logoutAdmin),

    CreateCategory: withGrpcMetrics("CreateCategory", createCategory),
    ListCategories: withGrpcMetrics("ListCategories", listCategories),
    GetCategory: withGrpcMetrics("GetCategory", getCategory),
    UpdateCategory: withGrpcMetrics("UpdateCategory", updateCategory),
    DeleteCategory: withGrpcMetrics("DeleteCategory", deleteCategory),
    CreateProduct: withGrpcMetrics("CreateProduct", createProduct),
    UpdateProduct: withGrpcMetrics("UpdateProduct", updateProduct),
    DeleteProduct: withGrpcMetrics("DeleteProduct", deleteProduct),
    ListProducts: withGrpcMetrics("ListProducts", listProducts),
    GetProduct: withGrpcMetrics("GetProduct", getProduct),
    UpdateStock: withGrpcMetrics("UpdateStock", updateStock),
    GetInventoryStats: withGrpcMetrics("GetInventoryStats", getInventoryStats),

    // Streaming (client-streams data/end) and void-returning handlers are
    // excluded — withGrpcMetrics awaits a Promise, and wrapping a handler
    // that returns void before its async work finishes would record a
    // false ~0s "OK" on every call.
    UploadProductImage: uploadProductImage,
    BulkUploadProducts: bulkUploadProducts,
    HealthCheck: healthCheck,

    ListAuditLogs: withGrpcMetrics("ListAuditLogs", listAuditLogsHandler),
  });

  return server;
}

import * as grpc from "@grpc/grpc-js";
import { getInventoryPackage } from "@shared/grpc/proto-loader";
import {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  deleteCategory,
} from "../handlers/category.handlers";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateStock,
  uploadProductImageHandler,
  getProductsByIds,
} from "../handlers/product.handlers";
import { bulkUploadProductsHandler } from "../handlers/bulk.handlers";
import { getInventoryStats, healthCheck } from "../handlers/system.handlers";
import { withGrpcMetrics } from "@infrastructure/observability/metrics";

export function createServer(): grpc.Server {
  const server = new grpc.Server();
  const pkg = getInventoryPackage();
  const Service = pkg["InventoryService"] as any;

  server.addService(Service.service, {
    CreateCategory: withGrpcMetrics("CreateCategory", createCategory),
    ListCategories: withGrpcMetrics("ListCategories", listCategories),
    GetCategory: withGrpcMetrics("GetCategory", getCategory),
    UpdateCategory: withGrpcMetrics("UpdateCategory", updateCategory),
    DeleteCategory: withGrpcMetrics("DeleteCategory", deleteCategory),
    CreateProduct: withGrpcMetrics("CreateProduct", createProduct),
    UpdateProduct: withGrpcMetrics("UpdateProduct", updateProduct),
    DeleteProduct: withGrpcMetrics("DeleteProduct", deleteProduct),
    GetProduct: withGrpcMetrics("GetProduct", getProduct),
    ListProducts: withGrpcMetrics("ListProducts", listProducts),
    UpdateStock: withGrpcMetrics("UpdateStock", updateStock),
    GetProductsByIds: withGrpcMetrics("GetProductsByIds", getProductsByIds),
    GetInventoryStats: withGrpcMetrics("GetInventoryStats", getInventoryStats),

    // void-returning/streaming, not Promise-based — see
    // admin-service/src/grpc/server.ts for why these are excluded.
    UploadProductImage: uploadProductImageHandler,
    BulkUploadProducts: bulkUploadProductsHandler,
    HealthCheck: healthCheck,
  });

  return server;
}

import * as grpc from "@grpc/grpc-js";
import { getInventoryPackage } from "@shared/proto-loader";
import { createCategory, listCategories } from "../handlers/category.handlers";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateStock,
  uploadProductImageHandler,
} from "../handlers/product.handlers";
import { bulkUploadProductsHandler } from "../handlers/bulk.handlers";

export function createServer(): grpc.Server {
  const server = new grpc.Server();
  const pkg = getInventoryPackage();
  const Service = pkg["InventoryService"] as any;

  server.addService(Service.service, {
    CreateCategory: createCategory,
    ListCategories: listCategories,
    CreateProduct: createProduct,
    UpdateProduct: updateProduct,
    DeleteProduct: deleteProduct,
    GetProduct: getProduct,
    ListProducts: listProducts,
    UpdateStock: updateStock,
    UploadProductImage: uploadProductImageHandler,
    BulkUploadProducts: bulkUploadProductsHandler,
  });

  return server;
}

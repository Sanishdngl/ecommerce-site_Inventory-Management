import * as grpc from "@grpc/grpc-js";
import { callGrpc, streamToGrpc, buildMeta } from "@shared/grpc/call-grpc";
import { getInventoryClient } from "@shared/grpc/inventory.client";
import { logger } from "@infrastructure/observability/logger";

const SERVICE_NAME = "admin-service";

function forwardMeta(call: grpc.ServerUnaryCall<any, any>): grpc.Metadata {
  const adminId = call.metadata.get("admin_id");
  const ip = call.metadata.get("ip_address");
  const role = call.metadata.get("role");

  return buildMeta(
    adminId.length > 0 ? String(adminId[0]) : undefined,
    ip.length > 0 ? String(ip[0]) : undefined,
    role.length > 0 ? String(role[0]) : undefined
  );
}

export async function createCategory(call: any, callback: any): Promise<void> {
  try {
    const result = await callGrpc(
      getInventoryClient(),
      "CreateCategory",
      call.request,
      forwardMeta(call)
    );
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export async function listCategories(call: any, callback: any): Promise<void> {
  try {
    const result = await callGrpc(
      getInventoryClient(),
      "ListCategories",
      call.request,
      forwardMeta(call)
    );
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export async function getCategory(call: any, callback: any): Promise<void> {
  try {
    const result = await callGrpc(
      getInventoryClient(),
      "GetCategory",
      call.request,
      forwardMeta(call)
    );
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export async function updateCategory(call: any, callback: any): Promise<void> {
  try {
    const result = await callGrpc(
      getInventoryClient(),
      "UpdateCategory",
      call.request,
      forwardMeta(call)
    );
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export async function deleteCategory(call: any, callback: any): Promise<void> {
  try {
    const result = await callGrpc(
      getInventoryClient(),
      "DeleteCategory",
      call.request,
      forwardMeta(call)
    );
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export async function createProduct(call: any, callback: any): Promise<void> {
  try {
    const result = await callGrpc(
      getInventoryClient(),
      "CreateProduct",
      call.request,
      forwardMeta(call)
    );
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export async function updateProduct(call: any, callback: any): Promise<void> {
  try {
    const result = await callGrpc(
      getInventoryClient(),
      "UpdateProduct",
      call.request,
      forwardMeta(call)
    );
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export async function deleteProduct(call: any, callback: any): Promise<void> {
  try {
    const result = await callGrpc(
      getInventoryClient(),
      "DeleteProduct",
      call.request,
      forwardMeta(call)
    );
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export async function listProducts(call: any, callback: any): Promise<void> {
  try {
    const result = await callGrpc(
      getInventoryClient(),
      "ListProducts",
      call.request
    );
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export async function getProduct(call: any, callback: any): Promise<void> {
  try {
    const result = await callGrpc(
      getInventoryClient(),
      "GetProduct",
      call.request,
      forwardMeta(call)
    );
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export async function updateStock(call: any, callback: any): Promise<void> {
  try {
    const result = await callGrpc(
      getInventoryClient(),
      "UpdateStock",
      call.request,
      forwardMeta(call)
    );
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export async function getInventoryStats(call: any, callback: any): Promise<void> {
  try {
    const result = await callGrpc(
      getInventoryClient(),
      "GetInventoryStats",
      call.request,
      forwardMeta(call)
    );
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export function uploadProductImage(call: any, callback: any): void {
  const chunks: any[] = [];

  call.on("data", (chunk: any) => chunks.push(chunk));
  call.on("end", async () => {
    try {
      const result = await streamToGrpc(
        getInventoryClient(),
        "UploadProductImage",
        chunks
      );
      callback(null, result);
    } catch (err) {
      callback(err, null);
    }
  });
  call.on("error", (err: Error) =>
    logger.error(SERVICE_NAME, "Image upload stream error", {
      error: err.message,
    })
  );
}

export function bulkUploadProducts(call: any, callback: any): void {
  const chunks: any[] = [];

  call.on("data", (chunk: any) => chunks.push(chunk));
  call.on("end", async () => {
    try {
      const result = await streamToGrpc(
        getInventoryClient(),
        "BulkUploadProducts",
        chunks
      );
      callback(null, result);
    } catch (err) {
      callback(err, null);
    }
  });
  call.on("error", (err: Error) =>
    logger.error(SERVICE_NAME, "Bulk upload stream error", {
      error: err.message,
    })
  );
}

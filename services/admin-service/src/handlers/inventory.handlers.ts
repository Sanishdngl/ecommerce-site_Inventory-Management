import * as grpc from "@grpc/grpc-js";
import {
  callInventory,
  streamToInventory,
} from "../grpc-clients/inventory.client";

function forwardMeta(call: grpc.ServerUnaryCall<any, any>): grpc.Metadata {
  const meta = new grpc.Metadata();
  const adminId = call.metadata.get("admin_id");
  const ip = call.metadata.get("ip_address");
  if (adminId.length > 0) meta.set("admin_id", String(adminId[0]));
  if (ip.length > 0) meta.set("ip_address", String(ip[0]));
  return meta;
}

export async function createCategory(call: any, callback: any): Promise<void> {
  try {
    const result = await callInventory(
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
    const result = await callInventory("ListCategories", call.request);
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export async function createProduct(call: any, callback: any): Promise<void> {
  try {
    const result = await callInventory(
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
    const result = await callInventory(
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
    const result = await callInventory(
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
    const result = await callInventory("ListProducts", call.request);
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export async function getProduct(call: any, callback: any): Promise<void> {
  try {
    const result = await callInventory("GetProduct", call.request);
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
}

export async function updateStock(call: any, callback: any): Promise<void> {
  try {
    const result = await callInventory(
      "UpdateStock",
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
      const result = await streamToInventory("UploadProductImage", chunks);
      callback(null, result);
    } catch (err) {
      callback(err, null);
    }
  });
  call.on("error", (err: Error) =>
    console.error("[admin] image upload stream error:", err)
  );
}

export function bulkUploadProducts(call: any, callback: any): void {
  const chunks: any[] = [];

  call.on("data", (chunk: any) => chunks.push(chunk));
  call.on("end", async () => {
    try {
      const result = await streamToInventory("BulkUploadProducts", chunks);
      callback(null, result);
    } catch (err) {
      callback(err, null);
    }
  });
  call.on("error", (err: Error) =>
    console.error("[admin] bulk upload stream error:", err)
  );
}

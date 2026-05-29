import { getDb } from "@shared/db";
import { cacheGet, cacheSet, cacheDel, TTL, CacheKey } from "@shared/redis";
import { writeAuditLog } from "@shared/audit";
import { Errors, handle } from "@shared/errors";
import type { Product } from "@shared/types";
import {
  findProductById,
  insertProduct,
  updateProduct as updateProductQuery,
  softDeleteProduct,
  listProductsByCategory,
  updateStockQuantity,
} from "../db/product.queries";
import { findCategoryById } from "../db/category.queries";
import { uploadProductImage, type ImageType } from "../storage/rustfs.client";

function getMeta(call: any, key: string): string | undefined {
  const val = call.metadata?.get(key);
  return val?.length > 0 ? String(val[0]) : undefined;
}

export const createProduct = handle(async (call, callback) => {
  const db = getDb();
  const { category_id, name, description, price, stock_quantity } =
    call.request as any;

  if (!category_id || !name || !price) {
    throw Errors.invalidArgument("category_id, name, and price are required");
  }

  const category = await findCategoryById(db, category_id);
  if (!category) throw Errors.notFound("Category not found");

  const product = await insertProduct(db, {
    category_id,
    name,
    description,
    price,
    stock_quantity: stock_quantity ?? 0,
  });

  await cacheDel(CacheKey.productList(category_id));

  await writeAuditLog(db, {
    entity_type: "product",
    entity_id: product.id,
    action: "create",
    performed_by: getMeta(call, "admin_id") ?? "system",
    metadata: { category_id, name, price, stock_quantity },
    ip_address: getMeta(call, "ip_address"),
  });

  callback(null, { product });
});

export const updateProduct = handle(async (call, callback) => {
  const db = getDb();
  const { id, category_id, name, description, price, is_active } =
    call.request as any;

  if (!id) throw Errors.invalidArgument("id is required");

  const existing = await findProductById(db, id);
  if (!existing) throw Errors.notFound("Product not found");

  if (category_id) {
    const category = await findCategoryById(db, category_id);
    if (!category) throw Errors.notFound("Category not found");
  }

  const updated = await updateProductQuery(db, id, {
    category_id,
    name,
    description,
    price,
    is_active,
  });

  await cacheDel(
    CacheKey.product(id),
    CacheKey.productList(existing.category_id)
  );

  if (category_id && category_id !== existing.category_id) {
    await cacheDel(CacheKey.productList(category_id));
  }

  const diff: Record<string, { from: unknown; to: unknown }> = {};
  if (name && name !== existing.name)
    diff.name = { from: existing.name, to: name };
  if (price && price !== existing.price)
    diff.price = { from: existing.price, to: price };
  if (category_id && category_id !== existing.category_id)
    diff.category_id = { from: existing.category_id, to: category_id };
  if (is_active !== undefined && is_active !== existing.is_active)
    diff.is_active = { from: existing.is_active, to: is_active };

  await writeAuditLog(db, {
    entity_type: "product",
    entity_id: id,
    action: "update",
    performed_by: getMeta(call, "admin_id") ?? "system",
    metadata: { diff },
    ip_address: getMeta(call, "ip_address"),
  });

  callback(null, { product: updated });
});

export const deleteProduct = handle(async (call, callback) => {
  const db = getDb();
  const { id } = call.request as any;

  if (!id) throw Errors.invalidArgument("id is required");

  const existing = await findProductById(db, id);
  if (!existing) throw Errors.notFound("Product not found");

  await softDeleteProduct(db, id);

  await cacheDel(
    CacheKey.product(id),
    CacheKey.productList(existing.category_id)
  );

  await writeAuditLog(db, {
    entity_type: "product",
    entity_id: id,
    action: "delete",
    performed_by: getMeta(call, "admin_id") ?? "system",
    metadata: { name: existing.name, category_id: existing.category_id },
    ip_address: getMeta(call, "ip_address"),
  });

  callback(null, { success: true, message: "Product deleted" });
});

export const getProduct = handle(async (call, callback) => {
  const db = getDb();
  const { id } = call.request as any;

  if (!id) throw Errors.invalidArgument("id is required");

  const cached = await cacheGet<Product>(CacheKey.product(id));
  if (cached) {
    callback(null, { product: cached });
    return;
  }

  const product = await findProductById(db, id);
  if (!product) throw Errors.notFound("Product not found");

  await cacheSet(CacheKey.product(id), product, TTL.PRODUCT_DETAIL);

  callback(null, { product });
});

export const listProducts = handle(async (call, callback) => {
  const db = getDb();
  const { category_id, pagination } = call.request as any;

  if (!category_id) throw Errors.invalidArgument("category_id is required");

  const page = pagination?.page || 1;
  const limit = pagination?.limit || 20;

  const cacheKey = CacheKey.productList(category_id);
  if (page === 1) {
    const cached = await cacheGet<any>(cacheKey);
    if (cached) {
      callback(null, cached);
      return;
    }
  }

  const { products, total } = await listProductsByCategory(
    db,
    category_id,
    page,
    limit
  );
  const response = { products, pagination: { total, page, limit } };

  if (page === 1) {
    await cacheSet(cacheKey, response, TTL.PRODUCT_LIST);
  }

  callback(null, response);
});

export const updateStock = handle(async (call, callback) => {
  const db = getDb();
  const { product_id, delta } = call.request as any;

  if (!product_id) throw Errors.invalidArgument("product_id is required");
  if (delta === undefined) throw Errors.invalidArgument("delta is required");

  const updated = await updateStockQuantity(db, product_id, delta);

  if (!updated) {
    throw Errors.invalidArgument(
      "Stock update rejected — quantity cannot go below zero"
    );
  }

  await cacheDel(CacheKey.stock(product_id));

  callback(null, {
    product_id,
    stock_quantity: updated.stock_quantity,
  });
});

export function uploadProductImageHandler(call: any, callback: any): void {
  let meta: {
    product_id: string;
    image_type: ImageType;
    mime_type: string;
  } | null = null;
  const chunks: Buffer[] = [];

  call.on("data", (chunk: any) => {
    if (chunk.meta) {
      meta = chunk.meta;
    } else if (chunk.chunk) {
      chunks.push(Buffer.from(chunk.chunk));
    }
  });

  call.on("end", async () => {
    try {
      if (!meta) {
        callback({ code: 3, message: "Missing image metadata" }, null);
        return;
      }

      const { product_id, image_type, mime_type } = meta;

      const product = await findProductById(getDb(), product_id);
      if (!product) {
        callback({ code: 5, message: "Product not found" }, null);
        return;
      }

      const fileBuffer = Buffer.concat(chunks);
      const url = await uploadProductImage(
        product_id,
        image_type,
        fileBuffer,
        mime_type
      );

      await updateProductQuery(getDb(), product_id, {
        [image_type === "thumbnail" ? "thumbnail_url" : "list_image_url"]: url,
      });

      await cacheDel(CacheKey.product(product_id));

      callback(null, { url });
    } catch (err) {
      console.error("[inventory] image upload error:", err);
      callback({ code: 13, message: "Internal server error" }, null);
    }
  });

  call.on("error", (err: Error) => {
    console.error("[inventory] stream error:", err);
  });
}

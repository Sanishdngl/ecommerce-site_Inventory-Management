import { getDb } from "@infrastructure/database/mysql";
import {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  TTL,
  CacheKey,
} from "@infrastructure/redis/redis";
import { writeAuditLog } from "@infrastructure/observability/audit";
import { logger } from "@infrastructure/observability/logger";
import { handle, BadRequestError, NotFoundError } from "@shared/errors";
import { validateGrpc } from "@shared/grpc/validate-grpc";
import {
  CreateProductSchema,
  UpdateProductSchema,
  DeleteProductSchema,
  GetProductSchema,
  ListProductsGrpcSchema,
  UpdateStockSchema,
} from "@shared/validation/inventory.schema";
import type { Product } from "@shared/types";
import {
  findProductById,
  insertProduct,
  updateProduct as updateProductQuery,
  softDeleteProduct,
  listProductsByCategory,
  listAllProducts,
  updateStockQuantity,
  findProductsByIds,
} from "../db/product.queries";
import { findCategoryById } from "../db/category.queries";
import {
  uploadProductImage,
  deleteProductImage,
  extFromUrl,
  extFromMime,
} from "../storage/rustfs";
import { ImageType } from "@shared/types";

const SERVICE_NAME = "inventory-service";

function getMeta(call: any, key: string): string | undefined {
  const val = call.metadata?.get(key);
  return val?.length > 0 ? String(val[0]) : undefined;
}

export const createProduct = handle(async (call, callback) => {
  const db = getDb();
  const { category_id, name, description, price, stock_quantity } =
    validateGrpc(CreateProductSchema, call.request);

  const category = await findCategoryById(db, category_id);
  if (!category) throw new NotFoundError("Category not found");

  const product = await insertProduct(db, {
    category_id,
    name,
    description,
    price,
    stock_quantity,
  });

  await Promise.all([
    cacheDelPattern(CacheKey.productListPattern(category_id)),
    cacheDelPattern(CacheKey.productListAllPattern()),
  ]);

  await writeAuditLog(db, {
    entity_type: "product",
    entity_id: product.id,
    action: "create",
    performed_by: getMeta(call, "admin_id") ?? "system",
    metadata: { category_id, name, price, stock_quantity },
    ip_address: getMeta(call, "ip_address"),
  });

  logger.info(SERVICE_NAME, "Product created", {
    product_id: product.id,
    category_id,
    name,
  });

  callback(null, { product });
});

export const updateProduct = handle(async (call, callback) => {
  const db = getDb();
  const { id, category_id, name, description, price, is_active } = validateGrpc(
    UpdateProductSchema,
    call.request
  );

  const existing = await findProductById(db, id);
  if (!existing) throw new NotFoundError("Product not found");

  if (category_id) {
    const category = await findCategoryById(db, category_id);
    if (!category) throw new NotFoundError("Category not found");
  }

  const updated = await updateProductQuery(db, id, {
    category_id,
    name,
    description,
    price,
    is_active,
  });

  await cacheDel(CacheKey.product(id));
  await Promise.all([
    cacheDelPattern(CacheKey.productListPattern(existing.category_id)),
    cacheDelPattern(CacheKey.productListAllPattern()),
  ]);
  if (category_id && category_id !== existing.category_id) {
    await cacheDelPattern(CacheKey.productListPattern(category_id));
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

  logger.info(SERVICE_NAME, "Product updated", { product_id: id, diff });

  callback(null, { product: updated });
});

export const deleteProduct = handle(async (call, callback) => {
  const db = getDb();
  const { id } = validateGrpc(DeleteProductSchema, call.request);

  const existing = await findProductById(db, id);
  if (!existing) throw new NotFoundError("Product not found");
  if (!existing.is_active) throw new NotFoundError("Product not found");

  await softDeleteProduct(db, id);

  await cacheDel(CacheKey.product(id));
  await Promise.all([
    cacheDelPattern(CacheKey.productListPattern(existing.category_id)),
    cacheDelPattern(CacheKey.productListAllPattern()),
  ]);

  await writeAuditLog(db, {
    entity_type: "product",
    entity_id: id,
    action: "delete",
    performed_by: getMeta(call, "admin_id") ?? "system",
    metadata: { name: existing.name, category_id: existing.category_id },
    ip_address: getMeta(call, "ip_address"),
  });

  logger.info(SERVICE_NAME, "Product deleted", {
    product_id: id,
    name: existing.name,
  });

  callback(null, { success: true, message: "Product deleted" });
});

export const getProduct = handle(async (call, callback) => {
  const db = getDb();
  const { id } = validateGrpc(GetProductSchema, call.request);

  const cached = await cacheGet<Product>(CacheKey.product(id));
  if (cached) {
    callback(null, { product: cached });
    return;
  }

  const product = await findProductById(db, id);
  if (!product) throw new NotFoundError("Product not found");

  await cacheSet(CacheKey.product(id), product, TTL.PRODUCT_DETAIL);

  callback(null, { product });
});

export const listProducts = handle(async (call, callback) => {
  const db = getDb();
  const { category_id, pagination, include_inactive } = validateGrpc(
    ListProductsGrpcSchema,
    call.request
  );

  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 20;
  const includeInactive = include_inactive ?? false;

  // All products
  if (!category_id) {
    const cacheKey = CacheKey.productListAll(page, limit);

    if (page === 1 && !includeInactive) {
      const cached = await cacheGet<any>(cacheKey);
      if (cached) {
        callback(null, cached);
        return;
      }
    }

    const { products, total } = await listAllProducts(
      db,
      page,
      limit,
      includeInactive
    );
    const response = { products, pagination: { total, page, limit } };

    if (page === 1 && !includeInactive) {
      await cacheSet(cacheKey, response, TTL.PRODUCT_LIST);
    }

    callback(null, response);
    return;
  }

  // product by category
  const cacheKey = CacheKey.productList(category_id, page, limit);
  if (page === 1 && !includeInactive) {
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
    limit,
    includeInactive
  );
  const response = { products, pagination: { total, page, limit } };

  if (page === 1 && !includeInactive) {
    await cacheSet(cacheKey, response, TTL.PRODUCT_LIST);
  }

  callback(null, response);
});

export const updateStock = handle(async (call, callback) => {
  const db = getDb();
  const { product_id, delta, reason } = validateGrpc(
    UpdateStockSchema,
    call.request
  );

  const existing = await findProductById(db, product_id);
  if (!existing) throw new NotFoundError("Product not found");

  const updated = await updateStockQuantity(db, product_id, delta);

  if (!updated) {
    logger.warn(SERVICE_NAME, "Stock update rejected: would go negative", {
      product_id,
      delta,
    });
    throw new BadRequestError(
      "Stock update rejected — quantity cannot go below zero"
    );
  }

  await cacheDel(CacheKey.stock(product_id), CacheKey.product(product_id));
  await Promise.all([
    cacheDelPattern(CacheKey.productListPattern(updated.category_id)),
    cacheDelPattern(CacheKey.productListAllPattern()),
  ]);

  // No prior audit trail existed for stock changes at all (unlike product
  // create/update/delete) — this was silently unaudited before. Reuses the
  // generic audit_logs table (action: "update") rather than adding a new
  // stock_movements table, since entity_type/metadata already model this fine.
  await writeAuditLog(db, {
    entity_type: "product",
    entity_id: product_id,
    action: "update",
    performed_by: getMeta(call, "admin_id") ?? "system",
    metadata: {
      type: "stock_adjustment",
      delta,
      reason: reason ?? null,
      stock_before: existing.stock_quantity,
      stock_after: updated.stock_quantity,
    },
    ip_address: getMeta(call, "ip_address"),
  });

  logger.info(SERVICE_NAME, "Stock updated", {
    product_id,
    delta,
    reason,
    new_quantity: updated.stock_quantity,
  });

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

      const previousUrl =
        image_type === "thumbnail"
          ? product.thumbnail_url
          : product.list_image_url;

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

      // The object key includes the extension (products/{id}/{type}.{ext}),
      // so re-uploading with a different mime type (e.g. png -> webp)
      // writes a new object rather than overwriting the old one. Clean up
      // the orphan — best-effort, doesn't fail the request if it errors.
      const previousExt = previousUrl ? extFromUrl(previousUrl) : undefined;
      const newExt = extFromMime(mime_type);
      if (previousExt && previousExt !== newExt) {
        await deleteProductImage(product_id, image_type, previousExt).catch(
          (err) => {
            logger.error(SERVICE_NAME, "Failed to remove stale product image", {
              product_id,
              image_type,
              previous_url: previousUrl,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        );
      }

      await cacheDel(CacheKey.product(product_id));
      await Promise.all([
        cacheDelPattern(CacheKey.productListPattern(product.category_id)),
        cacheDelPattern(CacheKey.productListAllPattern()),
      ]);

      await writeAuditLog(getDb(), {
        entity_type: "product",
        entity_id: product_id,
        action: "update",
        performed_by: getMeta(call, "admin_id") ?? "system",
        metadata: { image_type, url },
        ip_address: getMeta(call, "ip_address"),
      });
      
      logger.info(SERVICE_NAME, "Product image uploaded", {
        product_id,
        image_type,
      });

      callback(null, { url });
    } catch (err) {
      logger.error(SERVICE_NAME, "Image upload error", {
        error: err instanceof Error ? err.message : String(err),
      });
      callback({ code: 13, message: "Internal server error" }, null);
    }
  });

  call.on("error", (err: Error) => {
    logger.error(SERVICE_NAME, "Image upload stream error", {
      error: err.message,
    });
  });
}

export const getProductsByIds = handle(async (call, callback) => {
  const db = getDb();
  const { ids } = call.request as any;

  if (!ids || ids.length === 0) {
    callback(null, { products: [] });
    return;
  }

  const products = await findProductsByIds(db, ids);
  callback(null, { products });
});

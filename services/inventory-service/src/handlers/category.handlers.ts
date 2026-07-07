import { getDb } from "@infrastructure/database/mysql";
import {
  cacheGet,
  cacheSet,
  cacheDel,
  TTL,
  CacheKey,
} from "@infrastructure/redis/redis";
import { writeAuditLog } from "@infrastructure/observability/audit";
import { logger } from "@infrastructure/observability/logger";
import { handle, ConflictError, NotFoundError } from "@shared/errors";
import { validateGrpc } from "@shared/grpc/validate-grpc";
import {
  CreateCategorySchema,
  GetCategorySchema,
  UpdateCategorySchema,
  DeleteCategorySchema,
} from "@shared/validation/inventory.schema";
import type { Category } from "@shared/types";
import {
  findCategoryById,
  findCategoryBySlug,
  insertCategory,
  getAllCategories,
  updateCategory as updateCategoryQuery,
  deleteCategory as deleteCategoryQuery,
} from "../db/category.queries";

// MySQL FK-violation errno — thrown when deleting a category that still
// has products pointing at it (products.category_id ON DELETE RESTRICT).
const ER_ROW_IS_REFERENCED_2 = 1451;

function getMeta(call: any, key: string): string | undefined {
  const val = call.metadata?.get(key);
  return val?.length > 0 ? String(val[0]) : undefined;
}

const SERVICE_NAME = "inventory-service";

export const createCategory = handle(async (call, callback) => {
  const db = getDb();
  const { name, slug } = validateGrpc(CreateCategorySchema, call.request);

  const existing = await findCategoryBySlug(db, slug);
  if (existing) throw new ConflictError("Category slug already exists");

  const category = await insertCategory(db, name, slug);

  await cacheDel(CacheKey.categoriesAll());

  const performedBy = call.metadata.get("admin_id")?.[0]
    ? String(call.metadata.get("admin_id")[0])
    : "system";

  await writeAuditLog(db, {
    entity_type: "category",
    entity_id: category.id,
    action: "create",
    performed_by: performedBy,
    metadata: { name, slug },
    ip_address: call.metadata.get("ip_address")?.[0]
      ? String(call.metadata.get("ip_address")[0])
      : undefined,
  });

  logger.info(SERVICE_NAME, "Category created", {
    category_id: category.id,
    name,
    slug,
  });

  callback(null, { category });
});

export const listCategories = handle(async (call, callback) => {
  const cached = await cacheGet<Category[]>(CacheKey.categoriesAll());
  if (cached) {
    callback(null, { categories: cached });
    return;
  }

  const db = getDb();
  const categories = await getAllCategories(db);

  await cacheSet(CacheKey.categoriesAll(), categories, TTL.CATEGORIES_ALL);

  callback(null, { categories });
});

export const getCategory = handle(async (call, callback) => {
  const db = getDb();
  const { id } = validateGrpc(GetCategorySchema, call.request);

  const category = await findCategoryById(db, id);
  if (!category) throw new NotFoundError("Category not found");

  callback(null, { category });
});

export const updateCategory = handle(async (call, callback) => {
  const db = getDb();
  const { id, name, slug } = validateGrpc(UpdateCategorySchema, call.request);

  const existing = await findCategoryById(db, id);
  if (!existing) throw new NotFoundError("Category not found");

  if (slug && slug !== existing.slug) {
    const bySlug = await findCategoryBySlug(db, slug);
    if (bySlug) throw new ConflictError("Category slug already exists");
  }

  const updated = await updateCategoryQuery(db, id, { name, slug });

  await cacheDel(CacheKey.categoriesAll());

  const diff: Record<string, { from: unknown; to: unknown }> = {};
  if (name && name !== existing.name)
    diff.name = { from: existing.name, to: name };
  if (slug && slug !== existing.slug)
    diff.slug = { from: existing.slug, to: slug };

  await writeAuditLog(db, {
    entity_type: "category",
    entity_id: id,
    action: "update",
    performed_by: getMeta(call, "admin_id") ?? "system",
    metadata: { diff },
    ip_address: getMeta(call, "ip_address"),
  });

  logger.info(SERVICE_NAME, "Category updated", { category_id: id, diff });

  callback(null, { category: updated });
});

export const deleteCategory = handle(async (call, callback) => {
  const db = getDb();
  const { id } = validateGrpc(DeleteCategorySchema, call.request);

  const existing = await findCategoryById(db, id);
  if (!existing) throw new NotFoundError("Category not found");

  try {
    await deleteCategoryQuery(db, id);
  } catch (err: any) {
    if (err?.errno === ER_ROW_IS_REFERENCED_2) {
      throw new ConflictError(
        "Category has existing products — reassign or delete them first"
      );
    }
    throw err;
  }

  await cacheDel(CacheKey.categoriesAll());

  await writeAuditLog(db, {
    entity_type: "category",
    entity_id: id,
    action: "delete",
    performed_by: getMeta(call, "admin_id") ?? "system",
    metadata: { name: existing.name, slug: existing.slug },
    ip_address: getMeta(call, "ip_address"),
  });

  logger.info(SERVICE_NAME, "Category deleted", {
    category_id: id,
    name: existing.name,
  });

  callback(null, { success: true, message: "Category deleted" });
});

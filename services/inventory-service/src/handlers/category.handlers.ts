import { getDb } from "@shared/db";
import { cacheGet, cacheSet, cacheDel, TTL, CacheKey } from "@shared/redis";
import { writeAuditLog } from "@shared/audit";
import { Errors, handle } from "@shared/errors";
import type { Category } from "@shared/types";
import {
  findCategoryBySlug,
  insertCategory,
  getAllCategories,
} from "../db/category.queries";

export const createCategory = handle(async (call, callback) => {
  const db = getDb();
  const { name, slug } = call.request as any;

  if (!name || !slug) {
    throw Errors.invalidArgument("name and slug are required");
  }

  const existing = await findCategoryBySlug(db, slug);
  if (existing) throw Errors.alreadyExists("Category slug already exists");

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

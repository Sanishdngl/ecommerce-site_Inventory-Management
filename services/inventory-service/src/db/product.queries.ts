import type mysql from "mysql2/promise";
import type { DbClient } from "@infrastructure/database/mysql";
import { generateId } from "@shared/utils/uuid";
import { clampPagination } from "@shared/utils/pagination";
import type { Product } from "@shared/types";

export async function findProductById(
  db: DbClient,
  id: string
): Promise<Product | null> {
  const [rows] = await db.execute<any[]>(
    `SELECT * FROM products WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function insertProduct(
  db: DbClient,
  data: {
    category_id: string;
    name: string;
    description?: string;
    price: string;
    stock_quantity: number;
  }
): Promise<Product> {
  const id = generateId();
  const now = new Date();

  await db.execute(
    `INSERT INTO products
       (id, category_id, name, description, price, stock_quantity,
        thumbnail_url, list_image_url, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, true, ?, ?)`,
    [
      id,
      data.category_id,
      data.name,
      data.description ?? null,
      data.price,
      data.stock_quantity,
      now,
      now,
    ]
  );

  return findProductById(db, id) as Promise<Product>;
}

export async function updateProduct(
  db: DbClient,
  id: string,
  data: Partial<
    Pick<
      Product,
      | "category_id"
      | "name"
      | "description"
      | "price"
      | "thumbnail_url"
      | "list_image_url"
      | "is_active"
    >
  >
): Promise<Product | null> {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.category_id !== undefined) {
    fields.push("category_id = ?");
    values.push(data.category_id);
  }
  if (data.name !== undefined) {
    fields.push("name = ?");
    values.push(data.name);
  }
  if (data.description !== undefined) {
    fields.push("description = ?");
    values.push(data.description);
  }
  if (data.price !== undefined) {
    fields.push("price = ?");
    values.push(data.price);
  }
  if (data.thumbnail_url !== undefined) {
    fields.push("thumbnail_url = ?");
    values.push(data.thumbnail_url);
  }
  if (data.list_image_url !== undefined) {
    fields.push("list_image_url = ?");
    values.push(data.list_image_url);
  }
  if (data.is_active !== undefined) {
    fields.push("is_active = ?");
    values.push(data.is_active);
  }

  if (fields.length === 0) return findProductById(db, id);

  fields.push("updated_at = ?");
  values.push(new Date());
  values.push(id);

  await db.execute(
    `UPDATE products SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  return findProductById(db, id);
}

export async function softDeleteProduct(
  db: DbClient,
  id: string
): Promise<void> {
  await db.execute(
    `UPDATE products SET is_active = false, updated_at = ? WHERE id = ?`,
    [new Date(), id]
  );
}

export async function listAllProducts(
  db: DbClient,
  page: number,
  limit: number,
  includeInactive = false
): Promise<{ products: Product[]; total: number }> {
  const { safeLimit, safeOffset } = clampPagination(page, limit);
  const where = includeInactive ? "" : "WHERE is_active = true";

  const [rows] = await db.execute<any[]>(
    `SELECT * FROM products
     ${where}
     ORDER BY created_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`
  );

  const [[{ total }]] = await db.execute<any[]>(
    `SELECT COUNT(*) as total FROM products ${where}`
  );

  return { products: rows, total: Number(total) };
}

export async function listProductsByCategory(
  db: DbClient,
  categoryId: string,
  page: number,
  limit: number,
  includeInactive = false
): Promise<{ products: Product[]; total: number }> {
  const { safeLimit, safeOffset } = clampPagination(page, limit);
  const activeClause = includeInactive ? "" : "AND is_active = true";

  const [rows] = await db.execute<any[]>(
    `SELECT * FROM products
     WHERE category_id = ? ${activeClause}
     ORDER BY created_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    [categoryId]
  );

  const [[{ total }]] = await db.execute<any[]>(
    `SELECT COUNT(*) as total FROM products
     WHERE category_id = ? ${activeClause}`,
    [categoryId]
  );

  return { products: rows, total: Number(total) };
}

export async function updateStockQuantity(
  db: DbClient,
  productId: string,
  delta: number
): Promise<Product | null> {
  const [result] = await db.execute<any>(
    `UPDATE products
     SET stock_quantity = stock_quantity + ?,
         updated_at     = ?
     WHERE id = ?
       AND stock_quantity + ? >= 0`,
    [delta, new Date(), productId, delta]
  );

  if (result.affectedRows === 0) return null;
  return findProductById(db, productId);
}

export async function countActiveProducts(db: DbClient): Promise<number> {
  const [[{ total }]] = await db.execute<any[]>(
    `SELECT COUNT(*) as total FROM products WHERE is_active = true`
  );
  return Number(total);
}

export async function countLowStockProducts(
  db: DbClient,
  threshold: number
): Promise<number> {
  const [[{ total }]] = await db.execute<any[]>(
    `SELECT COUNT(*) as total FROM products
     WHERE is_active = true AND stock_quantity <= ?`,
    [threshold]
  );
  return Number(total);
}

export async function findProductsByIds(
  db: DbClient,
  ids: string[]
): Promise<Product[]> {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(", ");
  const [rows] = await db.execute<any[]>(
    `SELECT * FROM products
     WHERE id IN (${placeholders}) AND is_active = true`,
    ids
  );
  return rows;
}

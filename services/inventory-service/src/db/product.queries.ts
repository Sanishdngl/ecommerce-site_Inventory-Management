import type mysql from "mysql2/promise";
import { v4 as uuidv4 } from "uuid";
import type { Product } from "@shared/types";

export async function findProductById(
  db: mysql.Pool,
  id: string
): Promise<Product | null> {
  const [rows] = await db.execute<any[]>(
    `SELECT * FROM products WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function insertProduct(
  db: mysql.Pool,
  data: {
    category_id: string;
    name: string;
    description?: string;
    price: string;
    stock_quantity: number;
  }
): Promise<Product> {
  const id = uuidv4();
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
  db: mysql.Pool,
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
  db: mysql.Pool,
  id: string
): Promise<void> {
  await db.execute(
    `UPDATE products SET is_active = false, updated_at = ? WHERE id = ?`,
    [new Date(), id]
  );
}

export async function listProductsByCategory(
  db: mysql.Pool,
  categoryId: string,
  page: number,
  limit: number
): Promise<{ products: Product[]; total: number }> {
  const offset = (page - 1) * limit;

  const [rows] = await db.execute<any[]>(
    `SELECT * FROM products
     WHERE category_id = ? AND is_active = true
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [categoryId, limit, offset]
  );

  const [[{ total }]] = await db.execute<any[]>(
    `SELECT COUNT(*) as total FROM products
     WHERE category_id = ? AND is_active = true`,
    [categoryId]
  );

  return { products: rows, total: Number(total) };
}

export async function updateStockQuantity(
  db: mysql.Pool,
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

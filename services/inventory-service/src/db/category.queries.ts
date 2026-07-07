import type mysql from "mysql2/promise";
import { generateId } from "@shared/utils/uuid";
import type { Category } from "@shared/types";

export async function findCategoryById(
  db: mysql.Pool,
  id: string
): Promise<Category | null> {
  const [rows] = await db.execute<any[]>(
    `SELECT * FROM categories WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findCategoryBySlug(
  db: mysql.Pool,
  slug: string
): Promise<Category | null> {
  const [rows] = await db.execute<any[]>(
    `SELECT * FROM categories WHERE slug = ? LIMIT 1`,
    [slug]
  );
  return rows[0] ?? null;
}

export async function insertCategory(
  db: mysql.Pool,
  name: string,
  slug: string
): Promise<Category> {
  const id = generateId();
  const now = new Date();

  await db.execute(
    `INSERT INTO categories (id, name, slug, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, name, slug, now, now]
  );

  return findCategoryById(db, id) as Promise<Category>;
}

export async function getAllCategories(db: mysql.Pool): Promise<Category[]> {
  const [rows] = await db.execute<any[]>(
    `SELECT * FROM categories ORDER BY name ASC`
  );
  return rows;
}

export async function updateCategory(
  db: mysql.Pool,
  id: string,
  data: Partial<Pick<Category, "name" | "slug">>
): Promise<Category | null> {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    fields.push("name = ?");
    values.push(data.name);
  }
  if (data.slug !== undefined) {
    fields.push("slug = ?");
    values.push(data.slug);
  }

  if (fields.length === 0) return findCategoryById(db, id);

  fields.push("updated_at = ?");
  values.push(new Date());
  values.push(id);

  await db.execute(
    `UPDATE categories SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  return findCategoryById(db, id);
}

// Hard delete — categories.id is referenced by products.category_id with
// ON DELETE RESTRICT, so MySQL rejects this (errno 1451 / ER_ROW_IS_REFERENCED_2)
// if any product still points at the category. The handler translates that
// into a ConflictError rather than a raw 500.
export async function deleteCategory(db: mysql.Pool, id: string): Promise<void> {
  await db.execute(`DELETE FROM categories WHERE id = ?`, [id]);
}

export async function countCategories(db: mysql.Pool): Promise<number> {
  const [[{ total }]] = await db.execute<any[]>(
    `SELECT COUNT(*) as total FROM categories`
  );
  return Number(total);
}

import type mysql from "mysql2/promise";
import { v4 as uuidv4 } from "uuid";
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
  const id = uuidv4();
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

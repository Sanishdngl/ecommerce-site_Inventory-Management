import { getDb } from "../../../shared/src/db";

export async function deleteAdminUserByUsername(
  username: string
): Promise<void> {
  const db = getDb();
  await db.execute(`DELETE FROM admin_users WHERE username = ?`, [username]);
}

export async function deleteCustomerByEmail(email: string): Promise<void> {
  const db = getDb();
  await db.execute(`DELETE FROM customers WHERE email = ?`, [email]);
}

export async function deleteCategoryBySlug(slug: string): Promise<void> {
  const db = getDb();
  await db.execute(
    `DELETE FROM products WHERE category_id = (SELECT id FROM categories WHERE slug = ?)`,
    [slug]
  );
  await db.execute(`DELETE FROM categories WHERE slug = ?`, [slug]);
}

export async function deleteProductByName(name: string): Promise<void> {
  const db = getDb();
  await db.execute(`DELETE FROM products WHERE name = ?`, [name]);
}

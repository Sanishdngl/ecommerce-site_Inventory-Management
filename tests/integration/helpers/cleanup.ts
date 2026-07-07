import { getDb } from "../../../infrastructure/database/mysql";

type AuditEntityType = "admin_user" | "product" | "category";

async function purgeAuditLogsForEntity(
  entityType: AuditEntityType,
  entityId: string
): Promise<void> {
  const db = getDb();
  await db.execute(
    `DELETE FROM audit_logs WHERE entity_type = ? AND entity_id = ?`,
    [entityType, entityId]
  );
}

async function purgeAuditLogsPerformedBy(adminId: string): Promise<void> {
  const db = getDb();
  await db.execute(`DELETE FROM audit_logs WHERE performed_by = ?`, [adminId]);
}

export async function purgeAdminUserAuditTrail(adminId: string): Promise<void> {
  await purgeAuditLogsPerformedBy(adminId);
  await purgeAuditLogsForEntity("admin_user", adminId);
}

export async function deleteAdminUserByUsername(
  username: string
): Promise<void> {
  const db = getDb();

  const [rows] = await db.execute<any[]>(
    `SELECT id FROM admin_users WHERE username = ?`,
    [username]
  );
  const id = rows[0]?.id as string | undefined;

  if (id) {
    await purgeAdminUserAuditTrail(id);
  }

  await db.execute(`DELETE FROM admin_users WHERE username = ?`, [username]);
}

export async function deleteCustomerByEmail(email: string): Promise<void> {
  const db = getDb();
  await db.execute(`DELETE FROM customers WHERE email = ?`, [email]);
}

export async function deleteCategoryBySlug(slug: string): Promise<void> {
  const db = getDb();

  const [categoryRows] = await db.execute<any[]>(
    `SELECT id FROM categories WHERE slug = ?`,
    [slug]
  );
  const categoryId = categoryRows[0]?.id as string | undefined;

  if (categoryId) {
    const [productRows] = await db.execute<any[]>(
      `SELECT id FROM products WHERE category_id = ?`,
      [categoryId]
    );
    for (const row of productRows) {
      await purgeAuditLogsForEntity("product", row.id);
    }
    await purgeAuditLogsForEntity("category", categoryId);
  }

  await db.execute(
    `DELETE FROM products WHERE category_id = (SELECT id FROM categories WHERE slug = ?)`,
    [slug]
  );
  await db.execute(`DELETE FROM categories WHERE slug = ?`, [slug]);
}

export async function deleteProductByName(name: string): Promise<void> {
  const db = getDb();

  const [rows] = await db.execute<any[]>(
    `SELECT id FROM products WHERE name = ?`,
    [name]
  );
  for (const row of rows) {
    await purgeAuditLogsForEntity("product", row.id);
  }

  await db.execute(`DELETE FROM products WHERE name = ?`, [name]);
}

export async function deleteProductById(id: string): Promise<void> {
  const db = getDb();
  await purgeAuditLogsForEntity("product", id);
  await db.execute(`DELETE FROM products WHERE id = ?`, [id]);
}

export async function deleteCategoryById(id: string): Promise<void> {
  const db = getDb();

  const [productRows] = await db.execute<any[]>(
    `SELECT id FROM products WHERE category_id = ?`,
    [id]
  );
  for (const row of productRows) {
    await purgeAuditLogsForEntity("product", row.id);
  }
  await purgeAuditLogsForEntity("category", id);

  await db.execute(`DELETE FROM products WHERE category_id = ?`, [id]);
  await db.execute(`DELETE FROM categories WHERE id = ?`, [id]);
}

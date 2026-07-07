import type mysql from "mysql2/promise";
import { generateId } from "@shared/utils/uuid";
import { hashPassword } from "@shared/auth/password";
import { clampPagination } from "@shared/utils/pagination";
import type { AdminUser, AdminRole } from "@shared/types";

export async function findAdminByUsername(
  db: mysql.Pool,
  username: string
): Promise<AdminUser | null> {
  const [rows] = await db.execute<any[]>(
    `SELECT * FROM admin_users WHERE username = ? LIMIT 1`,
    [username]
  );
  return rows[0] ?? null;
}

export async function findAdminById(
  db: mysql.Pool,
  id: string
): Promise<AdminUser | null> {
  const [rows] = await db.execute<any[]>(
    `SELECT * FROM admin_users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findAdminByEmail(
  db: mysql.Pool,
  email: string
): Promise<AdminUser | null> {
  const [rows] = await db.execute<any[]>(
    `SELECT * FROM admin_users WHERE email = ? LIMIT 1`,
    [email]
  );
  return rows[0] ?? null;
}

export async function insertAdminUser(
  db: mysql.Pool,
  data: {
    username: string;
    email: string;
    password: string;
    role: AdminRole;
  }
): Promise<AdminUser> {
  const id = generateId();
  const password_hash = await hashPassword(data.password);
  const now = new Date();

  await db.execute(
    `INSERT INTO admin_users
       (id, username, email, password_hash, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, true, ?, ?)`,
    [id, data.username, data.email, password_hash, data.role, now, now]
  );

  return findAdminById(db, id) as Promise<AdminUser>;
}

export async function updateAdminUser(
  db: mysql.Pool,
  id: string,
  data: Partial<Pick<AdminUser, "username" | "email" | "role">> & {
    password?: string;
  }
): Promise<AdminUser | null> {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.username !== undefined) {
    fields.push("username = ?");
    values.push(data.username);
  }
  if (data.email !== undefined) {
    fields.push("email = ?");
    values.push(data.email);
  }
  if (data.role !== undefined) {
    fields.push("role = ?");
    values.push(data.role);
  }
  if (data.password !== undefined) {
    fields.push("password_hash = ?");
    values.push(await hashPassword(data.password));
  }

  if (fields.length === 0) return findAdminById(db, id);

  fields.push("updated_at = ?");
  values.push(new Date());
  values.push(id);

  await db.execute(
    `UPDATE admin_users SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  return findAdminById(db, id);
}

export async function deleteAdminUser(
  db: mysql.Pool,
  id: string
): Promise<void> {
  await db.execute(`DELETE FROM admin_users WHERE id = ?`, [id]);
}

export async function toggleAdminStatus(
  db: mysql.Pool,
  id: string
): Promise<AdminUser | null> {
  await db.execute(
    `UPDATE admin_users SET is_active = NOT is_active, updated_at = ? WHERE id = ?`,
    [new Date(), id]
  );
  return findAdminById(db, id);
}

export async function listAdminUsers(
  db: mysql.Pool,
  page: number,
  limit: number
): Promise<{ users: AdminUser[]; total: number }> {
  const { safeLimit, safeOffset } = clampPagination(page, limit);

  const [rows] = await db.execute<any[]>(
    `SELECT * FROM admin_users
     ORDER BY created_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`
  );

  const [[{ total }]] = await db.execute<any[]>(
    `SELECT COUNT(*) as total FROM admin_users`
  );

  return { users: rows, total: Number(total) };
}

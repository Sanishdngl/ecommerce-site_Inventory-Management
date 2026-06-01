import type mysql from "mysql2/promise";
import { v4 as uuidv4 } from "uuid";
import type { Customer } from "@shared/types";

export async function findCustomerById(
  db: mysql.Pool,
  id: string
): Promise<Customer | null> {
  const [rows] = await db.execute<any[]>(
    `SELECT * FROM customers WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findCustomerByEmail(
  db: mysql.Pool,
  email: string
): Promise<Customer | null> {
  const [rows] = await db.execute<any[]>(
    `SELECT * FROM customers WHERE email = ? LIMIT 1`,
    [email]
  );
  return rows[0] ?? null;
}

export async function findCustomerByOAuth(
  db: mysql.Pool,
  provider: string,
  oauthId: string
): Promise<Customer | null> {
  const [rows] = await db.execute<any[]>(
    `SELECT * FROM customers
     WHERE oauth_provider = ? AND oauth_id = ? LIMIT 1`,
    [provider, oauthId]
  );
  return rows[0] ?? null;
}

export async function insertCustomer(
  db: mysql.Pool,
  data: {
    email: string;
    password_hash: string | null;
    oauth_provider: string | null;
    oauth_id: string | null;
    first_name: string;
    last_name: string;
  }
): Promise<Customer> {
  const id = uuidv4();
  const now = new Date();

  await db.execute(
    `INSERT INTO customers
       (id, email, password_hash, oauth_provider, oauth_id,
        first_name, last_name, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, true, ?, ?)`,
    [
      id,
      data.email,
      data.password_hash,
      data.oauth_provider,
      data.oauth_id,
      data.first_name,
      data.last_name,
      now,
      now,
    ]
  );

  return findCustomerById(db, id) as Promise<Customer>;
}

export async function updateCustomerProfile(
  db: mysql.Pool,
  id: string,
  data: Partial<Pick<Customer, "first_name" | "last_name">>
): Promise<Customer | null> {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.first_name !== undefined) {
    fields.push("first_name = ?");
    values.push(data.first_name);
  }
  if (data.last_name !== undefined) {
    fields.push("last_name = ?");
    values.push(data.last_name);
  }

  if (fields.length === 0) return findCustomerById(db, id);

  fields.push("updated_at = ?");
  values.push(new Date());
  values.push(id);

  await db.execute(
    `UPDATE customers SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  return findCustomerById(db, id);
}

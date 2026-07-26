import type mysql from "mysql2/promise";
import type { DbClient } from "@infrastructure/database/mysql";
import { generateId } from "@shared/utils/uuid";

export async function upsertCartItem(
  db: mysql.Pool,
  customerId: string,
  productId: string,
  quantity: number
): Promise<void> {
  await db.execute(
    `INSERT INTO cart_items (id, customer_id, product_id, quantity, added_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       quantity   = quantity + VALUES(quantity),
       updated_at = NOW()`,
    [generateId(), customerId, productId, quantity]
  );
}

export async function setCartItemQuantity(
  db: mysql.Pool,
  customerId: string,
  productId: string,
  quantity: number
): Promise<void> {
  await db.execute(
    `UPDATE cart_items
     SET quantity = ?, updated_at = NOW()
     WHERE customer_id = ? AND product_id = ?`,
    [quantity, customerId, productId]
  );
}

export async function removeCartItem(
  db: mysql.Pool,
  customerId: string,
  productId: string
): Promise<void> {
  await db.execute(
    `DELETE FROM cart_items WHERE customer_id = ? AND product_id = ?`,
    [customerId, productId]
  );
}

export async function getRawCartItems(
  db: mysql.Pool,
  customerId: string
): Promise<{ product_id: string; quantity: number }[]> {
  const [rows] = await db.execute<any[]>(
    `SELECT product_id, quantity FROM cart_items
     WHERE customer_id = ? ORDER BY added_at ASC`,
    [customerId]
  );
  return rows;
}

export async function cartItemExists(
  db: mysql.Pool,
  customerId: string,
  productId: string
): Promise<boolean> {
  const [rows] = await db.execute<any[]>(
    `SELECT id FROM cart_items
     WHERE customer_id = ? AND product_id = ? LIMIT 1`,
    [customerId, productId]
  );
  return rows.length > 0;
}

export async function clearCart(
  db: DbClient,
  customerId: string
): Promise<void> {
  await db.execute(`DELETE FROM cart_items WHERE customer_id = ?`, [
    customerId,
  ]);
}

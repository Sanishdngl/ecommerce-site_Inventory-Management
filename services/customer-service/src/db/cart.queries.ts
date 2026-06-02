import type mysql from "mysql2/promise";
import { v4 as uuidv4 } from "uuid";
//import type { CartItem } from "@shared/types";

export interface EnrichedCartItem {
  product_id: string;
  product_name: string;
  price: string;
  thumbnail_url: string | null;
  quantity: number;
  stock_quantity: number;
}

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
    [uuidv4(), customerId, productId, quantity]
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

export async function getEnrichedCart(
  db: mysql.Pool,
  customerId: string
): Promise<EnrichedCartItem[]> {
  const [rows] = await db.execute<any[]>(
    `SELECT
       ci.product_id,
       p.name          AS product_name,
       p.price,
       p.thumbnail_url,
       ci.quantity,
       p.stock_quantity
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.customer_id = ?
       AND p.is_active = true
     ORDER BY ci.added_at ASC`,
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

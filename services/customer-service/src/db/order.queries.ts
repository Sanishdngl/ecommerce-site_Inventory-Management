import type { DbClient } from "@infrastructure/database/mysql";
import { generateId } from "@shared/utils/uuid";
import type { Order, OrderItemRow, OrderStatus } from "@shared/types";

export async function insertOrder(
  db: DbClient,
  data: {
    customer_id: string;
    total_amount: string;
  }
): Promise<Order> {
  const id = generateId();
  const now = new Date();
  await db.execute(
    `INSERT INTO orders (id, customer_id, status, total_amount, created_at, updated_at)
     VALUES (?, ?, 'pending', ?, ?, ?)`,
    [id, data.customer_id, data.total_amount, now, now]
  );
  return {
    id,
    customer_id: data.customer_id,
    status: "pending",
    total_amount: data.total_amount,
    cancellation_reason: null,
    created_at: now,
    updated_at: now,
  };
}

export async function insertOrderItems(
  db: DbClient,
  orderId: string,
  items: Array<{
    product_id: string;
    product_name: string;
    price: string;
    quantity: number;
  }>
): Promise<void> {
  for (const item of items) {
    await db.execute(
      `INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        orderId,
        item.product_id,
        item.product_name,
        item.price,
        item.quantity,
        new Date(),
      ]
    );
  }
}

export async function updateOrderStatus(
  db: DbClient,
  orderId: string,
  status: OrderStatus,
  cancellationReason?: string
): Promise<void> {
  await db.execute(
    `UPDATE orders
     SET status = ?, cancellation_reason = ?, updated_at = ?
     WHERE id = ?`,
    [status, cancellationReason ?? null, new Date(), orderId]
  );
}

export async function findOrderById(
  db: DbClient,
  orderId: string
): Promise<Order | null> {
  const [rows] = await db.execute<any[]>(
    `SELECT * FROM orders WHERE id = ? LIMIT 1`,
    [orderId]
  );
  return rows[0] ?? null;
}

export async function findOrderItemsByOrderId(
  db: DbClient,
  orderId: string
): Promise<OrderItemRow[]> {
  const [rows] = await db.execute<any[]>(
    `SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC`,
    [orderId]
  );
  return rows;
}

import type { DbClient } from "@infrastructure/database/mysql";

// Returns existing reservation rows for this order — non-empty means this
// order_id was already processed (reservation attempt is a retry), and the
// handler should skip re-decrementing stock rather than double-applying it.
export async function findReservationsByOrderId(
  db: DbClient,
  orderId: string
): Promise<Array<{ product_id: string; quantity: number }>> {
  const [rows] = await db.execute<any[]>(
    `SELECT product_id, quantity FROM stock_reservations WHERE order_id = ?`,
    [orderId]
  );
  return rows;
}

export async function insertReservation(
  db: DbClient,
  orderId: string,
  productId: string,
  quantity: number
): Promise<void> {
  await db.execute(
    `INSERT INTO stock_reservations (order_id, product_id, quantity, created_at)
     VALUES (?, ?, ?, ?)`,
    [orderId, productId, quantity, new Date()]
  );
}

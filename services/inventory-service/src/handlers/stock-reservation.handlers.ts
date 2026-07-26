import { getDb, withTransaction } from "@infrastructure/database/mysql";
import { writeOutboxEvent } from "@infrastructure/database/outbox";
import { cacheDel, cacheDelPattern, CacheKey } from "@infrastructure/redis/redis";
import { logger } from "@infrastructure/observability/logger";
import { handle } from "@shared/errors";
import { validateGrpc } from "@shared/grpc/validate-grpc";
import { ReserveStockForOrderSchema } from "@shared/validation/inventory.schema";
import { findProductById, updateStockQuantity } from "../db/product.queries";
import {
  findReservationsByOrderId,
  insertReservation,
} from "../db/stock-reservation.queries";

const SERVICE_NAME = "inventory-service";

interface ReservationResultDTO {
  product_id: string;
  reserved: boolean;
  available_stock: number;
}

// Thrown to unwind withTransaction (triggers rollback) while carrying the
// partial results needed to build a structured ReserveStockResponse —
// insufficient stock is an expected business outcome, not a system error,
// so it's caught locally here rather than surfacing as a gRPC error status.
class InsufficientStockError extends Error {
  constructor(public results: ReservationResultDTO[]) {
    super("Insufficient stock for one or more items");
  }
}

export const reserveStockForOrder = handle(async (call, callback) => {
  const { order_id, lines } = validateGrpc(
    ReserveStockForOrderSchema,
    call.request
  );

  const db = getDb();

  // Idempotency check — if this order_id was already reserved (retry from
  // customer-service after a timeout, gRPC client retry policy, etc.), don't
  // decrement stock a second time. Reservation rows are the source of truth
  // for "already processed", checked before opening a write transaction.
  const existingReservations = await findReservationsByOrderId(db, order_id);
  if (existingReservations.length > 0) {
    logger.info(SERVICE_NAME, "Reservation already exists for order — idempotent replay", {
      order_id,
    });
    const results: ReservationResultDTO[] = existingReservations.map((r) => ({
      product_id: r.product_id,
      reserved: true,
      available_stock: 0, // not re-checked on replay — reservation already committed previously
    }));
    callback(null, { success: true, results });
    return;
  }

  let reservedProductIds: string[] = [];

  try {
    const results = await withTransaction<ReservationResultDTO[]>(
      async (conn) => {
        const results: ReservationResultDTO[] = [];

        for (const line of lines) {
          const existing = await findProductById(conn, line.product_id);
          if (!existing) {
            results.push({
              product_id: line.product_id,
              reserved: false,
              available_stock: 0,
            });
            throw new InsufficientStockError(results);
          }

          const updated = await updateStockQuantity(
            conn,
            line.product_id,
            -line.quantity
          );

          if (!updated) {
            results.push({
              product_id: line.product_id,
              reserved: false,
              available_stock: existing.stock_quantity,
            });
            throw new InsufficientStockError(results);
          }

          await insertReservation(conn, order_id, line.product_id, line.quantity);

          await writeOutboxEvent(conn, {
            aggregate_type: "stock",
            aggregate_id: line.product_id,
            event_type: "reserved",
            payload: {
              product_id: line.product_id,
              quantity_delta: -line.quantity,
              resulting_stock: updated.stock_quantity,
              reason: "order_reservation",
              order_id,
            },
          });

          results.push({
            product_id: line.product_id,
            reserved: true,
            available_stock: updated.stock_quantity,
          });
        }

        return results;
      }
    );

    reservedProductIds = results.map((r) => r.product_id);

    logger.info(SERVICE_NAME, "Stock reserved for order", {
      order_id,
      product_ids: reservedProductIds,
    });

    callback(null, { success: true, results });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      logger.warn(SERVICE_NAME, "Stock reservation rejected — insufficient stock", {
        order_id,
        results: err.results,
      });
      callback(null, {
        success: false,
        message: "Insufficient stock for one or more items",
        results: err.results,
      });
      return;
    }
    throw err;
  }

  // Cache invalidation is a known gap here — see design doc Phase 6
  // (cache-invalidation consumer). Doing it inline here for now, same as
  // the existing updateStock handler does, until that consumer replaces it.
  await Promise.all(
    reservedProductIds.map((id) => cacheDel(CacheKey.stock(id), CacheKey.product(id)))
  );
  await cacheDelPattern(CacheKey.productListAllPattern());
});

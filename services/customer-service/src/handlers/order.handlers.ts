import { getDb, withTransaction } from "@infrastructure/database/mysql";
import { writeOutboxEvent } from "@infrastructure/database/outbox";
import { cacheDel, CacheKey } from "@infrastructure/redis/redis";
import { logger } from "@infrastructure/observability/logger";
import { handle, NotFoundError, ConflictError } from "@shared/errors";
import { callGrpc } from "@shared/grpc/call-grpc";
import { validateGrpc } from "@shared/grpc/validate-grpc";
import {
  PlaceOrderSchema,
  GetOrderSchema,
} from "@shared/validation/customer.schema";
import { getInventoryClient } from "@shared/grpc/inventory.client";
import { getRawCartItems, clearCart } from "../db/cart.queries";
import { findCustomerById } from "../db/customer.queries";
import {
  insertOrder,
  insertOrderItems,
  updateOrderStatus,
  findOrderById,
  findOrderItemsByOrderId,
} from "../db/order.queries";
import type { Order, OrderItemRow } from "@shared/types";

const SERVICE_NAME = "customer-service";

function toOrderResponse(order: Order, items: OrderItemRow[]) {
  return {
    order: {
      id: order.id,
      customer_id: order.customer_id,
      status: order.status,
      items: items.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        price: i.price,
        quantity: i.quantity,
      })),
      total_amount: order.total_amount,
      cancellation_reason: order.cancellation_reason ?? undefined,
      created_at: order.created_at.toISOString(),
    },
  };
}

interface ReserveStockLineResult {
  product_id: string;
  reserved: boolean;
  available_stock: number;
}

export const placeOrder = handle(async (call, callback) => {
  const { customer_id } = validateGrpc(PlaceOrderSchema, call.request);
  const db = getDb();

  const customer = await findCustomerById(db, customer_id);
  if (!customer) throw new NotFoundError("Customer not found");

  const cartItems = await getRawCartItems(db, customer_id);
  if (cartItems.length === 0) {
    throw new ConflictError("Cart is empty — nothing to order");
  }

  // Hydrate current name/price/stock from inventory-service — snapshotting
  // these onto the order at placement time (see order_items migration),
  // since product name/price can change or the product can be deactivated
  // after the order is placed.
  const productIds = cartItems.map((i) => i.product_id);
  const invResponse = await callGrpc<any, any>(
    getInventoryClient(),
    "GetProductsByIds",
    { ids: productIds }
  );
  const productMap = new Map(
    (invResponse.products as any[]).map((p: any) => [p.id, p])
  );

  const missingProduct = cartItems.find((ci) => !productMap.has(ci.product_id));
  if (missingProduct) {
    throw new ConflictError(
      "One or more items in your cart are no longer available"
    );
  }

  const orderLines = cartItems.map((ci) => {
    const p = productMap.get(ci.product_id)!;
    return {
      product_id: ci.product_id,
      product_name: p.name,
      price: p.price,
      quantity: ci.quantity,
    };
  });

  const totalAmount = orderLines
    .reduce((sum, l) => sum + parseFloat(l.price) * l.quantity, 0)
    .toFixed(2);

  // Phase 1: durably record the order as "pending" before calling out to
  // inventory-service — this transaction commits on its own so a crash or
  // timeout during the reservation call leaves a recoverable pending order
  // rather than losing the attempt entirely. Deliberately not held open
  // across the gRPC call to inventory-service (see design doc).
  const order = await withTransaction(async (conn) => {
    const order = await insertOrder(conn, {
      customer_id,
      total_amount: totalAmount,
    });

    await insertOrderItems(conn, order.id, orderLines);

    await writeOutboxEvent(conn, {
      aggregate_type: "order",
      aggregate_id: order.id,
      event_type: "placed",
      payload: {
        order_id: order.id,
        customer_id,
        status: "pending",
        lines: orderLines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
        })),
      },
    });

    return order;
  });

  // Phase 2: reserve stock synchronously — the user-facing "did my order
  // succeed" answer depends on this, so it stays gRPC rather than an async
  // Kafka round-trip (see design doc "Order flow").
  let reservation: { success: boolean; message?: string; results: ReserveStockLineResult[] };
  try {
    reservation = await callGrpc<any, any>(
      getInventoryClient(),
      "ReserveStockForOrder",
      {
        order_id: order.id,
        lines: orderLines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
        })),
      }
    );
  } catch (err) {
    // inventory-service unreachable/erroring — leave the order pending
    // rather than guessing at its outcome. It's recoverable (retry
    // placement, or a future reconciliation job) rather than silently
    // marked confirmed or cancelled based on no information.
    logger.error(SERVICE_NAME, "ReserveStockForOrder call failed", {
      order_id: order.id,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  if (reservation.success) {
    await withTransaction(async (conn) => {
      await updateOrderStatus(conn, order.id, "confirmed");
      await writeOutboxEvent(conn, {
        aggregate_type: "order",
        aggregate_id: order.id,
        event_type: "confirmed",
        payload: {
          order_id: order.id,
          customer_id,
          status: "confirmed",
          lines: orderLines.map((l) => ({
            product_id: l.product_id,
            quantity: l.quantity,
          })),
        },
      });
      await clearCart(conn, customer_id);
    });

    await cacheDel(CacheKey.cart(customer_id));

    logger.info(SERVICE_NAME, "Order confirmed", {
      order_id: order.id,
      customer_id,
    });

    const items = await findOrderItemsByOrderId(db, order.id);
    const confirmed = await findOrderById(db, order.id);
    callback(null, toOrderResponse(confirmed!, items));
    return;
  }

  // Reservation failed — cancel the order. Cart is deliberately left
  // untouched so the customer can adjust quantities and retry.
  const reason =
    reservation.message ?? "Insufficient stock for one or more items";

  await withTransaction(async (conn) => {
    await updateOrderStatus(conn, order.id, "cancelled", reason);
    await writeOutboxEvent(conn, {
      aggregate_type: "order",
      aggregate_id: order.id,
      event_type: "cancelled",
      payload: {
        order_id: order.id,
        customer_id,
        status: "cancelled",
        lines: orderLines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
        })),
      },
    });
  });

  logger.warn(SERVICE_NAME, "Order cancelled — reservation failed", {
    order_id: order.id,
    customer_id,
    reason,
  });

  const items = await findOrderItemsByOrderId(db, order.id);
  const cancelled = await findOrderById(db, order.id);
  callback(null, toOrderResponse(cancelled!, items));
});

export const getOrder = handle(async (call, callback) => {
  const { customer_id, order_id } = validateGrpc(GetOrderSchema, call.request);
  const db = getDb();

  const order = await findOrderById(db, order_id);
  if (!order || order.customer_id !== customer_id) {
    throw new NotFoundError("Order not found");
  }

  const items = await findOrderItemsByOrderId(db, order_id);
  callback(null, toOrderResponse(order, items));
});

// Event payload shapes carried in outbox_events.payload / Kafka message value.
// Mirrors proto/events/*.proto — kept here as plain TS types since these are
// never RPC messages (proto-loader only loads admin/inventory/customer.proto)
// and JSON is what actually goes into the outbox `payload` JSON column.
//
// Every consumer must dedupe on `event_id` before applying an effect —
// Debezium/Kafka Connect delivery is at-least-once, redelivery WILL happen
// on rebalances/restarts.

export interface OutboxEnvelope<T> {
  event_id: string; // outbox_events.id — the idempotency key for consumers
  event_type: string;
  occurred_at: string; // ISO 8601
  payload: T;
}

export interface ProductEventPayload {
  product_id: string;
  category_id: string;
  name: string;
  description?: string | null;
  price: string;
  is_active: boolean;
  thumbnail_url?: string | null;
  list_image_url?: string | null;
}

export interface StockEventPayload {
  product_id: string;
  quantity_delta: number;
  resulting_stock: number;
  reason: "manual_adjustment" | "order_reservation" | "reservation_rollback";
  order_id?: string | null;
}

export interface OrderLinePayload {
  product_id: string;
  quantity: number;
}

export interface OrderEventPayload {
  order_id: string;
  customer_id: string;
  status: "pending" | "confirmed" | "cancelled";
  lines: OrderLinePayload[];
}

export type ProductEvent = OutboxEnvelope<ProductEventPayload>;
export type StockEvent = OutboxEnvelope<StockEventPayload>;
export type OrderEvent = OutboxEnvelope<OrderEventPayload>;

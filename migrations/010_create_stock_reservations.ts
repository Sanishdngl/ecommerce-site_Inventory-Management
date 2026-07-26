import type { Knex } from "knex";

// Guards ReserveStockForOrder against double-decrementing stock if the same
// order_id is retried (customer-service retry on timeout, gRPC client retry
// policy, etc.). Composite PK means a second attempt for the same
// (order_id, product_id) pair fails the INSERT, which the handler uses to
// detect "already reserved" and skip re-applying the decrement — this is
// the idempotency mechanism for the reservation step itself, separate from
// the outbox/Kafka consumer idempotency in infrastructure/kafka/idempotency.ts.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("stock_reservations", (t) => {
    t.uuid("order_id").notNullable();
    t.uuid("product_id").notNullable();
    t.integer("quantity").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.primary(["order_id", "product_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("stock_reservations");
}
